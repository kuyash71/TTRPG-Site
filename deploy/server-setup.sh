#!/usr/bin/env bash
# =============================================================================
#  Schwarzesonne — sunucu kurulum ve sertleştirme betiği (Ubuntu 22.04/24.04)
#
#  root olarak BİR KEZ çalıştırılır:   sudo bash server-setup.sh
#  Tekrar çalıştırmak güvenlidir; yapılmış adımları atlar.
#
#  Yaptıkları:
#   1. Eski siteyi (pm2, /opt/TTRPG-Site) durdurur, eski veritabanını yedekleyip SİLER
#   2. Yeni veritabanı + düşük yetkili veritabanı kullanıcısı oluşturur
#   3. Uygulamayı root yerine "shz" kullanıcısıyla, systemd altında, sertleştirilmiş çalıştırır.
#      Kodu ayrı bir "shzdeploy" kullanıcısı kurar; çalışan uygulama kendi koduna yazamaz.
#   4. nginx: umbracaelis.com giriş sayfası, /schwarzesonne uygulaması, Cloudflare gerçek IP, hız sınırı
#   5. Güvenlik duvarı (yalnızca SSH + Cloudflare'den 80/443), fail2ban, otomatik güvenlik güncellemeleri
#   6. Gece veritabanı yedeği (14 gün saklanır)
#   7. GitHub Actions için yalnızca bu iş için kullanılan bir deploy anahtarı üretir
# =============================================================================
set -euo pipefail

DOMAIN="umbracaelis.com"
APP_USER="shz"          # uygulamayı çalıştırır, koda yazamaz
DEPLOY_USER="shzdeploy" # GitHub Actions ile kodu kurar
BASE="/opt/schwarzesonne"
DB_NAME="schwarzesonne"
DB_USER="shz_app"
OLD_DIR="/opt/TTRPG-Site"
STAMP="$(date +%Y%m%d-%H%M%S)"

bold() { printf "\n\033[1m%s\033[0m\n" "$*"; }
info() { printf "  • %s\n" "$*"; }
warn() { printf "\033[33m  ! %s\033[0m\n" "$*"; }
ask() { # ask "Soru" varsayılan(E/H) -> 0 evet
  local q="$1" def="${2:-E}" a
  read -r -p "  ? $q [$( [ "$def" = E ] && echo 'E/h' || echo 'e/H')]: " a || true
  a="${a:-$def}"
  [[ "$a" =~ ^[EeYy] ]]
}

[ "$(id -u)" -eq 0 ] || { echo "Bu betik root olarak çalıştırılmalı: sudo bash server-setup.sh"; exit 1; }
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "Ubuntu dışı bir sistem algılandı ($ID). Devam etmek riskli olabilir."

bold "Schwarzesonne sunucu kurulumu"
cat <<TXT
  Bu betik eski TTRPG sitesini kapatıp veritabanını SİLECEK ve yeni sistemi kuracak.
  Alan adı: $DOMAIN   Uygulama: https://$DOMAIN/schwarzesonne
TXT
ask "Devam edilsin mi?" H || exit 0

# ---------------------------------------------------------------------------
bold "1/9 Paketler"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx postgresql postgresql-contrib rsync curl ufw fail2ban unattended-upgrades ca-certificates gnupg >/dev/null
NODE_MAJOR="$( (/usr/bin/node -v 2>/dev/null || echo v0) | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  info "Node.js 22 kuruluyor (mevcut: v$NODE_MAJOR)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
info "Node $(/usr/bin/node -v), npm $(npm -v)"

# ---------------------------------------------------------------------------
bold "2/9 Eski siteyi kapat"
OLD_DB_URL=""
if [ -f "$OLD_DIR/server/ecosystem.config.cjs" ]; then
  OLD_DB_URL="$(cd "$OLD_DIR" && node -e "try{const c=require('./server/ecosystem.config.cjs');console.log(c.apps[0].env.DATABASE_URL||'')}catch(e){}" 2>/dev/null || true)"
fi
if command -v pm2 >/dev/null 2>&1; then
  pm2 list || true
  if ask "Yukarıdaki pm2 süreçleri (eski site) durdurulup silinsin mi?" E; then
    pm2 delete all >/dev/null 2>&1 || true
    pm2 save --force >/dev/null 2>&1 || true
    pm2 unstartup systemd >/dev/null 2>&1 || true
    info "pm2 süreçleri kaldırıldı"
  fi
fi

# ---------------------------------------------------------------------------
bold "3/9 Eski veritabanını temizle"
if [ -n "$OLD_DB_URL" ]; then
  OLD_HOST="$(node -e "const u=new URL(process.argv[1]);console.log(u.hostname)" "$OLD_DB_URL")"
  OLD_DB="$(node -e "const u=new URL(process.argv[1]);console.log(decodeURIComponent(u.pathname.slice(1)))" "$OLD_DB_URL")"
  OLD_ROLE="$(node -e "const u=new URL(process.argv[1]);console.log(decodeURIComponent(u.username))" "$OLD_DB_URL")"
  info "Eski veritabanı: $OLD_DB @ $OLD_HOST (kullanıcı: $OLD_ROLE)"
  if [[ "$OLD_HOST" == "localhost" || "$OLD_HOST" == "127.0.0.1" || "$OLD_HOST" == "::1" ]]; then
    if ask "Silmeden önce bir yedek alınsın mı? (/root altına, yalnızca root okuyabilir)" E; then
      umask 077
      pg_dump "$OLD_DB_URL" | gzip > "/root/eski-ttrpg-db-$STAMP.sql.gz" && info "Yedek: /root/eski-ttrpg-db-$STAMP.sql.gz"
      umask 022
    fi
    read -r -p "  ? Eski veritabanını kalıcı olarak silmek için SIL yaz: " CONFIRM || true
    if [ "${CONFIRM:-}" = "SIL" ]; then
      sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$OLD_DB' AND pid <> pg_backend_pid();" >/dev/null || true
      sudo -u postgres psql -q -c "DROP DATABASE IF EXISTS \"$OLD_DB\";"
      if [ -n "$OLD_ROLE" ] && [ "$OLD_ROLE" != "postgres" ]; then
        sudo -u postgres psql -q -c "DROP ROLE IF EXISTS \"$OLD_ROLE\";" || warn "Eski rol silinemedi (başka nesnelere sahip olabilir)"
      else
        warn "Eski site 'postgres' süper kullanıcısıyla bağlanıyordu. Bu kullanıcının şifresi kaldırılıyor (yalnızca yerel peer girişi kalır)."
        sudo -u postgres psql -q -c "ALTER ROLE postgres PASSWORD NULL;"
      fi
      info "Eski veritabanı silindi"
    else
      warn "Silme atlandı"
    fi
  else
    warn "Eski veritabanı bu sunucuda değil ($OLD_HOST). Uzak veritabanını kendi panelinden silmelisin."
  fi
else
  info "Eski site yapılandırması bulunamadı, atlanıyor"
fi
if [ -d "$OLD_DIR" ]; then
  mv "$OLD_DIR" "/root/eski-TTRPG-Site-$STAMP"
  chmod 700 "/root/eski-TTRPG-Site-$STAMP"
  info "Eski kod /root/eski-TTRPG-Site-$STAMP klasörüne taşındı (istersen silebilirsin)"
fi

# ---------------------------------------------------------------------------
bold "4/9 Kullanıcılar ve klasörler"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --no-create-home --home /nonexistent --shell /usr/sbin/nologin "$APP_USER" >/dev/null
  info "Servis kullanıcısı: $APP_USER (giriş yapamaz, sudo yok)"
fi
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --system --group --home "/home/$DEPLOY_USER" --shell /bin/bash "$DEPLOY_USER" >/dev/null
  info "Deploy kullanıcısı: $DEPLOY_USER (yalnızca SSH anahtarıyla, şifresiz)"
fi
passwd -l "$DEPLOY_USER" >/dev/null 2>&1 || true
usermod -aG "$APP_USER" "$DEPLOY_USER"
# Kod: shzdeploy sahibi, shz grubu yalnızca okur. setgid: yeni dosyalar shz grubunda doğar.
install -d -o "$DEPLOY_USER" -g "$APP_USER" -m 750 "$BASE"
install -d -o "$DEPLOY_USER" -g "$APP_USER" -m 2750 "$BASE/releases"
install -d -o "$DEPLOY_USER" -g "$APP_USER" -m 750 "$BASE/shared"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$BASE/backups"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 /var/www/umbracaelis
if [ ! -f /var/www/umbracaelis/index.html ]; then
  echo '<!doctype html><meta charset="utf-8"><title>Umbra Caelis</title><body style="background:#0b0a0e;color:#eee;font-family:sans-serif;display:grid;place-items:center;height:100vh">Kurulum sürüyor…</body>' > /var/www/umbracaelis/index.html
  chown "$DEPLOY_USER:$DEPLOY_USER" /var/www/umbracaelis/index.html
fi

# ---------------------------------------------------------------------------
bold "5/9 Yeni veritabanı"
ENV_FILE="$BASE/shared/.env"
if [ -f "$ENV_FILE" ]; then
  info "$ENV_FILE zaten var, veritabanı adımı atlanıyor"
else
  DB_PASS="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END \$\$;
SQL
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  fi
  sudo -u postgres psql -q -d "$DB_NAME" -c "REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT ALL ON SCHEMA public TO $DB_USER; ALTER SCHEMA public OWNER TO $DB_USER;"
  umask 077
  cat > "$ENV_FILE" <<ENV
# Otomatik üretildi ($STAMP). Bu dosyayı paylaşma.
NODE_ENV=production
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
APP_ORIGIN=https://$DOMAIN
HOST=127.0.0.1
PORT=3000
NEXT_TELEMETRY_DISABLED=1
ENV
  umask 022
  chown "$DEPLOY_USER:$APP_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  info "Veritabanı '$DB_NAME' ve kullanıcı '$DB_USER' hazır; bağlantı bilgisi $ENV_FILE içinde"
fi
# PostgreSQL yalnızca yerelden dinlemeli
if ss -ltn | awk '{print $4}' | grep -E ':5432$' | grep -vqE '^(127\.0\.0\.1|\[::1\]):5432$'; then
  warn "PostgreSQL dış arayüzleri dinliyor! postgresql.conf içinde listen_addresses = 'localhost' yap."
else
  info "PostgreSQL yalnızca yerelden erişilebilir"
fi

# ---------------------------------------------------------------------------
bold "6/9 systemd servisi ve deploy izinleri"
cat > /etc/systemd/system/schwarzesonne.service <<'UNIT'
[Unit]
Description=Schwarzesonne TTRPG (Next.js + Socket.io)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=shz
Group=shz
WorkingDirectory=/opt/schwarzesonne/current
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=SHZ_ENV_FILE=/opt/schwarzesonne/shared/.env
ExecStart=/opt/schwarzesonne/current/node_modules/.bin/tsx server.ts
Restart=always
RestartSec=3
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
# Kod shzdeploy'a aittir; dosya izinleri yalnızca .next/cache yazımına izin verir.
ReadWritePaths=/opt/schwarzesonne/releases
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictNamespaces=true
LockPersonality=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
AmbientCapabilities=
SystemCallArchitectures=native
UMask=0027
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable schwarzesonne >/dev/null 2>&1
SYSTEMCTL="$(command -v systemctl)"
cat > /etc/sudoers.d/shz-deploy <<SUDO
# Deploy kullanıcısı yalnızca uygulama servisini yeniden başlatabilir
$DEPLOY_USER ALL=(root) NOPASSWD: $SYSTEMCTL restart schwarzesonne, $SYSTEMCTL is-active schwarzesonne, $SYSTEMCTL status schwarzesonne
SUDO
chmod 440 /etc/sudoers.d/shz-deploy
visudo -cf /etc/sudoers.d/shz-deploy >/dev/null
info "Servis: schwarzesonne (ilk deploy sonrası başlar)"

# deploy anahtarı
SSH_DIR="/home/$DEPLOY_USER/.ssh"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$SSH_DIR"
NEW_KEY=""
if ! grep -q "shz-github-deploy" "$SSH_DIR/authorized_keys" 2>/dev/null; then
  TMPK="$(mktemp -d)"
  ssh-keygen -q -t ed25519 -N "" -C "shz-github-deploy" -f "$TMPK/key"
  echo "restrict $(cat "$TMPK/key.pub")" >> "$SSH_DIR/authorized_keys"
  NEW_KEY="$(cat "$TMPK/key")"
  shred -u "$TMPK/key" "$TMPK/key.pub" 2>/dev/null || rm -f "$TMPK/key" "$TMPK/key.pub"
  rmdir "$TMPK"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"

# ---------------------------------------------------------------------------
bold "7/9 nginx"
CF4="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 || true)"
CF6="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6 || true)"
if [ -z "$CF4" ]; then
  warn "Cloudflare IP listesi indirilemedi, yerleşik liste kullanılıyor"
  CF4="173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22"
  CF6="2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32"
fi
{
  echo "# Cloudflare arkasında gerçek ziyaretçi IP'si ($STAMP)"
  for ip in $CF4 $CF6; do echo "set_real_ip_from $ip;"; done
  echo "real_ip_header CF-Connecting-IP;"
} > /etc/nginx/snippets/cloudflare-realip.conf

for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  if grep -qs "$DOMAIN" "$f" && [ "$(basename "$f")" != "umbracaelis" ]; then
    cp -L "$f" "/root/nginx-$(basename "$f")-$STAMP.yedek"
    rm -f "$f"
    info "Eski nginx sitesi devre dışı: $(basename "$f") (yedek /root altında)"
  fi
done

SSL_CERT=/etc/ssl/cloudflare-cert.pem
SSL_KEY=/etc/ssl/cloudflare-key.pem
[ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ] || { warn "Cloudflare origin sertifikası bulunamadı ($SSL_CERT). nginx yapılandırması yazıldı ama test başarısız olabilir."; }
chmod 600 "$SSL_KEY" 2>/dev/null || true

cat > /etc/nginx/sites-available/umbracaelis <<NGINX
# Schwarzesonne / Umbra Caelis ($STAMP)
include /etc/nginx/snippets/cloudflare-realip.conf;

limit_req_zone \$binary_remote_addr zone=shz_auth:10m rate=10r/m;
limit_req_zone \$binary_remote_addr zone=shz_app:10m rate=60r/s;
limit_conn_zone \$binary_remote_addr zone=shz_conn:10m;

map \$http_upgrade \$shz_connection_upgrade { default upgrade; '' close; }

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://$DOMAIN\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.$DOMAIN;
    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    return 301 https://$DOMAIN\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    server_tokens off;
    client_max_body_size 256k;
    client_body_timeout 15s;
    client_header_timeout 15s;
    limit_conn shz_conn 60;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/umbracaelis;

    # Giriş sayfası (statik)
    location = / {
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Content-Security-Policy "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Referrer-Policy same-origin always;
        try_files /index.html =404;
    }

    # Eski kurallar adresi
    location = /kurallar { return 301 /schwarzesonne/kurallar; }
    location ^~ /kurallar/ { return 301 /schwarzesonne/kurallar; }

    # Uygulamanın kök adresi (Next.js kendisi /giris veya /panel'e yönlendirir)
    location = /schwarzesonne {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Canlı oyun odası (WebSocket)
    location ^~ /schwarzesonne/socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$shz_connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Giriş / kayıt: kaba kuvvet denemelerine karşı sıkı sınır (tam eşleşme, öncelikli)
    location = /schwarzesonne/api/auth/login {
        limit_req zone=shz_auth burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
    location = /schwarzesonne/api/auth/register {
        limit_req zone=shz_auth burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location ^~ /schwarzesonne/ {
        limit_req zone=shz_app burst=300 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    # Umbra Caelis kuralları: aynı uygulama, adres /umbracaelis altında kalır (server.ts eşler)
    location = /umbracaelis { return 301 /umbracaelis/kurallar; }
    location ^~ /umbracaelis/ {
        limit_req zone=shz_app burst=300 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    location / {
        try_files \$uri =404;
    }

    # Gizli dosyalar asla sunulmaz
    location ~ /\. { deny all; }
}
NGINX
ln -sfn /etc/nginx/sites-available/umbracaelis /etc/nginx/sites-enabled/umbracaelis
if ! grep -q "server_tokens off" /etc/nginx/nginx.conf; then
  sed -i 's/^\(\s*\)# *server_tokens off;/\1server_tokens off;/' /etc/nginx/nginx.conf || true
fi
nginx -t && systemctl reload nginx && info "nginx yeniden yüklendi"

# ---------------------------------------------------------------------------
bold "8/9 Güvenlik duvarı, fail2ban, otomatik güncellemeler"
SSH_PORTS="$(sshd -T 2>/dev/null | awk '/^port /{print $2}' | sort -u | tr '\n' ' ')"
SSH_PORTS="${SSH_PORTS:-22}"
SSH_PORT="$(echo "$SSH_PORTS" | awk '{print $1}')"
info "SSH portları: $SSH_PORTS"
ask "Bu SSH portları güvenlik duvarında açık kalacak. Doğru mu?" E || { warn "Güvenlik duvarı adımı atlandı"; SKIP_UFW=1; }
if [ -z "${SKIP_UFW:-}" ]; then
if ask "Mevcut güvenlik duvarı kuralları sıfırlanıp yalnızca gerekli portlar açılsın mı? (Bu sunucuda başka bir servis yoksa EVET)" E; then
  ufw --force reset >/dev/null
fi
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
for p in $SSH_PORTS; do ufw allow "$p"/tcp comment 'ssh' >/dev/null; done
if ask "80/443 portları yalnızca Cloudflare'e açılsın mı? (Önerilen: sunucunun IP'sine doğrudan erişim kapanır)" E; then
  for ip in $CF4 $CF6; do ufw allow proto tcp from "$ip" to any port 80,443 comment 'cloudflare' >/dev/null; done
  info "80/443 yalnızca Cloudflare IP'lerine açık"
else
  ufw allow 80,443/tcp >/dev/null
fi
ufw --force enable >/dev/null
info "ufw etkin"
fi

cat > /etc/fail2ban/jail.d/shz.local <<F2B
[sshd]
enabled = true
port = $(echo $SSH_PORTS | tr ' ' ',')
maxretry = 5
findtime = 10m
bantime = 1h
F2B
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban
info "fail2ban: SSH'ye 10 dakikada 5 hatalı denemede 1 saat yasak"

cat > /etc/apt/apt.conf.d/20auto-upgrades <<APT
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
info "Otomatik güvenlik güncellemeleri açık"

KEY_FILES="/root/.ssh/authorized_keys"
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then KEY_FILES="$KEY_FILES $(getent passwd "$SUDO_USER" | cut -d: -f6)/.ssh/authorized_keys"; fi
HAS_KEYS=""
for f in $KEY_FILES; do [ -s "$f" ] && HAS_KEYS=1; done
if [ -s /root/.ssh/authorized_keys ]; then
  echo
  info "root için kayıtlı SSH anahtarları:"
  awk '{print "     - " $NF}' /root/.ssh/authorized_keys
  warn "Eski GitHub deploy anahtarı burada olabilir. Yeni sistem root anahtarı KULLANMAZ; artık gerekmeyenleri /root/.ssh/authorized_keys içinden sil."
fi
if [ -n "$HAS_KEYS" ]; then
  if ask "SSH'de şifreyle girişi kapatıp yalnızca anahtarla girişe izin verilsin mi? (Kendi bilgisayarının anahtarıyla giriş yapabildiğinden emin değilsen HAYIR de!)" H; then
    cat > /etc/ssh/sshd_config.d/50-shz-hardening.conf <<SSHD
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
SSHD
    if sshd -t; then
      systemctl reload ssh 2>/dev/null || systemctl reload sshd
      info "SSH şifre girişi kapatıldı. Bu oturumu kapatmadan yeni bir terminalde anahtarla girişi dene."
    else
      rm -f /etc/ssh/sshd_config.d/50-shz-hardening.conf
      warn "sshd yapılandırma testi başarısız; değişiklik geri alındı"
    fi
  fi
else
  warn "SSH anahtarı bulunamadı; şifreyle giriş açık kalıyor (fail2ban koruyor). İleride anahtara geçmen önerilir."
fi

# ---------------------------------------------------------------------------
bold "9/9 Gece yedeği"
install -d -o postgres -g postgres -m 700 /var/backups/schwarzesonne
cat > /etc/cron.d/schwarzesonne-backup <<CRON
# Her gece 03:30'da veritabanı yedeği, 14 gün saklanır
30 3 * * * postgres pg_dump $DB_NAME | gzip > /var/backups/schwarzesonne/shz-\$(date +\\%F).sql.gz && find /var/backups/schwarzesonne -name '*.sql.gz' -mtime +14 -delete
CRON
chmod 644 /etc/cron.d/schwarzesonne-backup
info "Yedekler: /var/backups/schwarzesonne"

# ---------------------------------------------------------------------------
HOST_IP="$(curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
KNOWN="$HOST_IP $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
[ "$SSH_PORT" != "22" ] && KNOWN="[$HOST_IP]:$SSH_PORT $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"

bold "KURULUM TAMAM — şimdi GitHub'da şu ayarları yap"
cat <<TXT

  GitHub → depo → Settings → Secrets and variables → Actions → (New / Update) repository secret

  1) SSH_HOST          = $HOST_IP
  2) SSH_PORT          = $SSH_PORT
  3) SSH_KNOWN_HOSTS   = (aşağıdaki tek satır)
$KNOWN
TXT
if [ -n "$NEW_KEY" ]; then
  cat <<TXT
  4) SSH_PRIVATE_KEY   = (aşağıdaki BEGIN ile END dahil tüm blok — eski değerin yerine)
$NEW_KEY

  Bu anahtar yalnızca şimdi gösterilir ve sunucuda saklanmaz.
TXT
else
  echo "  4) SSH_PRIVATE_KEY   = daha önce üretilen deploy anahtarı (değiştirme)"
fi
cat <<TXT

  Sonra: GitHub → Actions → "Deploy" → "Run workflow" (ya da bir değişiklik push et).
  Deploy bitince ilk GM hesabını oluştur:

    sudo -u $DEPLOY_USER bash -lc 'cd $BASE/current && SHZ_ENV_FILE=$BASE/shared/.env npm run create-gm -- --username KULLANICI --name "Görünen Ad"'

  Durum ve loglar:
    systemctl status schwarzesonne
    journalctl -u schwarzesonne -n 100 --no-pager
TXT

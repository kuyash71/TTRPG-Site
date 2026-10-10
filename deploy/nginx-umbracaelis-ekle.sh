#!/usr/bin/env bash
# Mevcut sunucuya BİR KEZ, root olarak: umbracaelis.com/umbracaelis/ adreslerini uygulamaya yönlendirir.
# (Yeni kurulumlarda server-setup.sh bunu zaten yazar.) Tekrar çalıştırmak zararsızdır.
#   sudo bash nginx-umbracaelis-ekle.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "root olarak çalıştır: sudo bash $0"; exit 1; }
CONF=/etc/nginx/sites-available/umbracaelis
[ -f "$CONF" ] || { echo "nginx sitesi bulunamadı: $CONF"; exit 1; }
if grep -q "location \^~ /umbracaelis/" "$CONF"; then
  echo "Zaten ekli, değişiklik yok."
  exit 0
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -a "$CONF" "/root/nginx-umbracaelis-$STAMP.yedek"
BLOCK=$(cat <<'NGINX'
    # Umbra Caelis kuralları: aynı uygulama, adres /umbracaelis altında kalır (server.ts eşler)
    location = /umbracaelis { return 301 /umbracaelis/kurallar; }
    location ^~ /umbracaelis/ {
        limit_req zone=shz_app burst=300 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

NGINX
)
# "location / {" satırının (statik dosyalar) hemen önüne ekle.
BLOCK="$BLOCK" python3 - "$CONF" <<'PY'
import os, sys
p = sys.argv[1]
s = open(p).read()
key = "    location / {"
if key not in s:
    sys.exit("'location / {' satırı bulunamadı; elle eklemek gerekiyor.")
s = s.replace(key, os.environ["BLOCK"] + "\n" + key, 1)
open(p, "w").write(s)
PY
if nginx -t; then
  systemctl reload nginx
  echo "Tamam: https://umbracaelis.com/umbracaelis/kurallar (yedek: /root/nginx-umbracaelis-$STAMP.yedek)"
else
  cp -a "/root/nginx-umbracaelis-$STAMP.yedek" "$CONF"
  echo "nginx -t başarısız; eski ayar geri yüklendi."
  exit 1
fi

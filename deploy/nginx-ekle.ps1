# nginx-umbracaelis-ekle.sh betiğini sunucuya kopyalar ve orada çalıştırır (bir kez yeterli).
# Kullanım (PowerShell, TTRPG-Site klasöründe):  powershell -ExecutionPolicy Bypass -File deploy\nginx-ekle.ps1

$Sunucu = "root@204.168.160.198"
$Betik  = Join-Path $PSScriptRoot "nginx-umbracaelis-ekle.sh"

Write-Host "1/2 nginx-umbracaelis-ekle.sh sunucuya kopyalanıyor..."
scp $Betik "${Sunucu}:/root/nginx-umbracaelis-ekle.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "Kopyalama başarısız. Sunucu adresini ve şifreni kontrol et."; exit 1 }

Write-Host "2/2 Betik sunucuda çalıştırılıyor..."
ssh -t $Sunucu "bash /root/nginx-umbracaelis-ekle.sh"

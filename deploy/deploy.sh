#!/usr/bin/env bash
# Serverdə deploy (Ubuntu 22.04/24.04). Əvvəlcədən lokalda deploy/predeploy-check.ps1 yaşıl bitməlidir.
#
# Fərz olunur:
#   • publish/ və dist/ serverə /var/kiberaz/incoming/{publish,dist} kimi kopyalanıb
#     (Windows-dan: scp -r publish kiberaz-ui/dist user@server:/var/kiberaz/incoming/)
#   • deploy/kiberaz-api.service quraşdırılıb, /etc/kiberaz/api.env doldurulub
#   • nginx konfiqləri (deploy/nginx-api.conf.example, kiberaz-ui/deploy/nginx-spa.conf.example) aktivdir
#
# İstifadə: sudo bash deploy.sh          (ilk dəfə və hər yeniləmədə eynidir)
#           sudo bash deploy.sh rollback (əvvəlki release-ə qayıt)
set -euo pipefail

BASE=/var/kiberaz
APP=$BASE/app
RELEASES=$BASE/releases
INCOMING=$BASE/incoming
WWW=/var/www/kiberaz
STAMP=$(date +%Y%m%d-%H%M%S)

if [[ "${1:-}" == "rollback" ]]; then
  PREV=$(ls -1dt "$RELEASES"/api-* | sed -n 2p)
  [[ -n "$PREV" ]] || { echo "Əvvəlki release yoxdur"; exit 1; }
  echo "Rollback → $PREV"
  systemctl stop kiberaz-api
  ln -sfn "$PREV" "$APP"
  PREVDIST=$(ls -1dt "$RELEASES"/dist-* | sed -n 2p)
  [[ -n "$PREVDIST" ]] && ln -sfn "$PREVDIST" "$WWW/dist"
  systemctl start kiberaz-api
  systemctl reload nginx
  exit 0
fi

[[ -d $INCOMING/publish && -d $INCOMING/dist ]] || { echo "$INCOMING/publish və $INCOMING/dist lazımdır"; exit 1; }
[[ -f $INCOMING/publish/Kiberaz.Api.dll ]] || { echo "publish/Kiberaz.Api.dll yoxdur"; exit 1; }
[[ -f $INCOMING/publish/seed-data/quiz-questions.json ]] || { echo "publish/seed-data yoxdur"; exit 1; }
[[ ! -f $INCOMING/publish/appsettings.Development.json ]] || { echo "appsettings.Development.json publish-də qalıb — sil"; exit 1; }
[[ ! -f $INCOMING/publish/appsettings.Local.json ]] || { echo "appsettings.Local.json publish-də qalıb — sil"; exit 1; }

echo "== 1. Backup (DB + uploads + keys)"
mkdir -p "$BASE/backup"
tar -czf "$BASE/backup/pre-deploy-$STAMP.tgz" -C "$BASE" data uploads keys 2>/dev/null || true

echo "== 2. Yeni release"
mkdir -p "$RELEASES" "$WWW"
cp -r "$INCOMING/publish" "$RELEASES/api-$STAMP"
cp -r "$INCOMING/dist"    "$RELEASES/dist-$STAMP"
# wwwroot/uploads → daimi qovluğa symlink (redeploy silməsin)
mkdir -p "$BASE/uploads/photos" "$BASE/uploads/syllabus" "$RELEASES/api-$STAMP/wwwroot"
rm -rf "$RELEASES/api-$STAMP/wwwroot/uploads"
ln -sfn "$BASE/uploads" "$RELEASES/api-$STAMP/wwwroot/uploads"
chown -R kiberaz:kiberaz "$RELEASES/api-$STAMP" "$BASE/uploads" "$BASE/data" "$BASE/keys"

echo "== 3. API keçidi"
systemctl stop kiberaz-api || true
ln -sfn "$RELEASES/api-$STAMP" "$APP"
systemctl start kiberaz-api

echo "== 4. Sağlamlıq yoxlaması (30 s)"
ok=0
for i in $(seq 1 30); do
  if curl -fsS -H 'Host: api.kiberaz.az' http://127.0.0.1:5000/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [[ $ok -ne 1 ]]; then
  echo "API qalxmadı — loglar:"; journalctl -u kiberaz-api -n 40 --no-pager
  echo "Rollback: sudo bash deploy.sh rollback"; exit 1
fi

echo "== 5. SPA keçidi"
ln -sfn "$RELEASES/dist-$STAMP" "$WWW/dist"
nginx -t && systemctl reload nginx

echo "== 6. Köhnə release-lər (son 3 qalır)"
ls -1dt "$RELEASES"/api-*  | tail -n +4 | xargs -r rm -rf
ls -1dt "$RELEASES"/dist-* | tail -n +4 | xargs -r rm -rf
rm -rf "$INCOMING/publish" "$INCOMING/dist"

echo "== OK: api-$STAMP / dist-$STAMP canlıdır. Smoke test: docs/PRODUCTION-ROADMAP.md §5"

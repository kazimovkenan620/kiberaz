#!/usr/bin/env bash
# Gündəlik backup — LiteDB tək fayldır, amma İŞLƏYƏN tətbiqdən düz kopyalanan fayl zədəli ola bilər.
# LiteDB "Connection=shared" rejimində fayl yalnız əməliyyat anında kilidlənir; ən təhlükəsiz yol
# `cp --reflink`/rsync deyil, qısa dayanma və ya LiteDB-nin öz checkpoint-idir. Gecə trafiki az olduğu
# üçün burada 2–3 saniyəlik stop/start istifadə olunur (istifadəçilər yenidən daxil olmur — sessiya DB-dədir).
#
# Cron (root): 0 3 * * * /var/kiberaz/deploy/backup.sh >> /var/log/kiberaz/backup.log 2>&1
# Saxlama: 14 gün lokal; əlavə olaraq serverdən KƏNARA (rclone/scp) kopyalanmalıdır — I1: DB şifrəsizdir,
# backup şifrəli yerdə saxlanmalıdır (məs. `age`/`gpg` ilə).
set -euo pipefail
BASE=/var/kiberaz
OUT=$BASE/backup
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

systemctl stop kiberaz-api
tar -czf "$OUT/kiberaz-$STAMP.tgz" -C "$BASE" data keys uploads
systemctl start kiberaz-api

# Şifrələmə (age quraşdırılıbsa): age -r <public-key> -o "$OUT/kiberaz-$STAMP.tgz.age" "$OUT/kiberaz-$STAMP.tgz" && rm "$OUT/kiberaz-$STAMP.tgz"
find "$OUT" -name 'kiberaz-*.tgz*' -mtime +14 -delete
echo "$(date -Is) backup ok: $OUT/kiberaz-$STAMP.tgz ($(du -h "$OUT/kiberaz-$STAMP.tgz" | cut -f1))"

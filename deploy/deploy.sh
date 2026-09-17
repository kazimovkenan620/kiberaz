#!/usr/bin/env bash
# Ubuntu 24.04 / x86_64 / bir server. common.sh eyni qovluqda olmalıdır.
# Giriş: /var/kiberaz/incoming/{publish,dist}; lokal predeploy-check.ps1 əvvəlcə uğurlu olmalıdır.
# sudo bash /var/kiberaz/deploy/deploy.sh [rollback]
# Rollback yalnız kodu dəyişir; verilənlər bazasını avtomatik köhnə nüsxəyə qaytarmır.
set -euo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"
[[ $# -eq 0 || ( $# -eq 1 && "$1" == rollback ) ]] || die 'İstifadə: deploy.sh [rollback]'
initialize
for directory in "$RELEASES" "$INCOMING" "$WWW"; do real_directory "$directory"; done
chmod 0755 "$RELEASES" "$WWW"
chown root:root "$RELEASES" "$WWW"

# Köhnə təlimatın yaratdığı yalnız BOŞ app/dist qovluğunu təhlükəsiz düzəldir.
for destination in "$APP" "$WWW/dist"; do
  if [[ -e "$destination" && ! -L "$destination" ]]; then
    [[ -d "$destination" ]] && rmdir -- "$destination" || die "Dolu və ya uyğun olmayan yol qorundu: $destination"
  fi
done

OLD_RELEASE=
if [[ -L "$APP" || -L "$WWW/dist" ]]; then
  [[ -L "$APP" && -L "$WWW/dist" ]] || die 'Cari API və SPA keçidləri cüt deyil.'
  old_api=$(readlink -f -- "$APP")
  OLD_RELEASE=${old_api#"$RELEASES/api-"}
  validate_pair "$OLD_RELEASE"
  [[ "$old_api" == "$RELEASES/api-$OLD_RELEASE" && $(readlink -f -- "$WWW/dist") == "$RELEASES/dist-$OLD_RELEASE" ]] || die 'Cari API və SPA eyni release-ə aid deyil.'
elif [[ "$ORIGINAL_STATE" == active ]]; then
  die 'Aktiv API üçün release keçidi tapılmadı.'
fi

if [[ "${1:-}" == rollback ]]; then
  [[ -n "$OLD_RELEASE" && -f "$BASE/previous-release" && ! -L "$BASE/previous-release" ]] || die 'Saxlanmış əvvəlki release yoxdur.'
  TARGET=$(cat "$BASE/previous-release")
  validate_pair "$TARGET"
  [[ "$TARGET" != "$OLD_RELEASE" ]] || die 'Əvvəlki release cari release ilə eynidir.'
else
  [[ -d "$INCOMING/publish" && -d "$INCOMING/dist" ]] || die 'incoming/publish və incoming/dist lazımdır.'
  [[ -z $(find "$INCOMING/publish" "$INCOMING/dist" -type l -print -quit) ]] || die 'Incoming daxilində symlink qadağandır.'
  [[ -f "$INCOMING/publish/Kiberaz.Api.dll" && -f "$INCOMING/publish/Kiberaz.Api.runtimeconfig.json" ]] || die 'Publish natamamdır.'
  [[ -f "$INCOMING/publish/seed-data/quiz-questions.json" && -f "$INCOMING/dist/index.html" ]] || die 'Seed data və ya SPA index.html yoxdur.'
  [[ -z $(find "$INCOMING/publish" "$INCOMING/dist" \( -name 'appsettings.Local.json' -o -name 'appsettings.Development.json' -o -name '*.db' -o -name '.env' \) -print -quit) ]] || die 'Artefaktda lokal konfiqurasiya, sirr və ya DB faylı var.'
  TARGET=$STAMP
  [[ ! -e "$RELEASES/api-$TARGET" && ! -e "$RELEASES/dist-$TARGET" ]] || die 'Release identifikatoru artıq mövcuddur.'
  cp -a -- "$INCOMING/publish" "$RELEASES/api-$TARGET"
  cp -a -- "$INCOMING/dist" "$RELEASES/dist-$TARGET"
  mkdir -p "$RELEASES/api-$TARGET/wwwroot"
  real_directory "$BASE/uploads/photos"
  real_directory "$BASE/uploads/syllabus"
  # Fayllar varsa silmək əvəzinə dayanır; daimi upload-lar yalnız BASE/uploads-dadır.
  if [[ -d "$RELEASES/api-$TARGET/wwwroot/uploads" ]]; then
    find "$RELEASES/api-$TARGET/wwwroot/uploads" -depth -type d -empty -delete
  fi
  [[ ! -e "$RELEASES/api-$TARGET/wwwroot/uploads" ]] || die 'Publish upload məlumatı daşıyır; avtomatik silinmədi.'
  chown -R root:kiberaz "$RELEASES/api-$TARGET"
  chmod -R u=rwX,g=rX,o= "$RELEASES/api-$TARGET"
  chown -R root:root "$RELEASES/dist-$TARGET"
  chmod -R u=rwX,go=rX "$RELEASES/dist-$TARGET"
  chown kiberaz:kiberaz "$BASE/uploads/photos" "$BASE/uploads/syllabus"
  chmod 0750 "$BASE/uploads/photos" "$BASE/uploads/syllabus"
  ln -s -- "$BASE/uploads" "$RELEASES/api-$TARGET/wwwroot/uploads"
  validate_pair "$TARGET"
fi

# Konfiqurasiya səhvi API-ni dayandırmaz.
nginx -t
TOUCHED=0
SWITCHED=0
finish() {
  local result=$? recovered=1
  trap - EXIT INT TERM
  set +e
  cleanup_temporary_files
  rm -f -- "$APP.next.$$" "$WWW/dist.next.$$" "$BASE/previous-release.next.$$"
  if [[ "$result" != 0 && "$TOUCHED" == 1 ]]; then
    printf 'Deploy uğursuzdur; əvvəlki vəziyyət bərpa edilir.\n' >&2
    systemctl stop "$SERVICE" || recovered=0
    if [[ "$SWITCHED" == 1 ]]; then
      if [[ -n "$OLD_RELEASE" ]]; then
        atomic_link "$RELEASES/api-$OLD_RELEASE" "$APP" || recovered=0
        atomic_link "$RELEASES/dist-$OLD_RELEASE" "$WWW/dist" || recovered=0
      else
        rm -f -- "$APP" "$WWW/dist" || recovered=0
      fi
    fi
    if [[ "$ORIGINAL_STATE" == active ]]; then
      systemctl start "$SERVICE" && health_check || recovered=0
    fi
    if [[ "$recovered" == 1 ]]; then
      printf 'Əvvəlki API/SPA və servis vəziyyəti bərpa edildi.\n' >&2
    else
      printf 'XƏTA: bərpa tam təsdiqlənmədi. journalctl -u kiberaz-api ilə yoxlayın.\n' >&2
    fi
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

TOUCHED=1
stop_api
offline_backup pre-deploy
SWITCHED=1
atomic_link "$RELEASES/api-$TARGET" "$APP"
systemctl start "$SERVICE"
health_check || die 'API dəqiq 200/status=ok cavabı vermədi.'
atomic_link "$RELEASES/dist-$TARGET" "$WWW/dist"
systemctl reload nginx
if [[ -n "$OLD_RELEASE" ]]; then
  printf '%s\n' "$OLD_RELEASE" > "$BASE/previous-release.next.$$"
  mv -Tf -- "$BASE/previous-release.next.$$" "$BASE/previous-release"
fi
echo "OK: api-$TARGET / dist-$TARGET canlıdır."
# Cari/əvvəlki release və uğursuz staging avtomatik silinmir; ayrıca nəzərdən keçirilib təmizlənir.
# incoming saxlanır; növbəti upload-dan əvvəl operator onu təmiz bir staging qovluğu ilə əvəz edir.

#!/usr/bin/env bash
# deploy.sh və backup.sh üçün sabit yollar, kilid və dayanmış bazanın arxivi.
set -euo pipefail
BASE=/var/kiberaz
WWW=/var/www/kiberaz
APP=$BASE/app
RELEASES=$BASE/releases
INCOMING=$BASE/incoming
OUT=$BASE/backup
SERVICE=kiberaz-api
STAMP=$(date -u +%Y%m%dT%H%M%SZ)-$$
PARTIAL=
HEALTH_BODY=

die() { printf 'XƏTA: %s\n' "$*" >&2; exit 1; }

real_directory() {
  [[ ! -L "$1" && $(realpath -m -- "$1") == "$1" ]] || die "Təhlükəli qovluq yolu: $1"
  mkdir -p -- "$1"
  [[ -d "$1" ]] || die "Qovluq deyil: $1"
}

initialize() {
  [[ $(id -u) == 0 ]] || die 'Skripti sudo bash ilə başladın.'
  [[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || die 'Bu skript Linux x86_64 serveri üçündür.'
  umask 077
  local command directory
  for command in flock realpath systemctl tar curl nginx; do
    command -v "$command" >/dev/null || die "Tələb olunan əmr yoxdur: $command"
  done
  real_directory "$BASE"
  [[ ! -L "$BASE/.maintenance.lock" ]] || die 'Kilid faylı symlink ola bilməz.'
  exec 9> "$BASE/.maintenance.lock"
  flock -n 9 || die 'Başqa deploy və ya backup işləyir.'
  for directory in "$OUT" "$BASE/data" "$BASE/keys" "$BASE/uploads" "$BASE/runtime"; do
    real_directory "$directory"
  done
  chmod 0755 "$BASE"
  chmod 0700 "$OUT" "$BASE/data" "$BASE/keys" "$BASE/runtime"
  chmod 0750 "$BASE/uploads"
  chown root:root "$BASE" "$OUT"
  chown kiberaz:kiberaz "$BASE/data" "$BASE/keys" "$BASE/uploads" "$BASE/runtime"
  ORIGINAL_STATE=$(systemctl show "$SERVICE" --property=ActiveState --value)
  case "$ORIGINAL_STATE" in active|inactive|failed) ;; *) die "Servis keçid vəziyyətindədir: $ORIGINAL_STATE" ;; esac
}

stop_api() {
  systemctl stop "$SERVICE"
  [[ $(systemctl show "$SERVICE" --property=ActiveState --value) == inactive ]] || die 'API tam dayanmadı; backup edilmədi.'
}

health_check() {
  local code attempt
  HEALTH_BODY=$(mktemp "$BASE/.health.XXXXXXXX")
  for ((attempt=0; attempt<30; attempt++)); do
    # Yalnız etibarlı loopback proxy başlıqları; redirect uğurlu health hesab olunmur.
    code=$(curl --silent --show-error --noproxy '*' --connect-timeout 2 --max-time 3 \
      -H 'Host: api.kiberaz.az' -H 'X-Forwarded-Proto: https' \
      --output "$HEALTH_BODY" --write-out '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null) || code=000
    if [[ "$code" == 200 && $(tr -d '[:space:]' < "$HEALTH_BODY") == '{"status":"ok"}' ]]; then
      rm -f -- "$HEALTH_BODY"
      HEALTH_BODY=
      return 0
    fi
    sleep 1
  done
  rm -f -- "$HEALTH_BODY"
  HEALTH_BODY=
  return 1
}

offline_backup() {
  local prefix=$1
  [[ $(systemctl show "$SERVICE" --property=ActiveState --value) == inactive ]] || die 'Canlı bazadan arxiv alınmır.'
  PARTIAL=$(mktemp "$OUT/.$prefix-$STAMP.XXXXXXXX.partial")
  tar -czf "$PARTIAL" -C "$BASE" data keys uploads
  tar -tzf "$PARTIAL" >/dev/null
  mv -T -- "$PARTIAL" "$OUT/$prefix-$STAMP.tgz"
  PARTIAL=
  printf 'Backup: %s\n' "$OUT/$prefix-$STAMP.tgz"
}

cleanup_temporary_files() {
  [[ -z "$PARTIAL" ]] || rm -f -- "$PARTIAL"
  [[ -z "$HEALTH_BODY" ]] || rm -f -- "$HEALTH_BODY"
}

valid_release_id() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,63}$ ]]; }

validate_pair() {
  local release=$1 directory
  valid_release_id "$release" || die 'Release identifikatoru etibarsızdır.'
  for directory in "$RELEASES/api-$release" "$RELEASES/dist-$release"; do
    [[ -d "$directory" && ! -L "$directory" && $(realpath -- "$directory") == "$directory" ]] || die "Release qovluğu təhlükəsiz deyil: $directory"
  done
  [[ -f "$RELEASES/api-$release/Kiberaz.Api.dll" && -f "$RELEASES/dist-$release/index.html" ]] || die 'API/SPA release cütü natamamdır.'
}

atomic_link() {
  local target=$1 destination=$2 temporary=$2.next.$$
  [[ ! -e "$temporary" && ! -L "$temporary" ]] || { printf 'Müvəqqəti keçid artıq mövcuddur: %s\n' "$temporary" >&2; return 1; }
  ln -s -- "$target" "$temporary" || return 1
  mv -Tf -- "$temporary" "$destination"
}

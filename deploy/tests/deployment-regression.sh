#!/usr/bin/env bash
# Real fayl/symlink/arxiv əməliyyatları; yalnız systemd, nginx və HTTP sərhədləri imitasiya olunur.
set -euo pipefail
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ROOT=$(mktemp -d /tmp/kiberaz-deploy-tests.XXXXXXXX)
ROOT=$(realpath -- "$ROOT")
cleanup() {
  [[ "$ROOT" == /tmp/kiberaz-deploy-tests.* && -d "$ROOT" && ! -L "$ROOT" ]] || return 1
  rm -rf -- "$ROOT"
}
trap cleanup EXIT
mkdir -p "$ROOT/bin"
REAL_TAR=$(command -v tar)
export REAL_TAR
cat > "$ROOT/bin/systemctl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  show) cat "$TEST_CASE/state" ;;
  is-active) [[ $(cat "$TEST_CASE/state") == active ]] ;;
  stop) echo inactive > "$TEST_CASE/state" ;;
  start) [[ ! -f "$TEST_CASE/start-fail" ]] || exit 95; echo active > "$TEST_CASE/state" ;;
  reload) [[ ! -f "$TEST_CASE/reload-fail" ]] ;;
  *) exit 91 ;;
esac
MOCK
cat > "$ROOT/bin/tar" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == -czf ]]; then
  [[ $(cat "$TEST_CASE/state") == inactive ]] || { echo 'Canlı bazadan backup qadağandır' >&2; exit 93; }
  [[ ! -f "$TEST_CASE/tar-fail" ]] || exit 94
fi
exec "$REAL_TAR" "$@"
MOCK
cat > "$ROOT/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
out= host= proto=
while (($#)); do
  case "$1" in
    -o|--output) out=$2; shift 2 ;;
    -H|--header)
      [[ "$2" == 'Host: api.kiberaz.az' ]] && host=yes
      [[ "$2" == 'X-Forwarded-Proto: https' ]] && proto=yes
      shift 2 ;;
    *) shift ;;
  esac
done
[[ -n "$out" && "$host" == yes && "$proto" == yes ]] || exit 92
[[ $(cat "$TEST_CASE/state") == active ]] || exit 7
if [[ -f "$TEST_CASE/redirect" ]]; then printf '307'; printf 'redirect' > "$out"
elif [[ $(cat "$TEST_CASE/base/app/Kiberaz.Api.dll") == bad ]]; then printf '503'; printf '{}' > "$out"
elif [[ -f "$TEST_CASE/bad-body" ]]; then printf '200'; printf '<html>wrong app</html>' > "$out"
else printf '200'; printf '{"status":"ok"}' > "$out"
fi
MOCK
cat > "$ROOT/bin/nginx" <<'MOCK'
#!/usr/bin/env bash
[[ "$1" == -t && ! -f "$TEST_CASE/nginx-fail" ]]
MOCK
printf '#!/usr/bin/env bash\nexit 0\n' > "$ROOT/bin/chown"
printf '#!/usr/bin/env bash\nexit 0\n' > "$ROOT/bin/sleep"
printf '#!/usr/bin/env bash\nprintf "0\\n"\n' > "$ROOT/bin/id"
chmod +x "$ROOT/bin/"*
export PATH="$ROOT/bin:$PATH"

setup() {
  TEST_CASE="$ROOT/$1"
  export TEST_CASE
  mkdir -p "$TEST_CASE/scripts" "$TEST_CASE/base/"{data,keys,uploads,backup,incoming,releases} "$TEST_CASE/www"
  echo inactive > "$TEST_CASE/state"
  printf 'database fixture' > "$TEST_CASE/base/data/Kiberaz.db"
  # Yalnız test nüsxələrində sabit yollar dəyişir; production skriptləri parametr qəbul etmir.
  local file
  for file in deploy.sh backup.sh common.sh; do
    [[ -f "$SOURCE/$file" ]] || continue
    sed -e "s|^BASE=/var/kiberaz$|BASE=$TEST_CASE/base|" -e "s|^WWW=/var/www/kiberaz$|WWW=$TEST_CASE/www|" "$SOURCE/$file" > "$TEST_CASE/scripts/$file"
  done
}
incoming() {
  mkdir -p "$TEST_CASE/base/incoming/publish/seed-data" "$TEST_CASE/base/incoming/dist"
  printf '%s' "${1:-good}" > "$TEST_CASE/base/incoming/publish/Kiberaz.Api.dll"
  printf '{}' > "$TEST_CASE/base/incoming/publish/Kiberaz.Api.runtimeconfig.json"
  printf '[]' > "$TEST_CASE/base/incoming/publish/seed-data/quiz-questions.json"
  printf '%s' "${2:-new spa}" > "$TEST_CASE/base/incoming/dist/index.html"
}
existing() {
  local name=$1
  mkdir -p "$TEST_CASE/base/releases/api-$name" "$TEST_CASE/base/releases/dist-$name"
  printf good > "$TEST_CASE/base/releases/api-$name/Kiberaz.Api.dll"
  printf '%s' "$name" > "$TEST_CASE/base/releases/dist-$name/index.html"
  ln -s "$TEST_CASE/base/releases/api-$name" "$TEST_CASE/base/app"
  ln -s "$TEST_CASE/base/releases/dist-$name" "$TEST_CASE/www/dist"
  echo active > "$TEST_CASE/state"
}
run_deploy() { bash "$TEST_CASE/scripts/deploy.sh" "$@" > "$TEST_CASE/output" 2>&1; }
run_backup() { bash "$TEST_CASE/scripts/backup.sh" > "$TEST_CASE/output" 2>&1; }
expect_failure() { if "$@"; then echo 'XƏTA: əməliyyat rədd edilməli idi' >&2; cat "$TEST_CASE/output" >&2; return 1; fi; }
assert() { if ! "$@"; then echo "XƏTA: $*" >&2; cat "$TEST_CASE/output" >&2; return 1; fi; }

backup_failure_restores_service() {
  setup backup-failure
  existing 20260916-120000
  touch "$TEST_CASE/tar-fail"
  expect_failure run_backup
  assert test "$(cat "$TEST_CASE/state")" = active
  assert test -z "$(find "$TEST_CASE/base/backup" -type f -name '*.tgz')"
}
backup_preserves_inactive_state() {
  setup backup-inactive
  run_backup
  assert test "$(cat "$TEST_CASE/state")" = inactive
  local archive
  archive=$(find "$TEST_CASE/base/backup" -name '*.tgz')
  assert test -n "$archive"
  assert "$REAL_TAR" -tzf "$archive" data/Kiberaz.db
}
first_deploy_migrates_empty_directory() {
  setup first-deploy
  mkdir "$TEST_CASE/base/app"
  incoming
  run_deploy
  assert test -L "$TEST_CASE/base/app"
  assert test -L "$TEST_CASE/www/dist"
  assert test "$(cat "$TEST_CASE/base/app/Kiberaz.Api.dll")" = good
  assert test "$(cat "$TEST_CASE/www/dist/index.html")" = 'new spa'
  assert test "$(readlink -f "$TEST_CASE/base/app/wwwroot/uploads")" = "$TEST_CASE/base/uploads"
  assert test "$(cat "$TEST_CASE/base/data/Kiberaz.db")" = 'database fixture'
}
deploy_backup_failure_keeps_pair() {
  setup deploy-backup-failure
  existing 20260916-120000
  incoming
  touch "$TEST_CASE/tar-fail"
  expect_failure run_deploy
  assert test "$(readlink "$TEST_CASE/base/app")" = "$TEST_CASE/base/releases/api-20260916-120000"
  assert test "$(cat "$TEST_CASE/www/dist/index.html")" = 20260916-120000
  assert test "$(cat "$TEST_CASE/state")" = active
}
unhealthy_release_restores_pair() {
  setup unhealthy
  existing 20260916-120000
  incoming bad
  expect_failure run_deploy
  assert test "$(readlink "$TEST_CASE/base/app")" = "$TEST_CASE/base/releases/api-20260916-120000"
  assert test "$(cat "$TEST_CASE/www/dist/index.html")" = 20260916-120000
  assert test "$(cat "$TEST_CASE/state")" = active
}
first_deploy_rejects_false_health() {
  local response
  for response in redirect bad-body; do
    setup "health-$response"
    incoming
    touch "$TEST_CASE/$response"
    expect_failure run_deploy
    assert test ! -e "$TEST_CASE/base/app"
    assert test ! -e "$TEST_CASE/www/dist"
    assert test "$(cat "$TEST_CASE/state")" = inactive
  done
}
rollback_uses_saved_pair() {
  setup rollback
  existing 20260916-120000
  incoming
  run_deploy
  # Son yaradılmış qovluq uğursuz staging ola bilər; rollback mtime-a baxmamalıdır.
  mkdir "$TEST_CASE/base/releases/api-20990101-000000" "$TEST_CASE/base/releases/dist-20990101-000000"
  run_deploy rollback
  assert test "$(readlink "$TEST_CASE/base/app")" = "$TEST_CASE/base/releases/api-20260916-120000"
  assert test "$(cat "$TEST_CASE/www/dist/index.html")" = 20260916-120000
  assert test "$(cat "$TEST_CASE/state")" = active
}
nonempty_directory_is_preserved() {
  setup occupied-app
  mkdir "$TEST_CASE/base/app"
  printf 'keep me' > "$TEST_CASE/base/app/user-data"
  incoming
  expect_failure run_deploy
  assert test "$(cat "$TEST_CASE/base/app/user-data")" = 'keep me'
}
symlink_escape_is_rejected() {
  setup symlink-escape
  incoming
  mkdir "$TEST_CASE/outside"
  ln -s "$TEST_CASE/outside" "$TEST_CASE/base/incoming/publish/escape"
  expect_failure run_deploy
  assert test ! -e "$TEST_CASE/base/app"
}
nginx_reload_failure_restores_pair() {
  setup nginx-reload-failure
  existing 20260916-120000
  incoming
  touch "$TEST_CASE/reload-fail"
  expect_failure run_deploy
  assert test "$(readlink "$TEST_CASE/base/app")" = "$TEST_CASE/base/releases/api-20260916-120000"
  assert test "$(cat "$TEST_CASE/www/dist/index.html")" = 20260916-120000
  assert test "$(cat "$TEST_CASE/state")" = active
}
unhealthy_rollback_restores_current_pair() {
  setup unhealthy-rollback
  existing 20260916-120000
  incoming
  run_deploy
  local current
  current=$(readlink "$TEST_CASE/base/app")
  printf bad > "$TEST_CASE/base/releases/api-20260916-120000/Kiberaz.Api.dll"
  expect_failure run_deploy rollback
  assert test "$(readlink "$TEST_CASE/base/app")" = "$current"
  assert test "$(cat "$TEST_CASE/www/dist/index.html")" = 'new spa'
  assert test "$(cat "$TEST_CASE/state")" = active
}
backup_reports_restart_failure() {
  setup backup-start-failure
  existing 20260916-120000
  touch "$TEST_CASE/start-fail"
  expect_failure run_backup
  assert test -n "$(find "$TEST_CASE/base/backup" -type f -name '*.tgz')"
}
maintenance_lock_blocks_backup() {
  setup concurrent-backup
  existing 20260916-120000
  exec 8> "$TEST_CASE/base/.maintenance.lock"
  flock -n 8
  expect_failure run_backup
  assert test "$(cat "$TEST_CASE/state")" = active
  assert test -z "$(find "$TEST_CASE/base/backup" -type f -name '*.tgz')"
  exec 8>&-
}
unsafe_persistent_directory_is_rejected() {
  setup unsafe-data
  mv "$TEST_CASE/base/data" "$TEST_CASE/outside-data"
  ln -s "$TEST_CASE/outside-data" "$TEST_CASE/base/data"
  expect_failure run_backup
  assert test "$(cat "$TEST_CASE/outside-data/Kiberaz.db")" = 'database fixture'
}
tests=(backup_failure_restores_service backup_preserves_inactive_state first_deploy_migrates_empty_directory deploy_backup_failure_keeps_pair unhealthy_release_restores_pair first_deploy_rejects_false_health rollback_uses_saved_pair nonempty_directory_is_preserved symlink_escape_is_rejected nginx_reload_failure_restores_pair unhealthy_rollback_restores_current_pair backup_reports_restart_failure maintenance_lock_blocks_backup unsafe_persistent_directory_is_rejected)
for test_name in "${tests[@]}"; do
  [[ -z "${1:-}" || "$1" == "$test_name" ]] || continue
  "$test_name"
  printf 'PASS %s\n' "$test_name"
done

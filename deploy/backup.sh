#!/usr/bin/env bash
# LiteDB, açarlar və upload-lar API dayandırıldıqdan sonra arxivlənir.
# Root cron: 0 3 * * * /bin/bash /var/kiberaz/deploy/backup.sh >> /var/log/kiberaz/backup.log 2>&1
# Arxivlər root:root / 0600-dür. Ayrıca şifrəli off-server nüsxə saxlayın.
set -euo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"
initialize
TOUCHED=0

finish() {
  local result=$?
  trap - EXIT INT TERM
  set +e
  cleanup_temporary_files
  if [[ "$TOUCHED" == 1 && "$ORIGINAL_STATE" == active ]]; then
    if ! systemctl start "$SERVICE" || ! health_check; then
      printf 'XƏTA: backup-dan sonra API sağlamlığı təsdiqlənmədi. journalctl -u kiberaz-api\n' >&2
      result=1
    fi
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

TOUCHED=1
stop_api
offline_backup kiberaz
# Yalnız uğurlu arxivdən sonra köhnə gündəlik nüsxələr silinir; pre-deploy arxivləri saxlanır.
find "$OUT" -maxdepth 1 -type f -name 'kiberaz-*.tgz' -mtime +14 -delete
echo 'Backup tamamlandı.'

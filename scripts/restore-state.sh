#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_FILE="${1:-}"
DATA_FILE="${YATRIBUS_DATA_FILE:-./data/yatribus-state.json}"

if [[ -z "$BACKUP_FILE" || ! -s "$BACKUP_FILE" ]]; then
  echo "Usage: YATRIBUS_CONFIRM_STOPPED=YES $0 <backup.json.gz>" >&2
  exit 2
fi
if [[ "${YATRIBUS_CONFIRM_STOPPED:-}" != "YES" ]]; then
  echo "ERROR: stop the YatraBus backend first, then set YATRIBUS_CONFIRM_STOPPED=YES." >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE.sha256" ]]; then
  echo "ERROR: matching .sha256 checksum file is required." >&2
  exit 1
fi

( cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256" )

tmp_file="$DATA_FILE.restore.tmp"
mkdir -p "$(dirname "$DATA_FILE")"
gzip -t "$BACKUP_FILE"
gzip -dc "$BACKUP_FILE" | node --input-type=commonjs -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const value = JSON.parse(input);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("root must be an object");
  } catch (error) {
    console.error("ERROR: backup JSON is invalid:", error.message);
    process.exit(1);
  }
});
'
gzip -dc "$BACKUP_FILE" > "$tmp_file"
chmod 600 "$tmp_file"
mv "$tmp_file" "$DATA_FILE"
echo "Restore completed: $DATA_FILE"
echo "Start the backend and verify GET /health and the Super Admin review queue."

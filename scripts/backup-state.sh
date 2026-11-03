#!/usr/bin/env bash
set -euo pipefail
umask 077

DATA_FILE="${YATRIBUS_DATA_FILE:-./data/yatribus-state.json}"
BACKUP_DIR="${YATRIBUS_BACKUP_DIR:-./backups}"

if [[ ! -s "$DATA_FILE" ]]; then
  echo "ERROR: state file is missing or empty: $DATA_FILE" >&2
  exit 1
fi

# Refuse to archive corrupt state.
node --input-type=commonjs - "$DATA_FILE" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
try {
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('root must be an object');
} catch (error) {
  console.error('ERROR: state file is not valid JSON:', error.message);
  process.exit(1);
}
NODE

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/yatribus-state-$timestamp.json.gz"
tmp_file="$backup_file.tmp"

gzip -n -c "$DATA_FILE" > "$tmp_file"
mv "$tmp_file" "$backup_file"
chmod 600 "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
chmod 600 "$backup_file.sha256"

echo "Backup created: $backup_file"
echo "Checksum: $backup_file.sha256"

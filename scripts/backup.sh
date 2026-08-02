#!/bin/bash
# ============================================================
# West Yorkshire Carpets — Database Backup Script
#
# Rewritten 2 Aug 2026 — the previous version copied a local SQLite file
# (data/wyc_leads.db) that hasn't existed since SQLite was removed from
# this project on 10 Jul 2026 (see MASTER_CHECKLIST.md 0.5-A). This
# version pg_dumps the real Postgres database instead. Also no longer
# hardcodes one developer's machine path — everything is relative to
# this script's own location, so it works wherever the repo is checked
# out.
#
# Requires: the `pg_dump` command-line tool (part of the PostgreSQL
# client tools — on macOS: `brew install libpq` or the full postgresql
# package; on most Linux distros: `apt install postgresql-client`).
# Requires: a .env file in the repo root with PGHOST/PGPORT/PGDATABASE/
# PGUSER/PGPASSWORD set — same variables the app itself uses, since
# pg_dump reads these from the environment automatically.
# ============================================================

set -euo pipefail

# Resolve paths relative to this script, not to wherever it's invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env"
BACKUP_DIR="$REPO_ROOT/backups"

if ! command -v pg_dump >/dev/null 2>&1; then
    echo "✗ pg_dump not found. Install the PostgreSQL client tools first" \
         "(macOS: brew install libpq; Linux: apt install postgresql-client)." >&2
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "✗ No .env file found at $ENV_FILE — copy .env.example and fill it in first." >&2
    exit 1
fi

# Load PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD (and anything else in
# .env) into the environment, the same variables the app itself reads —
# pg_dump picks these up automatically, no need to pass them as flags.
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [ -z "${PGHOST:-}" ] || [ -z "${PGDATABASE:-}" ] || [ -z "${PGUSER:-}" ]; then
    echo "✗ PGHOST/PGDATABASE/PGUSER not set — check $ENV_FILE." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/wyc_${PGDATABASE}_${DATE}.sql.gz"

echo "Backing up $PGDATABASE@$PGHOST..."
if pg_dump --no-owner --no-privileges | gzip > "$BACKUP_FILE"; then
    echo "✓ Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "✗ Backup FAILED" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Delete backups older than 30 days to save disk space
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "✓ Old backups cleaned up"

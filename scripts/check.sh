#!/bin/bash
# ============================================================
# West Yorkshire Carpets — Security & Setup Checklist
#
# Rewritten 2 Aug 2026 — the previous version checked for a `data/`
# directory and a SQLite database that haven't existed since SQLite was
# removed on 10 Jul 2026 (see MASTER_CHECKLIST.md 0.5-A), and its
# backup.sh existence check looked in the wrong directory (checked for
# ./backup.sh in the repo root; the real file has always been at
# scripts/backup.sh — this would have failed even before the SQLite
# rewrite). Also no longer hardcodes one developer's machine path.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT" || exit 1

echo "=== Security & Setup Checklist ==="

if [ ! -f .env ]; then
    echo "❌ .env file MISSING — copy .env.example and fill it in"
else
    echo "✅ .env exists"
    # The variables that actually matter for the app to run correctly.
    for var in JWT_SECRET PGHOST PGDATABASE PGUSER PGPASSWORD; do
        val=$(grep "^${var}=" .env | cut -d'=' -f2-)
        if [ -z "$val" ]; then
            echo "❌ $var not set in .env"
        else
            echo "✅ $var set (${#val} chars)"
        fi
    done
    # Confirmed unused in code (grepped, zero hits) but harmless to note if present —
    # see README.md's Environment Variables Reference for why these do nothing.
    for var in SESSION_SECRET ADMIN_TOKEN; do
        val=$(grep "^${var}=" .env | cut -d'=' -f2-)
        [ -n "$val" ] && echo "ℹ️  $var is set but unused by the app (harmless)"
    done
fi

[ -f .gitignore ] && echo "✅ .gitignore exists" || echo "❌ .gitignore MISSING"
grep -q "^\.env$" .gitignore && echo "✅ .env protected by .gitignore" || echo "❌ .env NOT protected by .gitignore"
grep -q "^backups/$" .gitignore && echo "✅ backups/ protected by .gitignore" || echo "⚠️  backups/ not in .gitignore — add it if scripts/backup.sh has been run"

[ -f scripts/backup.sh ] && echo "✅ scripts/backup.sh exists" || echo "❌ scripts/backup.sh MISSING"
[ -x scripts/backup.sh ] && echo "✅ scripts/backup.sh is executable" || echo "⚠️  scripts/backup.sh is not executable — run: chmod +x scripts/backup.sh"

grep -q "CHANGE_ME" .env 2>/dev/null && echo "❌ CHANGE_ME placeholder found in .env!" || echo "✅ No CHANGE_ME placeholders in .env"

echo "=== Done ==="

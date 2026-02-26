#!/bin/bash
# ============================================================
# West Yorkshire Carpets — Database Backup Script
# Runs automatically via cron. Keeps last 30 days of backups.
# ============================================================

# Where your database lives
DB_PATH="/Users/potencial/Desktop/project/wyc-backend/data/wyc_leads.db"

# Where backups are saved
BACKUP_DIR="/Users/potencial/Desktop/project/wyc-backend/data/backups"

# Create backup folder if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup filename with today's date
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/wyc_leads_$DATE.db"

# Copy the database file
cp "$DB_PATH" "$BACKUP_FILE"

# Confirm it worked
if [ -f "$BACKUP_FILE" ]; then
    echo "✓ Backup created: $BACKUP_FILE"
else
    echo "✗ Backup FAILED"
    exit 1
fi

# Delete backups older than 30 days to save disk space
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
echo "✓ Old backups cleaned up"

#!/usr/bin/env bash
set -euo pipefail

# DocFlow Backup Script
# Backs up PostgreSQL database and uploaded files
# Usage: ./backup.sh [output_dir]
# Recommended cron: 0 2 * * * /opt/docflow/infra/backup.sh /backups

BACKUP_DIR="${1:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

DB_USER="${DB_USER:-docflow}"
DB_NAME="${DB_NAME:-docflow}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"

mkdir -p "$BACKUP_DIR"

echo "=== DocFlow Backup $(date) ==="

# Database backup
DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
echo "Backing up database to $DB_FILE..."
PGPASSWORD="${DB_PASSWORD:-docflow}" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl | gzip > "$DB_FILE"
echo "  Database backup: $(du -sh "$DB_FILE" | cut -f1)"

# Uploads backup
if [ -d "$UPLOADS_DIR" ]; then
  UPLOADS_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
  echo "Backing up uploads to $UPLOADS_FILE..."
  tar -czf "$UPLOADS_FILE" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  echo "  Uploads backup: $(du -sh "$UPLOADS_FILE" | cut -f1)"
fi

# Cleanup old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

# List remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "db_*.sql.gz" | wc -l)
echo "  Remaining backups: $BACKUP_COUNT"

echo "=== Backup complete ==="

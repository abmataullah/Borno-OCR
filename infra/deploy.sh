#!/usr/bin/env bash
set -euo pipefail

echo "=== DocFlow Deployment ==="

# Check .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.production.example to .env and fill in values."
  exit 1
fi

# Build and start
echo "Building images..."
docker compose -f docker-compose.prod.yml build

echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for backend
echo "Waiting for backend..."
sleep 10

# Run schema push
echo "Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend npx drizzle-kit push --force

# Run manual SQL migrations
echo "Running SQL migrations..."
for f in backend/drizzle/*.sql; do
  echo "  Applying $f..."
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U "${DB_USER:-docflow}" -d "${DB_NAME:-docflow}" < "$f" || true
done

# Health check
echo "Verifying health..."
sleep 5
if curl -sf http://localhost/health > /dev/null 2>&1; then
  echo "  Health check: OK"
else
  echo "  WARNING: Health check failed — check logs"
fi

echo "=== Deployment complete ==="
echo "Frontend: http://localhost"
echo "Backend:  http://localhost/api/health"
echo ""
echo "To set up backups, add to crontab:"
echo "  0 2 * * * /opt/docflow/infra/backup.sh /backups"

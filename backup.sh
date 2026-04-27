#!/bin/bash
set -e
LOG_FILE="./backup/export_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1
# ======================
# CONFIG
# ======================
PG_HOST="localhost"
PG_PORT="5433"
PG_ADMIN_USER="speedlimit"
MASTER_DB="speedlimit"
BACKUP_DIR="./backup"

# ======================
# PREPARE DIRS
# ======================
mkdir -p \
  $BACKUP_DIR/master \
  $BACKUP_DIR/roles \
  $BACKUP_DIR/companies

echo "🚀 Starting full SaaS export..."

# ======================
# 1️⃣ EXPORT MASTER DB
# ======================
echo "📦 Exporting master DB (Tenant + Company)..."

pg_dump "postgresql://$PG_ADMIN_USER@$PG_HOST:$PG_PORT/$MASTER_DB" \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  > "$BACKUP_DIR/master/master_data.sql"

# ======================
# 2️⃣ EXPORT COMPANY ROLES
# ======================
echo "👤 Exporting company users (roles)..."

pg_dumpall \
  --roles-only \
  --username=$PG_ADMIN_USER \
  --host=$PG_HOST \
  --port=$PG_PORT \
  > "$BACKUP_DIR/roles/company_roles.sql"

# ======================
# 3️⃣ EXPORT EACH COMPANY DB
# ======================
echo "🏢 Exporting company databases..."

psql "postgresql://$PG_ADMIN_USER@$PG_HOST:$PG_PORT/$MASTER_DB" -Atc "
SELECT
  \"dbName\",
  \"dbHost\",
  \"dbPort\",
  \"dbUser\"
FROM \"Company\"
WHERE status = 'active'
  AND \"dbName\" IS NOT NULL
" | while IFS='|' read DB_NAME DB_HOST DB_PORT DB_USER
do
  echo "   → Exporting $DB_NAME"

  # Use PG_ADMIN_USER to backup tenant DBs (bypasses need for decrypted tenant passwords)
  pg_dump "postgresql://$PG_ADMIN_USER@$DB_HOST:$DB_PORT/$DB_NAME" \
    --data-only \
    --column-inserts \
    --disable-triggers \
    --no-owner \
    --no-privileges \
    > "$BACKUP_DIR/companies/${DB_NAME}.sql"
done

echo "✅ Full export completed successfully."

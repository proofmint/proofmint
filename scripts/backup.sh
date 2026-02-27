#!/usr/bin/env bash
# =============================================================================
# ProofMint – Production Backup
# Backs up: uploads, MySQL database, HashiCorp Vault volumes + seal keys
# Output:   <parent-of-project>/backups/proofmint-backup-<timestamp>.tar.gz
# =============================================================================
set -euo pipefail

# ── Vault project paths (relative to this project's root) ────────────────────
# Adjust these to match where your vault project folder lives
VAULT_DEV_RELPATH="../hashi"    # ← set your dev vault path
VAULT_PROD_RELPATH="../hashi"  # ← set your prod vault path
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PARENT_DIR="$(dirname "${PROJECT_DIR}")"
BACKUPS_DIR="${PARENT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="proofmint-backup-${TIMESTAMP}"
STAGING_DIR="${BACKUPS_DIR}/${BACKUP_NAME}"
ARCHIVE="${BACKUPS_DIR}/${BACKUP_NAME}.tar.gz"

mkdir -p "$BACKUPS_DIR"

# ── Load .env ─────────────────────────────────────────────────────────────────
ENV_FILE="${PROJECT_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

echo "[backup] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[backup] Starting: ${BACKUP_NAME}"
echo "[backup] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
mkdir -p "${STAGING_DIR}"

# ── 1. Uploads ────────────────────────────────────────────────────────────────
UPLOADS_DIR="${UPLOADS_PATH:-${PROJECT_DIR}/uploads}"
if [[ -d "$UPLOADS_DIR" ]]; then
  echo "[backup] [1/3] Copying uploads from ${UPLOADS_DIR} ..."
  cp -r "$UPLOADS_DIR" "${STAGING_DIR}/uploads"
  echo "[backup]       $(du -sh "${STAGING_DIR}/uploads" | cut -f1) copied"
else
  echo "[backup] [1/3] WARNING: uploads directory not found, skipping"
fi

# ── 2. Database ───────────────────────────────────────────────────────────────
# mysqldump --single-transaction is safe for InnoDB and works well up to ~5 GB.
# For larger databases consider:
#   • mydumper  – parallel dump, much faster for large schemas
#   • Percona XtraBackup – physical hot-backup, best for 10 GB+
DB_URL="${DATABASE_URL:-}"
if [[ -n "$DB_URL" ]]; then
  # Use node's URL parser — handles percent-encoded characters in credentials correctly
  eval "$(node -e '
    const u = new URL(process.env.DATABASE_URL);
    const q = s => "\x27" + s.replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    console.log("DB_USER=" + q(u.username));
    console.log("DB_PASS=" + q(u.password));
    console.log("DB_HOST=" + q(u.hostname));
    console.log("DB_PORT=" + q(u.port));
    console.log("DB_NAME=" + q(u.pathname.slice(1)));
  ')"

  echo "[backup] [2/3] Dumping database '${DB_NAME}' @ ${DB_HOST}:${DB_PORT} ..."

  MYSQL_ARGS=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
  [[ -n "$DB_PASS" ]] && MYSQL_ARGS+=(-p"$DB_PASS")

  mysqldump "${MYSQL_ARGS[@]}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    "$DB_NAME" > "${STAGING_DIR}/database.sql"

  echo "[backup]       $(du -sh "${STAGING_DIR}/database.sql" | cut -f1) written"
else
  echo "[backup] [2/3] WARNING: DATABASE_URL not set, skipping database backup"
fi

# ── 3. HashiCorp Vault ────────────────────────────────────────────────────────
NODE_ENV_VAL="${NODE_ENV:-development}"
if [[ "$NODE_ENV_VAL" == "production" ]]; then
  VAULT_REL="$VAULT_PROD_RELPATH"
else
  VAULT_REL="$VAULT_DEV_RELPATH"
fi

VAULT_PROJECT_DIR="$(cd "${PROJECT_DIR}/${VAULT_REL}" 2>/dev/null && pwd)" || true

if [[ -n "${VAULT_PROJECT_DIR:-}" && -d "$VAULT_PROJECT_DIR" ]]; then
  echo "[backup] [3/3] Backing up Vault (${NODE_ENV_VAL}): ${VAULT_PROJECT_DIR}"
  mkdir -p "${STAGING_DIR}/vault"

  if [[ -d "${VAULT_PROJECT_DIR}/volumes" ]]; then
    cp -r "${VAULT_PROJECT_DIR}/volumes" "${STAGING_DIR}/vault/volumes"
    echo "[backup]       volumes: $(du -sh "${STAGING_DIR}/vault/volumes" | cut -f1)"
  else
    echo "[backup]       WARNING: volumes/ not found, skipping"
  fi

  if [[ -f "${VAULT_PROJECT_DIR}/vault-seal-keys.json" ]]; then
    cp "${VAULT_PROJECT_DIR}/vault-seal-keys.json" "${STAGING_DIR}/vault/vault-seal-keys.json"
    echo "[backup]       vault-seal-keys.json copied"
  else
    echo "[backup]       WARNING: vault-seal-keys.json not found, skipping"
  fi
else
  echo "[backup] [3/3] WARNING: Vault project not found at ${PROJECT_DIR}/${VAULT_REL}, skipping"
fi

# ── 4. Archive & cleanup ──────────────────────────────────────────────────────
echo "[backup] Compressing → ${ARCHIVE} ..."
tar -czf "$ARCHIVE" -C "$BACKUPS_DIR" "$BACKUP_NAME"
rm -rf "$STAGING_DIR"

ARCHIVE_SIZE="$(du -sh "$ARCHIVE" | cut -f1)"
echo "[backup] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[backup] Done: ${ARCHIVE} (${ARCHIVE_SIZE})"
echo "[backup] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

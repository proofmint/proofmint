#!/usr/bin/env bash
# =============================================================================
# ProofMint – Production Backup
# Backs up: uploads, MySQL database, Vault data + seal keys, IPFS node data
# Output:   <parent-of-project>/backups/proofmint-backup-<timestamp>.tar.gz
#
# Assumes the docker-compose stack in this repo (docker-compose.yml) — the
# mysql/vault/ipfs data directories under ./docker/ are backed up directly.
# =============================================================================
set -euo pipefail

# Container name of the mysql service in docker-compose.yml
DOCKER_MYSQL_CONTAINER="${DOCKER_MYSQL_CONTAINER:-proofmint-mysql}"
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

# ── Load .env ─────────────────────────────────────────────────────
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
  echo "[backup] [1/4] Copying uploads from ${UPLOADS_DIR} ..."
  cp -r "$UPLOADS_DIR" "${STAGING_DIR}/uploads"
  echo "[backup]       $(du -sh "${STAGING_DIR}/uploads" | cut -f1) copied"
else
  echo "[backup] [1/4] WARNING: uploads directory not found, skipping"
fi

# ── 2. Database ───────────────────────────────────────────────────────────────
# mysqldump --single-transaction is safe for InnoDB and works well up to ~5 GB.
# For larger databases consider:
#   • mydumper  – parallel dump, much faster for large schemas
#   • Percona XtraBackup – physical hot-backup, best for 10 GB+
DB_URL="${DATABASE_URL:-}"
if [[ -n "$DB_URL" ]]; then
  # Extract raw (still percent-encoded) parts with regex, then decode exactly once
  # with decodeURIComponent — more reliable than new URL() for non-standard schemes
  eval "$(node -e '
    const url = process.env.DATABASE_URL;
    const m = url.match(/^[^:]+:\/\/([^:@]*)(?::([^@]*))?@([^:/]*)(?::(\d+))?\/([^?#]*)/);
    if (!m) throw new Error("Cannot parse DATABASE_URL");
    const dec = s => s ? decodeURIComponent(s) : "";
    const q = s => "\x27" + s.replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    console.log("DB_USER=" + q(dec(m[1])));
    console.log("DB_PASS=" + q(dec(m[2] || "")));
    console.log("DB_HOST=" + q(m[3]));
    console.log("DB_PORT=" + q(m[4] || "3306"));
    console.log("DB_NAME=" + q(dec(m[5])));
  ')"

  echo "[backup] [2/4] Dumping database '${DB_NAME}' @ ${DB_HOST}:${DB_PORT} ..."

  MYSQLDUMP_FLAGS=(--single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF)

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DOCKER_MYSQL_CONTAINER"; then
    # mysql (and mysqldump) only exist inside the container, so run it there via
    # docker exec, connecting over the container's own loopback.
    echo "[backup]       using mysqldump inside docker container '${DOCKER_MYSQL_CONTAINER}'"
    docker exec -e MYSQL_PWD="$DB_PASS" "$DOCKER_MYSQL_CONTAINER" \
      mysqldump -h 127.0.0.1 -P 3306 -u "$DB_USER" \
      "${MYSQLDUMP_FLAGS[@]}" \
      "$DB_NAME" > "${STAGING_DIR}/database.sql"
  else
    # Fallback: host has mysqldump installed natively.
    # Pass password via MYSQL_PWD env var — avoids shell expansion of special
    # chars and suppresses the "password on command line" warning
    MYSQL_PWD="$DB_PASS" mysqldump \
      -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
      "${MYSQLDUMP_FLAGS[@]}" \
      "$DB_NAME" > "${STAGING_DIR}/database.sql"
  fi

  echo "[backup]       $(du -sh "${STAGING_DIR}/database.sql" | cut -f1) written"
else
  echo "[backup] [2/4] WARNING: DATABASE_URL not set, skipping database backup"
fi

# ── 3. Vault (data + seal keys) ───────────────────────────────────────────────
VAULT_DATA_DIR="${PROJECT_DIR}/docker/vault/data"
SEAL_KEYS_FILE="${PROJECT_DIR}/vault-seal-keys.json"

if [[ -d "$VAULT_DATA_DIR" ]]; then
  echo "[backup] [3/4] Copying Vault data from ${VAULT_DATA_DIR} ..."
  mkdir -p "${STAGING_DIR}/vault"
  cp -r "$VAULT_DATA_DIR" "${STAGING_DIR}/vault/data"
  echo "[backup]       $(du -sh "${STAGING_DIR}/vault/data" | cut -f1) copied"
else
  echo "[backup] [3/4] WARNING: ${VAULT_DATA_DIR} not found, skipping"
fi

if [[ -f "$SEAL_KEYS_FILE" ]]; then
  mkdir -p "${STAGING_DIR}/vault"
  cp "$SEAL_KEYS_FILE" "${STAGING_DIR}/vault/vault-seal-keys.json"
  echo "[backup]       vault-seal-keys.json copied"
else
  echo "[backup]       WARNING: vault-seal-keys.json not found, skipping"
fi

# ── 4. IPFS node data ─────────────────────────────────────────────────────────
IPFS_DATA_DIR="${PROJECT_DIR}/docker/ipfs/data"
if [[ -d "$IPFS_DATA_DIR" ]]; then
  echo "[backup] [4/4] Copying IPFS node data from ${IPFS_DATA_DIR} ..."
  cp -r "$IPFS_DATA_DIR" "${STAGING_DIR}/ipfs-data"
  echo "[backup]       $(du -sh "${STAGING_DIR}/ipfs-data" | cut -f1) copied"
else
  echo "[backup] [4/4] WARNING: ${IPFS_DATA_DIR} not found, skipping (uploads/cars already has every CAR — pnpm pin:ipfs can re-pin them into a fresh node)"
fi

# ── 5. Archive & cleanup ──────────────────────────────────────────────────────
echo "[backup] Compressing → ${ARCHIVE} ..."
tar -czf "$ARCHIVE" -C "$BACKUPS_DIR" "$BACKUP_NAME"
rm -rf "$STAGING_DIR"

ARCHIVE_SIZE="$(du -sh "$ARCHIVE" | cut -f1)"
echo "[backup] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[backup] Done: ${ARCHIVE} (${ARCHIVE_SIZE})"
echo "[backup] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

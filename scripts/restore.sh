#!/usr/bin/env bash
# =============================================================================
# ProofMint – Restore from a backup produced by scripts/backup.sh
#
# USAGE
#   scripts/restore.sh /path/to/proofmint-backup-<timestamp>.tar.gz
#
# Restores: uploads/, docker/vault/data + vault-seal-keys.json, docker/ipfs/data,
# and replays database.sql into the running mysql container.
#
# Typical "move to a new server" flow:
#   1. Copy this repo (incl. docker-compose.yml, docker/vault/config) + a
#      backup archive to the new server.
#   2. scripts/restore.sh <archive>          (restores files; starts mysql to
#                                              replay the SQL dump)
#   3. docker compose up -d
#   4. docker compose exec app pnpm vault:setup   (unseals — falls back to
#                                                  unseal-only since it's
#                                                  already initialized)
# =============================================================================
set -euo pipefail

DOCKER_MYSQL_CONTAINER="${DOCKER_MYSQL_CONTAINER:-proofmint-mysql}"

ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: scripts/restore.sh /path/to/proofmint-backup-<timestamp>.tar.gz"
  exit 1
fi
ARCHIVE="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${PROJECT_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[restore] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[restore] Extracting ${ARCHIVE} ..."
echo "[restore] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tar -xzf "$ARCHIVE" -C "$TMP_DIR"

# The archive contains a single top-level "proofmint-backup-<timestamp>" dir
BACKUP_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)"
if [[ -z "$BACKUP_DIR" ]]; then
  echo "[restore] Could not find the backup contents inside the archive."
  exit 1
fi

confirm_overwrite() {
  local target="$1"
  if [[ -e "$target" ]]; then
    read -r -p "[restore] ${target} already exists — overwrite? [y/N] " reply
    [[ "$reply" =~ ^[Yy]$ ]]
  else
    return 0
  fi
}

# ── 1. Uploads ────────────────────────────────────────────────────────────────
if [[ -d "${BACKUP_DIR}/uploads" ]]; then
  TARGET="${${PROJECT_DIR}/uploads}"
  if confirm_overwrite "$TARGET"; then
    echo "[restore] [1/4] Restoring uploads to ${TARGET} ..."
    rm -rf "$TARGET"
    cp -r "${BACKUP_DIR}/uploads" "$TARGET"
  else
    echo "[restore] [1/4] Skipped uploads (kept existing)."
  fi
else
  echo "[restore] [1/4] No uploads/ in archive, skipping."
fi

# ── 2. Vault data + seal keys ─────────────────────────────────────────────────
if [[ -d "${BACKUP_DIR}/vault/data" ]]; then
  TARGET="${PROJECT_DIR}/docker/vault/data"
  if confirm_overwrite "$TARGET"; then
    echo "[restore] [2/4] Restoring Vault data to ${TARGET} ..."
    mkdir -p "$(dirname "$TARGET")"
    rm -rf "$TARGET"
    cp -r "${BACKUP_DIR}/vault/data" "$TARGET"
  else
    echo "[restore] [2/4] Skipped Vault data (kept existing)."
  fi
else
  echo "[restore] [2/4] No vault/data in archive, skipping."
fi

if [[ -f "${BACKUP_DIR}/vault/vault-seal-keys.json" ]]; then
  cp "${BACKUP_DIR}/vault/vault-seal-keys.json" "${PROJECT_DIR}/vault-seal-keys.json"
  echo "[restore]       vault-seal-keys.json restored"
fi

# ── 3. IPFS node data ─────────────────────────────────────────────────────────
if [[ -d "${BACKUP_DIR}/ipfs-data" ]]; then
  TARGET="${PROJECT_DIR}/docker/ipfs/data"
  if confirm_overwrite "$TARGET"; then
    echo "[restore] [3/4] Restoring IPFS node data to ${TARGET} ..."
    mkdir -p "$(dirname "$TARGET")"
    rm -rf "$TARGET"
    cp -r "${BACKUP_DIR}/ipfs-data" "$TARGET"
  else
    echo "[restore] [3/4] Skipped IPFS node data (kept existing)."
  fi
else
  echo "[restore] [3/4] No ipfs-data in archive, skipping (uploads/cars can be re-pinned with pnpm pin:ipfs once the node is up)."
fi

# ── 4. Database ───────────────────────────────────────────────────────────────
if [[ -f "${BACKUP_DIR}/database.sql" ]]; then
  DB_URL="${DATABASE_URL:-}"
  if [[ -z "$DB_URL" ]]; then
    echo "[restore] [4/4] DATABASE_URL not set — skipping database restore."
    echo "[restore]       database.sql is still in the archive; replay it manually once configured."
  else
    eval "$(node -e '
      const url = process.env.DATABASE_URL;
      const m = url.match(/^[^:]+:\/\/([^:@]*)(?::([^@]*))?@([^:/]*)(?::(\d+))?\/([^?#]*)/);
      if (!m) throw new Error("Cannot parse DATABASE_URL");
      const dec = s => s ? decodeURIComponent(s) : "";
      const q = s => "\x27" + s.replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
      console.log("DB_USER=" + q(dec(m[1])));
      console.log("DB_PASS=" + q(dec(m[2] || "")));
      console.log("DB_NAME=" + q(dec(m[5])));
    ')"

    echo "[restore] [4/4] Starting mysql (if not already running) to replay database.sql ..."
    (cd "$PROJECT_DIR" && docker compose up -d mysql)

    echo "[restore]       waiting for mysql to accept connections ..."
    for _ in $(seq 1 30); do
      if docker exec "$DOCKER_MYSQL_CONTAINER" mysqladmin ping -h 127.0.0.1 -u root -p"${MYSQL_ROOT_PASSWORD:-}" --silent >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    echo "[restore]       importing into database '${DB_NAME}' ..."
    docker exec -i -e MYSQL_PWD="$DB_PASS" "$DOCKER_MYSQL_CONTAINER" \
      mysql -u "$DB_USER" "$DB_NAME" < "${BACKUP_DIR}/database.sql"
    echo "[restore]       database restored"
  fi
else
  echo "[restore] [4/4] No database.sql in archive, skipping."
fi

echo "[restore] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[restore] Done. Next steps:"
echo "[restore]   1. docker compose up -d"
echo "[restore]   2. docker compose exec app pnpm vault:setup   (unseals Vault — already initialized, so this just unseals)"
echo "[restore] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Running ProofMint with Docker

The whole stack — the app, MySQL, Vault, and an IPFS (kubo) node — runs via `docker-compose.yml` in the repo root. Everything stateful lives under plain folders (`./uploads`, `./docker/mysql/data`, `./docker/vault/data`, `./docker/ipfs/data`) so you can see exactly what's persisted and back it up with `tar`.

## Services

| Service | Image              | Purpose                                   | Data dir                  |
|---------|--------------------|--------------------------------------------|----------------------------|
| `app`   | built from `Dockerfile` | The Next.js app                       | `./uploads` (bind-mounted) |
| `mysql` | `mysql:8.0`         | Database                                  | `./docker/mysql/data`      |
| `vault` | `hashicorp/vault`   | Key management (Ed25519 wallet signing)   | `./docker/vault/data`      |
| `ipfs`  | `ipfs/kubo`         | Pins CARs written by the app              | `./docker/ipfs/data`       |

The app talks to Vault's transit HTTP API directly (`lib/vault.ts`) — there's no separate signing service in this stack.

## First-time setup

1. **Configure `.env`** at the repo root. When running via docker-compose, point service URLs at the in-network hostnames (the compose service names), not `localhost`:
   ```env
   MYSQL_ROOT_PASSWORD=<choose a password>
   MYSQL_DATABASE=proofmint
   MYSQL_USER=proofmint
   MYSQL_PASSWORD=<choose a password>
   DATABASE_URL=mysql://proofmint:<same password as MYSQL_PASSWORD>@mysql:3306/proofmint

   VAULT_HOST=http://vault:8200
   VAULT_TOKEN=   # filled in after step 3 below

   IPFS_API_URL=http://ipfs:5001

   UPLOADS_PATH=/app/uploads
   ```
   Plus whatever other required vars `lib/const.ts` lists (email, Algorand, JWT_SECRET, etc.) — same as running without Docker.

2. **Create an empty `vault-seal-keys.json`** at the repo root before the first `docker compose up` — Docker bind-mounts a path that doesn't exist yet as a *directory*, not a file, which would break step 3:
   ```bash
   echo '{}' > vault-seal-keys.json
   ```

3. **Build and start everything:**
   ```bash
   docker compose up -d --build
   ```

4. **Initialize Vault** (first run only — creates the root token + unseal key and mounts the `transit` engine that wallet signing uses):
   ```bash
   docker compose exec app pnpm vault:setup
   ```
   This prints a root token — copy it into `VAULT_TOKEN` in `.env`, then restart the app so it picks it up:
   ```bash
   docker compose up -d app
   ```
   The generated `vault-seal-keys.json` (repo root) is the *only* copy of the unseal key — back it up (it's included in `scripts/backup.sh`). Vault re-seals every time its container restarts; the app auto-unseals itself on boot using this file (see `instrumentation.ts`), so you normally won't need to run `vault:setup` again — it's there for the first run and for recovery.

5. **Apply the database schema:**
   ```bash
   docker compose exec app npx prisma migrate deploy
   ```

6. **Migrate the uploads layout** (one-time, only relevant if you have pre-existing data in the old `uploads/badges` / `uploads/certificates` / `uploads/ipfs-backup` / `uploads/storacha-backup` layout):
   ```bash
   docker compose exec app pnpm migrate:uploads
   ```

The app is now at http://localhost:13000 (host ports are remapped away from common defaults — see the `ports:` mapping in `docker-compose.yml`: mysql `33061`, vault `18200`, ipfs swarm `14001`, ipfs RPC `15001`, ipfs gateway `18080`, app `13000` — container-internal ports are unchanged, so in-network service URLs like `mysql:3306` / `vault:8200` / `ipfs:5001` still apply).

## Day-to-day

```bash
docker compose up -d          # start everything
docker compose logs -f app    # tail app logs
docker compose down           # stop everything (data dirs are untouched)
docker compose up -d --build app   # rebuild + restart just the app after a code change
```

Pin newly-created CARs (certificates/badges) to the IPFS node on a schedule (cron/systemd timer on the host, calling into the container):
```bash
docker compose exec app pnpm pin:ipfs
```

## Backup

```bash
pnpm backup
```
Runs `scripts/backup.sh`, which tars up `uploads/`, a `mysqldump` of the database (via `docker exec` into the `mysql` service), `docker/vault/data` + `vault-seal-keys.json`, and `docker/ipfs/data`, into `../backups/proofmint-backup-<timestamp>.tar.gz` (one level above the repo, so it survives `rm -rf` of the repo itself).

## Restore / moving to a new server

1. Copy the repo (including `docker-compose.yml`, `Dockerfile`, `docker/vault/config/vault.json`, and your `.env`) to the new server, plus a backup archive.
2. Restore it:
   ```bash
   pnpm restore /path/to/proofmint-backup-<timestamp>.tar.gz
   ```
   This restores `uploads/`, `docker/vault/data`, `docker/ipfs/data`, and replays `database.sql` into a freshly-started `mysql` container. It'll prompt before overwriting anything already present.
3. Bring the rest of the stack up and unseal Vault:
   ```bash
   docker compose up -d
   docker compose exec app pnpm vault:setup
   ```
   Since Vault is already initialized (the restored data dir + `vault-seal-keys.json` prove it), this just unseals it — no new root token is generated, so your existing `VAULT_TOKEN` in `.env` still works.

If the IPFS data directory wasn't included in a given backup (or got corrupted), it isn't load-bearing — every CID's CAR file is also sitting in `uploads/cars/`, so `pnpm pin:ipfs` will re-pin everything into a fresh node.

## Troubleshooting

- **Vault sealed after a restart**: run `docker compose exec app pnpm vault:setup` (or check `docker compose logs app` — it tries this automatically on boot and logs `[Vault] Auto-unsealed on boot.` when it works).
- **`vault:setup` says seal keys are missing but Vault reports already initialized**: you likely restored `docker/vault/data` without also restoring `vault-seal-keys.json` — restore it from the same backup archive (`scripts/restore.sh` restores both together).
- **App can't reach the IPFS node**: confirm from inside the container — `docker compose exec app wget -qO- --post-data='' http://ipfs:5001/api/v0/id`. If that fails, check `docker compose logs ipfs` for a crashed/still-initializing node.

# Local Development

Basic Dev Workflow — pnpm dev still works. Two things to be aware of after this migration:

1. IPFS_API_URL is now a required env var (same as any other var in lib/const.ts) — it just needs to be present, not actually reachable, for the app to boot. I already added a placeholder to your .env:
IPFS_API_URL=http://127.0.0.1:5001
.env.dev doesn't have it yet, but Next.js loads .env by default (not .env.dev, which isn't a name Next auto-loads), so you're fine as-is for pnpm dev.

2. Creating certificates/badges works fully offline from IPFS — images, metadata, and CARs all get written to uploads/images, uploads/metadata, uploads/cars on local disk regardless of whether an IPFS node exists. The node is only needed for the separate pnpm pin:ipfs step (which pins already-written CARs). So local dev works exactly as before; you just won't have anything to pin against until a node is running somewhere.

If you do want to test pinning locally, the simplest option is running just kubo directly (no compose, no port conflicts with your mysql_dev/vault/phpmyadmin_dev):
docker run -d --name ipfs-dev -p 5001:5001 -p 8081:8080 ipfs/kubo:latest
(gateway on 8081 since 8080 is taken by phpmyadmin_dev) — then IPFS_API_URL=http://127.0.0.1:5001 in .env will actually work for pnpm pin:ipfs
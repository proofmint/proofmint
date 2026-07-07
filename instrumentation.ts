/**
 * Vault re-seals every time its process (re)starts. If a seal key is
 * available (vault-seal-keys.json, written by `pnpm vault:setup`), unseal
 * automatically on app boot so `docker compose up` doesn't need a manual
 * unseal step every time. Best-effort — never throws, so a sealed or
 * unreachable Vault doesn't block the app from starting.
 */
async function autoUnsealVault(): Promise<void> {
  const vaultHost = process.env.VAULT_HOST;
  if (!vaultHost) return;

  try {
    const { existsSync, readFileSync } = await import('fs');
    const path = await import('path');
    const sealKeysPath = path.join(process.cwd(), 'vault-seal-keys.json');
    if (!existsSync(sealKeysPath)) return;

    const statusRes = await fetch(`${vaultHost}/v1/sys/seal-status`);
    if (!statusRes.ok) return;
    const status = await statusRes.json();
    if (!status.sealed) {
      console.log('[Vault] Already unsealed.');
      return;
    }

    const saved = JSON.parse(readFileSync(sealKeysPath, 'utf8'));
    const key = saved?.keys?.[0];
    if (!key) return;

    const unsealRes = await fetch(`${vaultHost}/v1/sys/unseal`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    const result = await unsealRes.json();
    console.log(result.sealed ? '[Vault] Auto-unseal attempted but vault is still sealed.' : '[Vault] Auto-unsealed on boot.');
  } catch (err) {
    console.warn('[Vault] Auto-unseal check failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

export async function register() {
  // Only run in Node.js runtime (not Edge), where Prisma and the queue are available
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { mkdirSync, existsSync } = await import('fs');
    const { TEMPLATES_PATH, IMAGES_PATH, METADATA_PATH, CARS_PATH } = await import('./lib/uploads');

    for (const dir of [TEMPLATES_PATH, IMAGES_PATH, METADATA_PATH, CARS_PATH]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[Uploads] Created directory: ${dir}`);
      } else {
        console.log(`[Uploads] Directory already exists: ${dir}`);
      }
    }
    console.log('[Uploads] Upload directories ready');

    await autoUnsealVault();

    const { queueProcessor } = await import('./lib/services/queueProcessor');
    await queueProcessor.recoverPendingCertificates();

    const { CERTIFICATE_FONTS } = await import('./lib/certificateFonts');
    const path = await import('path');
    const { GlobalFonts } = await import('@napi-rs/canvas');
    // Register custom fonts from public/fonts/ at module load time.
    // Missing font files are skipped gracefully — the canvas falls back to the system default.
    for (const font of CERTIFICATE_FONTS) {
      if (!font.file) continue;
      const fontPath = path.join(process.cwd(), 'public', 'fonts', font.file);
      if (!existsSync(fontPath)) {
        console.warn(`[ImageGenerator] Font file not found, skipping: ${font.file}`);
        continue;
      }
      try {
        GlobalFonts.registerFromPath(fontPath, font.name);
        console.log(`[ImageGenerator] Registered font: ${font.name}`);
      } catch (err) {
        console.warn(`[ImageGenerator] Failed to register font ${font.name}:`, err);
      }
    }
  }
}

export async function register() {
  // Only run in Node.js runtime (not Edge), where Prisma and the queue are available
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { mkdirSync, existsSync } = await import('fs');
    const { TEMPLATES_PATH, CERTIFICATES_PATH, BADGES_PATH, IPFS_BACKUP_PATH } = await import('./lib/uploads');
    
    for (const dir of [TEMPLATES_PATH, CERTIFICATES_PATH, BADGES_PATH, IPFS_BACKUP_PATH]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[Uploads] Created directory: ${dir}`);
      } else {
        console.log(`[Uploads] Directory already exists: ${dir}`);
      }
    }
    console.log('[Uploads] Upload directories ready');

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

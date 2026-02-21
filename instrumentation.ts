export async function register() {
  // Only run in Node.js runtime (not Edge), where Prisma and the queue are available
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { queueProcessor } = await import('./lib/services/queueProcessor');
    await queueProcessor.recoverPendingCertificates();
  }
}

import prisma from "@/lib/prisma";
import { algodClient } from "@/lib/const";

/**
 * Fetches asset information from Algorand and extracts the IPFS metadata CID
 * from the asset URL, which is in the format: ipfs://{metadataCid}#arc3
 */
const extractMetadataCid = (url: string): string | null => {
  const match = url.match(/^ipfs:\/\/([^#]+)(?:#arc3)?$/);
  return match ? match[1] : null;
};

async function main() {
  console.log("🚀 Starting badge metadataCid update process...");
  console.log("=".repeat(60));

  const badges = await prisma.badge.findMany({
    select: { id: true, assetId: true, metadataCid: true },
  });

  console.log(`📋 Found ${badges.length} badge(s) in database`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const badge of badges) {
    const label = `Badge ${badge.id} (assetId: ${badge.assetId})`;

    if (badge.metadataCid && badge.metadataCid !== "") {
      console.log(`⏭️  Skipping ${label} — metadataCid already set`);
      skipped++;
      continue;
    }

    try {
      const assetInfo = await algodClient
        .getAssetByID(Number(badge.assetId))
        .do();

      const url: string | undefined = assetInfo.params.url;

      if (!url) {
        console.warn(`⚠️  No URL found for ${label}`);
        failed++;
        continue;
      }

      const metadataCid = extractMetadataCid(url);

      if (!metadataCid) {
        console.warn(
          `⚠️  URL does not match expected ipfs://...#arc3 format for ${label}: "${url}"`
        );
        failed++;
        continue;
      }

      await prisma.badge.update({
        where: { id: badge.id },
        data: { metadataCid },
      });

      console.log(`✅ Updated ${label} → metadataCid: ${metadataCid}`);
      updated++;
    } catch (error: any) {
      console.error(`❌ Failed to process ${label}: ${error?.message ?? error}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   Updated : ${updated}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Failed  : ${failed}`);
}

main()
  .then(() => {
    console.log("\n🎉 Script execution finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });

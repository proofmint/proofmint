/**
 * fix-bulk-missing-ipfs.ts
 *
 * Remediates bulk-issued certificates where assetId was minted on-chain but
 * imageCid/metadataCid were never saved (IPFS uploads failed mid-job).
 *
 * Per-status strategy:
 *   CLAIMED  → clawback asset from receiver → opt-out receiver → destroy old asset
 *              → generate image → upload IPFS → remint new asset
 *              → reclaim (opt-in + transfer) for receiver, fees paid by admin
 *   PENDING  → destroy old asset (still in issuer wallet)
 *              → generate image → upload IPFS → remint new asset
 *   REJECTED → destroy old asset (still in issuer wallet)
 *              → generate image → upload IPFS → remint new asset (status stays REJECTED)
 *
 * All Algorand transaction fees are covered by ADMIN_WALLET via fee pooling.
 *
 * Run:
 *   tsx scripts/fix-bulk-missing-ipfs.ts
 */

import 'dotenv/config';
import prisma from '@/lib/prisma';
import algosdk from 'algosdk';
import { algodClient, ADMIN_WALLET } from '@/lib/const';
import { signTransactions } from '@/lib/vault';
import { generateCertificate } from '@/lib/services/imageGenerator';
import { uploadCertificateWithMetadata } from '@/lib/services/ipfsStorage';
import { CERTIFICATE_FONTS } from '@/lib/certificateFonts';
import { GlobalFonts } from '@napi-rs/canvas';
import { existsSync } from 'fs';
import path from 'path';

// Register custom fonts — mirrors what instrumentation.ts does at Next.js startup
for (const font of CERTIFICATE_FONTS) {
  if (!font.file) continue;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', font.file);
  if (!existsSync(fontPath)) {
    console.warn(`[fonts] Font file not found, skipping: ${font.file}`);
    continue;
  }
  GlobalFonts.registerFromPath(fontPath, font.name);
  console.log(`[fonts] Registered: ${font.name}`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Return a fresh SuggestedParams with flatFee=true and the given fee in microALGO */
async function spWithFee(fee: number): Promise<algosdk.SuggestedParams> {
  const sp = await algodClient.getTransactionParams().do();
  sp.flatFee = true;
  sp.fee = BigInt(fee);
  return sp;
}

/** Confirm on group anchor txn (any txn in the group works) */
async function waitForGroup(anchorTxnId: string): Promise<void> {
  await algosdk.waitForConfirmation(algodClient, anchorTxnId, 4);
}

// ─── blockchain operations ────────────────────────────────────────────────────

/**
 * Atomically:
 *   1. Admin fee-covers all 3 ops
 *   2. Issuer claws back asset from receiver
 *   3. Receiver opts out of the asset (balance=0 after clawback)
 *   4. Issuer destroys the asset
 */
async function clawbackOptOutAndDestroy(
  assetId: number,
  issuerAddress: string,
  issuerEmail: string,
  receiverWallet: string,
  receiverEmail: string,
): Promise<void> {
  console.log(`  [blockchain] Clawback+OptOut+Destroy asset ${assetId}`);

  const spAdmin = await spWithFee(4000); // covers 4 txns × 1 000
  const spZero = await spWithFee(0);

  // 1. Admin pays fee (self-payment, 0 amount)
  const adminFeeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: ADMIN_WALLET,
    receiver: ADMIN_WALLET,
    amount: 0,
    suggestedParams: spAdmin,
  });

  // 2. Clawback: issuer (clawback address) pulls asset back from receiver to itself
  const clawbackTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: issuerAddress,
    receiver: issuerAddress,
    assetSender: receiverWallet,
    assetIndex: assetId,
    amount: 1,
    suggestedParams: spZero,
  });

  // 3. Opt-out: receiver closes asset position (balance is now 0 after clawback)
  const optOutTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: receiverWallet,
    receiver: issuerAddress,
    closeRemainderTo: issuerAddress,
    assetIndex: assetId,
    amount: 0,
    suggestedParams: spZero,
  });

  // 4. Destroy: issuer destroys the asset (now holds all supply)
  const destroyTxn = algosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject({
    sender: issuerAddress,
    assetIndex: assetId,
    suggestedParams: spZero,
  });

  const group = [
    { txn: adminFeeTxn, signerEmail: 'admin', signerAddress: ADMIN_WALLET },
    { txn: clawbackTxn, signerEmail: issuerEmail, signerAddress: issuerAddress },
    { txn: optOutTxn,   signerEmail: receiverEmail, signerAddress: receiverWallet },
    { txn: destroyTxn,  signerEmail: issuerEmail, signerAddress: issuerAddress },
  ];

  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();
  await waitForGroup(txnIds[0]);
  console.log(`  [blockchain] Clawback+OptOut+Destroy confirmed. AnchorTxId: ${txnIds[0]}`);
}

/**
 * Admin covers fee, issuer destroys asset (asset must be fully in issuer wallet).
 */
async function destroyAsset(
  assetId: number,
  issuerAddress: string,
  issuerEmail: string,
): Promise<void> {
  console.log(`  [blockchain] Destroying asset ${assetId}`);

  const spAdmin = await spWithFee(2000);
  const spZero = await spWithFee(0);

  const adminFeeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: ADMIN_WALLET,
    receiver: ADMIN_WALLET,
    amount: 0,
    suggestedParams: spAdmin,
  });

  const destroyTxn = algosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject({
    sender: issuerAddress,
    assetIndex: assetId,
    suggestedParams: spZero,
  });

  const group = [
    { txn: adminFeeTxn, signerEmail: 'admin',      signerAddress: ADMIN_WALLET },
    { txn: destroyTxn,  signerEmail: issuerEmail,   signerAddress: issuerAddress },
  ];

  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();
  await waitForGroup(txnIds[0]);
  console.log(`  [blockchain] Destroy confirmed. AnchorTxId: ${txnIds[0]}`);
}

/**
 * Mint a new certificate asset on Algorand.
 * Admin covers fees; issuer signs the asset-create txn.
 * Returns the new assetId and the asset-create transaction ID.
 */
async function mintNewAsset(
  issuerAddress: string,
  issuerEmail: string,
  certificateName: string,
  unitName: string,
  metadataUrl: string,
): Promise<{ assetId: string; transactionId: string }> {
  console.log(`  [blockchain] Minting new asset for "${certificateName}"`);

  const spAdmin = await spWithFee(2000);
  const spZero = await spWithFee(0);

  const adminFeeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: ADMIN_WALLET,
    receiver: ADMIN_WALLET,
    amount: 0,
    suggestedParams: spAdmin,
  });

  const assetCreateTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: issuerAddress,
    total: 1,
    decimals: 0,
    assetName: certificateName.substring(0, 32),
    unitName: unitName.substring(0, 8),
    assetURL: metadataUrl,
    defaultFrozen: false,
    manager: issuerAddress,
    reserve: issuerAddress,
    freeze: issuerAddress,
    clawback: issuerAddress,
    suggestedParams: spZero,
  });

  const group = [
    { txn: adminFeeTxn,    signerEmail: 'admin',      signerAddress: ADMIN_WALLET },
    { txn: assetCreateTxn, signerEmail: issuerEmail,   signerAddress: issuerAddress },
  ];

  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();

  // Wait on the asset-create txn (index 1) to extract assetIndex
  const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txnIds[1], 4);
  const assetId = confirmedTxn.assetIndex;
  if (!assetId) throw new Error('Asset ID not found in confirmed transaction');

  console.log(`  [blockchain] Minted new asset ${assetId}. TxId: ${txnIds[1]}`);
  return { assetId: assetId.toString(), transactionId: txnIds[1] };
}

/**
 * Re-claim: opt receiver in to the new asset and transfer 1 unit from issuer.
 * No ALGO funding needed — receiver already recovered MBR when opted out of old asset.
 * Admin covers transaction fees via fee pooling.
 * Returns the transfer transaction ID (to store as claimTransactionHash).
 */
async function reclaimAsset(
  newAssetId: number,
  issuerAddress: string,
  issuerEmail: string,
  receiverWallet: string,
  receiverEmail: string,
): Promise<string> {
  console.log(`  [blockchain] Reclaiming asset ${newAssetId} to ${receiverWallet}`);

  const spAdmin = await spWithFee(3000);
  const spZero = await spWithFee(0);

  const adminFeeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: ADMIN_WALLET,
    receiver: ADMIN_WALLET,
    amount: 0,
    suggestedParams: spAdmin,
  });

  // Receiver opts in to new asset (self-transfer of 0)
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: receiverWallet,
    receiver: receiverWallet,
    assetIndex: newAssetId,
    amount: 0,
    suggestedParams: spZero,
  });

  // Issuer transfers 1 unit to receiver
  const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: issuerAddress,
    receiver: receiverWallet,
    assetIndex: newAssetId,
    amount: 1,
    suggestedParams: spZero,
  });

  const group = [
    { txn: adminFeeTxn, signerEmail: 'admin',      signerAddress: ADMIN_WALLET },
    { txn: optInTxn,    signerEmail: receiverEmail, signerAddress: receiverWallet },
    { txn: transferTxn, signerEmail: issuerEmail,   signerAddress: issuerAddress },
  ];

  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();
  await waitForGroup(txnIds[0]);

  const claimTxId = txnIds[txnIds.length - 1]; // transfer is last
  console.log(`  [blockchain] Reclaim confirmed. ClaimTxId: ${claimTxId}`);
  return claimTxId;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('fix-bulk-missing-ipfs: Remediating certificates with missing IPFS data');
  console.log('='.repeat(70));

  // ── 1. Query affected certificates ──────────────────────────────────────
  const certs = await prisma.issuedCertificate.findMany({
    where: {
      imageCid: null,
      metadataCid: null,
      assetId: { not: null },
      mintingStatus: 'MINTED',
    },
    include: {
      issuer: { include: { user: true } },
      template: true,
    },
    orderBy: { issuedAt: 'asc' },
  });

  if (certs.length === 0) {
    console.log('\n✅ No certificates found with missing IPFS data. Nothing to do.');
    return;
  }

  console.log(`\nFound ${certs.length} certificate(s) with missing imageCid/metadataCid:\n`);

  // Print summary table
  for (const cert of certs) {
    console.log(
      `  ID: ${cert.id} | AssetId: ${cert.assetId} | Status: ${cert.status} | Receiver: ${cert.receiverEmail}`
    );
  }
  console.log('');

  // Tally by status
  const claimed  = certs.filter((c) => c.status === 'CLAIMED');
  const pending  = certs.filter((c) => c.status === 'PENDING');
  const rejected = certs.filter((c) => c.status === 'REJECTED');

  console.log(`  CLAIMED:  ${claimed.length}`);
  console.log(`  PENDING:  ${pending.length}`);
  console.log(`  REJECTED: ${rejected.length}`);
  console.log('');

  // ── 2. Process each certificate ──────────────────────────────────────────
  const results = { success: 0, failed: 0, skipped: 0 };

  for (const cert of certs) {
    const assetId      = Number(cert.assetId!);
    const issuerAddr   = cert.issuer.user.walletAddress;
    const issuerEmail  = cert.issuer.user.email;
    const properties   = cert.properties as Record<string, string>;

    console.log('-'.repeat(70));
    console.log(`Processing cert ${cert.id} (asset ${assetId}) — status: ${cert.status}`);

    try {
      // ── REJECTED: destroy old asset → remint (status stays REJECTED) ──
      if (cert.status === 'REJECTED') {
        // Phase 1: destroy old asset (still in issuer wallet)
        await destroyAsset(assetId, issuerAddr, issuerEmail);

        // Phase 2: generate image + upload to IPFS
        console.log(`  [ipfs] Generating image and uploading to IPFS…`);
        const imageBuffer = await generateCertificate(cert.templateId, properties);
        const { imageHash, metadataHash } = await uploadCertificateWithMetadata(
          imageBuffer,
          cert.certificateName,
          cert.unitName,
          cert.description,
          properties,
        );
        console.log(`  [ipfs] imageCid: ${imageHash} | metadataCid: ${metadataHash}`);

        // Phase 3: remint new asset
        const metadataUrl = `ipfs://${metadataHash}#arc3`;
        const { assetId: newAssetId, transactionId: mintTxId } = await mintNewAsset(
          issuerAddr,
          issuerEmail,
          cert.certificateName,
          cert.unitName,
          metadataUrl,
        );

        // Phase 4: update DB — keep status REJECTED, update asset/IPFS fields
        await prisma.issuedCertificate.update({
          where: { id: cert.id },
          data: {
            assetId: newAssetId,
            imageCid: imageHash,
            metadataCid: metadataHash,
            mintingStatus: 'MINTED',
            status: 'REJECTED',
            mintTransactionHash: mintTxId,
          },
        });

        console.log(`  ✅ REJECTED cert remediated. New assetId: ${newAssetId}`);
        results.success++;
        continue;
      }

      // ── CLAIMED: clawback → opt-out → destroy → remint → reclaim ──────
      if (cert.status === 'CLAIMED') {
        const receiverUser = await prisma.user.findUnique({
          where: { email: cert.receiverEmail },
          select: { walletAddress: true },
        });

        if (!receiverUser?.walletAddress) {
          console.warn(`  ⚠️  Cannot find wallet for receiver ${cert.receiverEmail}, skipping.`);
          results.skipped++;
          continue;
        }

        const receiverWallet = receiverUser.walletAddress;

        // Phase 1: clawback + opt-out + destroy (atomic group)
        await clawbackOptOutAndDestroy(
          assetId,
          issuerAddr,
          issuerEmail,
          receiverWallet,
          cert.receiverEmail,
        );

        // Phase 2: generate image + upload to IPFS
        console.log(`  [ipfs] Generating image and uploading to IPFS…`);
        const imageBuffer = await generateCertificate(cert.templateId, properties);
        const { imageHash, metadataHash } = await uploadCertificateWithMetadata(
          imageBuffer,
          cert.certificateName,
          cert.unitName,
          cert.description,
          properties,
        );
        console.log(`  [ipfs] imageCid: ${imageHash} | metadataCid: ${metadataHash}`);

        // Phase 3: remint new asset
        const metadataUrl = `ipfs://${metadataHash}#arc3`;
        const { assetId: newAssetId, transactionId: mintTxId } = await mintNewAsset(
          issuerAddr,
          issuerEmail,
          cert.certificateName,
          cert.unitName,
          metadataUrl,
        );

        // Phase 4: reclaim (opt-in + transfer) — no MBR funding needed
        const claimTxId = await reclaimAsset(
          Number(newAssetId),
          issuerAddr,
          issuerEmail,
          receiverWallet,
          cert.receiverEmail,
        );

        // Phase 5: update DB
        await prisma.issuedCertificate.update({
          where: { id: cert.id },
          data: {
            assetId: newAssetId,
            imageCid: imageHash,
            metadataCid: metadataHash,
            mintingStatus: 'MINTED',
            status: 'CLAIMED',
            mintTransactionHash: mintTxId,
            claimTransactionHash: claimTxId,
          },
        });

        console.log(`  ✅ CLAIMED cert remediated. New assetId: ${newAssetId}`);
        results.success++;
        continue;
      }

      // ── PENDING: destroy → remint (no reclaim) ─────────────────────────
      if (cert.status === 'PENDING') {
        // Phase 1: destroy old asset
        await destroyAsset(assetId, issuerAddr, issuerEmail);

        // Phase 2: generate image + upload to IPFS
        console.log(`  [ipfs] Generating image and uploading to IPFS…`);
        const imageBuffer = await generateCertificate(cert.templateId, properties);
        const { imageHash, metadataHash } = await uploadCertificateWithMetadata(
          imageBuffer,
          cert.certificateName,
          cert.unitName,
          cert.description,
          properties,
        );
        console.log(`  [ipfs] imageCid: ${imageHash} | metadataCid: ${metadataHash}`);

        // Phase 3: remint new asset
        const metadataUrl = `ipfs://${metadataHash}#arc3`;
        const { assetId: newAssetId, transactionId: mintTxId } = await mintNewAsset(
          issuerAddr,
          issuerEmail,
          cert.certificateName,
          cert.unitName,
          metadataUrl,
        );

        // Phase 4: update DB
        await prisma.issuedCertificate.update({
          where: { id: cert.id },
          data: {
            assetId: newAssetId,
            imageCid: imageHash,
            metadataCid: metadataHash,
            mintingStatus: 'MINTED',
            status: 'PENDING',
            mintTransactionHash: mintTxId,
          },
        });

        console.log(`  ✅ PENDING cert remediated. New assetId: ${newAssetId}`);
        results.success++;
        continue;
      }

    } catch (err) {
      console.error(`  ❌ Failed for cert ${cert.id}:`, err instanceof Error ? err.message : err);
      results.failed++;
    }
  }

  // ── 3. Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('Summary:');
  console.log(`  ✅ Success:  ${results.success}`);
  console.log(`  ❌ Failed:   ${results.failed}`);
  console.log(`  ⏭️  Skipped:  ${results.skipped}`);
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

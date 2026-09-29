import algosdk from "algosdk";
import { OPERATIONAL_WALLET, algodClient } from "@/lib/const";
import { signTransactions } from "@/lib/vault";
import { calculateSHA256, getEmailsHash } from "@/lib/utils";
import { storeAsCAR, storeMetadataAsCAR, saveImageFile } from "@/lib/car";

/** Per-badge on-chain cost in ALGO, plus the 0.102 base the issuer must retain. */
export const BADGE_BASE_COST = 0.102;
export const BADGE_UNIT_COST = 0.103;

export function badgeTotalCost(numToMint: number): number {
  return BADGE_BASE_COST + numToMint * BADGE_UNIT_COST;
}

export interface MintBadgeParams {
  issuerWalletAddress: string;
  issuerEmail: string;
  badgeName: string;
  unitName: string;
  description: string;
  imageBuffer: Buffer;
  imageMimeType: string;
  imageExt: string;
  numToMint: number;
  recipientEmails: string[];
  /** Passed through verbatim into the ARC-3 metadata `properties` field. */
  customProperties?: unknown;
}

export interface MintBadgeResult {
  assetId: string;
  txId: string;
  imageCid: string;
  metadataCid: string;
  confirmedRound?: number | bigint;
}

/**
 * Pins the badge image and ARC-3 metadata to IPFS and creates the badge ASA.
 *
 * Extracted from app/api/badges/create so the cookie-authenticated route and the
 * x402 route mint identically. Callers are responsible for auth, validation,
 * credit accounting and the issuer's ALGO balance check before calling this.
 */
export async function mintBadgeAsset(
  params: MintBadgeParams
): Promise<MintBadgeResult> {
  const {
    issuerWalletAddress,
    issuerEmail,
    badgeName,
    unitName,
    description,
    imageBuffer,
    imageMimeType,
    imageExt,
    numToMint,
    recipientEmails,
    customProperties,
  } = params;

  const imageCid = await storeAsCAR(new Uint8Array(imageBuffer));
  await saveImageFile(imageCid, imageBuffer, imageExt);

  const imageHash = await calculateSHA256(imageBuffer.buffer as ArrayBuffer);
  const emailsHash = await getEmailsHash(recipientEmails);

  const metadata = {
    name: badgeName,
    unit_name: unitName,
    creator: issuerWalletAddress,
    description,
    image: `ipfs://${imageCid}#arc3`,
    image_integrity: `sha256-${imageHash}`,
    image_mimetype: imageMimeType,
    properties: customProperties,
  };

  const metadataCid = await storeMetadataAsCAR(metadata);

  const suggestedParams = await algodClient.getTransactionParams().do();
  const group = [
    {
      txn: algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: issuerWalletAddress,
        total: numToMint,
        decimals: 0,
        assetName: badgeName,
        unitName: unitName,
        assetURL: `ipfs://${metadataCid}#arc3`,
        defaultFrozen: false,
        manager: issuerWalletAddress,
        reserve: issuerWalletAddress,
        freeze: issuerWalletAddress,
        clawback: issuerWalletAddress,
        suggestedParams,
        note: new TextEncoder().encode(
          `badge-${recipientEmails.length > 0 ? emailsHash : ""}`
        ),
      }),
      signerEmail: issuerEmail,
      signerAddress: issuerWalletAddress,
    },
    {
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: issuerWalletAddress,
        receiver: OPERATIONAL_WALLET,
        amount: algosdk.algosToMicroalgos(
          badgeTotalCost(numToMint) - BADGE_BASE_COST
        ),
        suggestedParams,
      }),
      signerEmail: issuerEmail,
      signerAddress: issuerWalletAddress,
    },
  ];

  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();

  const result = await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);

  return {
    assetId: result.assetIndex?.toString() || "",
    txId: txnIds[0],
    imageCid,
    metadataCid,
    confirmedRound: result.confirmedRound,
  };
}

import algosdk from "algosdk";
import { algodClient, OPERATIONAL_WALLET } from "@/lib/const";
import { signTransactions } from "@/lib/vault";

/**
 * Result of a successful NFT minting operation
 */
export interface MintResult {
  assetId: string;
  transactionId: string;
  confirmedRound: number;
}

/**
 * Parameters for minting a certificate NFT
 */
export interface MintCertificateParams {
  issuerAddress: string;
  issuerEmail: string;
  certificateName: string;
  unitName: string;
  metadataUrl: string;
  recipientEmail: string;
}

/**
 * Blockchain Minting Service
 * 
 * Handles NFT creation on Algorand blockchain for certificates.
 * Creates asset transactions with correct parameters and manages
 * the signing and submission process.
 */
export class BlockchainMintingService {
  /**
   * Mint a certificate as an NFT on Algorand blockchain
   * 
   * @param params - Minting parameters including issuer details and metadata
   * @returns Promise resolving to mint result with asset ID and transaction details
   * @throws Error if transaction creation, signing, or submission fails
   */
  async mintCertificate(params: MintCertificateParams): Promise<MintResult> {
    const {
      issuerAddress,
      issuerEmail,
      certificateName,
      unitName,
      metadataUrl,
      recipientEmail,
    } = params;

    console.log(`[BlockchainMinting] Starting NFT minting for certificate: ${certificateName}`);
    console.log(`[BlockchainMinting] Issuer: ${issuerAddress}, Recipient: ${recipientEmail}`);

    try {
      // Get suggested parameters from the network
      const suggestedParams = await algodClient.getTransactionParams().do();

      // Create asset creation transaction
      // - Total supply: 1 (unique certificate)
      // - Decimals: 0 (non-fungible)
      // - Asset URL: IPFS metadata URI with #arc3 suffix
      // - All management addresses set to issuer wallet
      const assetCreateTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: issuerAddress,
        total: 1,
        decimals: 0,
        assetName: certificateName.substring(0, 32), // Max 32 chars
        unitName: unitName.substring(0, 8), // Max 8 chars
        assetURL: metadataUrl,
        defaultFrozen: false,
        manager: issuerAddress,
        reserve: issuerAddress,
        freeze: issuerAddress,
        clawback: issuerAddress,
        suggestedParams,
      });

      console.log(`[BlockchainMinting] Created asset creation transaction`);

      // Create payment transaction for platform fee
      // Platform fee: 0.103 ALGO to operational wallet
      const platformFee = 0.103;
      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: issuerAddress,
        receiver: OPERATIONAL_WALLET,
        amount: algosdk.algosToMicroalgos(platformFee),
        suggestedParams,
      });

      console.log(`[BlockchainMinting] Created payment transaction for platform fee: ${platformFee} ALGO`);

      // Group transactions for atomic execution
      const group = [
        {
          txn: assetCreateTxn,
          signerEmail: issuerEmail,
          signerAddress: issuerAddress,
        },
        {
          txn: paymentTxn,
          signerEmail: issuerEmail,
          signerAddress: issuerAddress,
        },
      ];

      // Sign transactions using vault service
      console.log(`[BlockchainMinting] Signing transactions...`);
      const { bytes, txnIds } = await signTransactions(group);

      // Submit to Algorand network
      console.log(`[BlockchainMinting] Submitting transactions to Algorand network...`);
      await algodClient.sendRawTransaction(bytes).do();

      // Wait for confirmation (3 rounds)
      console.log(`[BlockchainMinting] Waiting for confirmation (transaction ID: ${txnIds[0]})...`);
      const confirmedTxn = await algosdk.waitForConfirmation(
        algodClient,
        txnIds[0],
        3
      );

      // Extract asset ID from confirmed transaction
      const assetId = confirmedTxn.assetIndex;
      if (!assetId) {
        throw new Error("Asset ID not found in confirmed transaction");
      }

      console.log(`[BlockchainMinting] Successfully minted NFT. Asset ID: ${assetId}, Transaction ID: ${txnIds[0]}, Confirmed Round: ${confirmedTxn.confirmedRound}`);

      return {
        assetId: assetId.toString(),
        transactionId: txnIds[0],
        confirmedRound: Number(confirmedTxn.confirmedRound || 0),
      };
    } catch (error: any) {
      // Handle transaction failures with descriptive errors
      const errorMessage = error?.message || "Unknown error";
      console.error(
        `[BlockchainMinting] Failed to mint certificate NFT: ${errorMessage}`,
        `Issuer: ${issuerAddress}, Recipient: ${recipientEmail}`
      );
      throw new Error(
        `Failed to mint certificate NFT: ${errorMessage}. ` +
        `Issuer: ${issuerAddress}, Recipient: ${recipientEmail}`
      );
    }
  }
}

// Export singleton instance
export const blockchainMintingService = new BlockchainMintingService();

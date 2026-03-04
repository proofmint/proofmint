/**
 * Queue Processing Service
 *
 * Handles asynchronous processing of bulk certificate jobs.
 * Uses a simple in-memory queue with sequential processing.
 */

import prisma from '@/lib/prisma';
import { generateCertificate } from './imageGenerator';
import { uploadCertificateWithMetadata } from './ipfsStorage';
import { blockchainMintingService } from './blockchainMinting';
import { sendCertificateEmail } from './emailNotification';
import { refundCredits } from './creditManager';
import { absoluteCertificateImageUrl } from '../imageUrl';
import { CredentialStatus, JobStatus, MintingStatus, TransactionType } from '@prisma/client';

/**
 * Certificate task to be processed in the queue
 */
export interface CertificateTask {
  /** If set, use this existing DB record instead of creating a new one */
  certificateId?: string;
  templateId: string;
  recipientEmail: string;
  recipientName: string;
  fieldData: Record<string, string>;
  customProperties: Array<{ key: string; value: string }>;
  jobId: string;
  issuerId: string;
  issuerAddress: string;
  issuerEmail: string;
  issuerName: string;
  certificateName: string;
  unitName: string;
  description: string;
  sendEmail: boolean;
}

/**
 * Simple in-memory queue processor for certificate generation
 */
class QueueProcessor {
  private queue: CertificateTask[] = [];
  private processing = false;

  /**
   * Add a certificate task to the queue
   * Automatically starts processing if not already running
   * 
   * @param task - Certificate task to enqueue
   */
  async enqueue(task: CertificateTask): Promise<void> {
    this.queue.push(task);
    console.log(`[QueueProcessor] Enqueued task for ${task.recipientEmail} in job ${task.jobId}. Queue length: ${this.queue.length}`);

    if (!this.processing) {
      this.processQueue().catch(error => {
        console.error('[QueueProcessor] Queue processing error:', error);
      });
    }
  }

  /**
   * Process all tasks in the queue sequentially
   * Continues processing until queue is empty
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    console.log('[QueueProcessor] Starting queue processing...');

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) continue;

        console.log(`[QueueProcessor] Processing certificate for ${task.recipientEmail} (${this.queue.length} remaining)`);

        try {
          await this.processCertificate(task);
          await this.updateJobProgress(task.jobId, 'success');
        } catch (error) {
          console.error(`[QueueProcessor] Certificate processing failed for ${task.recipientEmail}:`, error);
          await this.updateJobProgress(task.jobId, 'failure', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      console.log('[QueueProcessor] Queue processing completed.');
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single certificate task
   * Generates image, uploads to IPFS, mints NFT, and sends email
   * 
   * @param task - Certificate task to process
   */
  private async processCertificate(task: CertificateTask): Promise<void> {
    const {
      templateId,
      recipientEmail,
      recipientName,
      fieldData,
      customProperties,
      jobId,
      issuerId,
      issuerAddress,
      issuerEmail,
      issuerName,
      certificateName,
      unitName,
      description,
      sendEmail,
    } = task;

    console.log(`[QueueProcessor] Starting certificate issuance for ${recipientEmail} in job ${jobId}`);

    // Merge fieldData and custom properties
    const mergedProperties: Record<string, string> = { ...fieldData };
    for (const prop of customProperties) {
      mergedProperties[prop.key] = prop.value;
    }

    // Use pre-created record if certificateId is provided (bulk flow), otherwise create one
    let certificate: { id: string };
    if (task.certificateId) {
      certificate = { id: task.certificateId };
      console.log(`[QueueProcessor] Using pre-created certificate record ${certificate.id}`);
    } else {
      certificate = await prisma.issuedCertificate.create({
        data: {
          templateId,
          receiverEmail: recipientEmail,
          issuerId,
          jobId,
          certificateName,
          unitName,
          description,
          properties: mergedProperties,
          mintingStatus: MintingStatus.PENDING,
          status: CredentialStatus.PENDING,
        },
      });
      console.log(`[QueueProcessor] Created certificate record ${certificate.id}`);
    }

    try {
      // Step 1: Generate image
      const imageBuffer = await generateCertificate(templateId, fieldData);

      // Step 2: Upload to IPFS
      const { imageHash, metadataHash, imageUrl } = await uploadCertificateWithMetadata(
        imageBuffer,
        certificateName,
        unitName,
        description,
        mergedProperties
      );

      // Step 3: Mint NFT on Algorand
      const metadataUrl = `ipfs://${metadataHash}#arc3`;
      const mintResult = await blockchainMintingService.mintCertificate({
        issuerAddress,
        issuerEmail,
        certificateName,
        unitName,
        metadataUrl,
        recipientEmail,
      });

      // Step 4: Update record — minting succeeded, status stays PENDING for recipient to claim
      await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          assetId: mintResult.assetId,
          imageCid: imageHash,
          metadataCid: metadataHash,
          mintingStatus: MintingStatus.MINTED,
          status: CredentialStatus.PENDING,
          mintTransactionHash: mintResult.transactionId,
        },
      });

      console.log(`[QueueProcessor] Successfully minted certificate ${certificate.id} with asset ID ${mintResult.assetId}`);

      // Step 5: Send email — failure is non-fatal after minting
      if (sendEmail) {
        try {
          await sendCertificateEmail({
            recipientEmail,
            recipientName,
            issuerName,
            certificateName,
            certificateId: certificate.id,
            assetId: mintResult.assetId,
            imageUrl: absoluteCertificateImageUrl(imageHash),
          });
        } catch (emailError) {
          console.error(`[QueueProcessor] Email failed for certificate ${certificate.id} (non-fatal):`, emailError);
        }
      }
    } catch (error) {
      console.error(`[QueueProcessor] Minting failed for certificate ${certificate.id}:`, error);

      // Mark as FAILED only if error occurred before/during minting
      await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          mintingStatus: MintingStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Refund credit for failed certificate
      await refundCredits(issuerId, 1, TransactionType.MINT_CERTIFICATE);

      throw error;
    }
  }

  private async updateJobProgress(
    jobId: string,
    result: 'success' | 'failure',
    errorMessage?: string
  ): Promise<void> {
    try {
      const job = await prisma.bulkIssuanceJob.findUnique({ where: { id: jobId } });
      if (!job) {
        console.error(`[QueueProcessor] Job ${jobId} not found`);
        return;
      }

      const processedItems = job.processedItems + 1;
      const failedItems = result === 'failure' ? job.failedItems + 1 : job.failedItems;
      const allProcessed = processedItems >= job.totalItems;

      let statusMessages = job.statusMessages as Record<string, string> | null;
      if (result === 'failure' && errorMessage) {
        statusMessages = statusMessages || {};
        statusMessages[`item_${processedItems}`] = errorMessage;
      }

      await prisma.bulkIssuanceJob.update({
        where: { id: jobId },
        data: {
          processedItems,
          failedItems,
          status: allProcessed ? JobStatus.COMPLETED : JobStatus.PROCESSING,
          statusMessages: statusMessages ?? undefined,
        },
      });

      console.log(
        `[QueueProcessor] Updated job ${jobId}: ${processedItems}/${job.totalItems} processed, ${failedItems} failed${allProcessed ? ' (COMPLETED)' : ''}`
      );
    } catch (error) {
      console.error(`[QueueProcessor] Failed to update job progress for ${jobId}:`, error);
    }
  }

  getStatus(): { queueLength: number; processing: boolean } {
    return { queueLength: this.queue.length, processing: this.processing };
  }

  /**
   * Re-enqueue any bulk certificates that are still PENDING in the DB.
   * Called on server startup to recover tasks lost due to a crash or restart.
   */
  async recoverPendingCertificates(): Promise<void> {
    console.log('[QueueProcessor] Scanning for pending bulk certificates to recover...');

    const pendingCerts = await prisma.issuedCertificate.findMany({
      where: {
        mintingStatus: MintingStatus.PENDING,
        jobId: { not: null },
      },
      include: {
        job: true,
        issuer: { include: { user: true } },
      },
    });

    if (pendingCerts.length === 0) {
      console.log('[QueueProcessor] No pending certificates found — nothing to recover.');
      return;
    }

    console.log(`[QueueProcessor] Recovering ${pendingCerts.length} pending certificate(s)...`);

    for (const cert of pendingCerts) {
      if (!cert.job) continue;

      const properties = cert.properties as Record<string, string>;
      await this.enqueue({
        certificateId: cert.id,
        templateId: cert.templateId,
        recipientEmail: cert.receiverEmail,
        recipientName: properties.recipientName || properties.name || 'Recipient',
        // Pass stored properties as fieldData — template fields are a subset and will be used correctly
        fieldData: properties,
        customProperties: [],
        jobId: cert.jobId!,
        issuerId: cert.issuerId,
        issuerAddress: cert.issuer.user.walletAddress,
        issuerEmail: cert.issuer.user.email,
        issuerName: cert.issuer.user.organizationName,
        certificateName: cert.certificateName,
        unitName: cert.unitName,
        description: cert.description,
        sendEmail: cert.job.sendEmail,
      });
    }

    console.log('[QueueProcessor] Recovery enqueuing complete.');
  }
}

export const queueProcessor = new QueueProcessor();

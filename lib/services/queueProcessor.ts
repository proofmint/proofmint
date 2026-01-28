/**
 * Queue Processing Service
 * 
 * Handles asynchronous processing of bulk certificate jobs.
 * Uses a simple in-memory queue with sequential processing.
 * 
 * Requirements: 2.5, 2.6, 2.7, 2.8, 8.7
 */

import prisma from '@/lib/prisma';
import { generateCertificate } from './imageGenerator';
import { uploadCertificateWithMetadata } from './ipfsStorage';
import { blockchainMintingService } from './blockchainMinting';
import { sendCertificateEmail } from './emailNotification';
import { refundCredits } from './creditManager';
import { CredentialStatus, JobStatus, TransactionType } from '@prisma/client';

/**
 * Certificate task to be processed in the queue
 */
export interface CertificateTask {
  templateId: string;
  recipientEmail: string;
  recipientName: string;
  fieldData: Record<string, string>;
  jobId: string;
  issuerId: string;
  issuerAddress: string;
  issuerEmail: string;
  certificateName: string;
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
    console.log(`[QueueProcessor] Enqueued certificate task for ${task.recipientEmail} in job ${task.jobId}. Queue length: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.processing) {
      // Don't await - let it run in background
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
    // Prevent concurrent processing
    if (this.processing) {
      return;
    }

    this.processing = true;
    console.log('[QueueProcessor] Starting queue processing...');

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) continue;

        console.log(`[QueueProcessor] Processing certificate for ${task.recipientEmail} (${this.queue.length} remaining in queue)`);

        try {
          await this.processCertificate(task);
          await this.updateJobProgress(task.jobId, 'success');
        } catch (error) {
          console.error(`[QueueProcessor] Certificate processing failed for ${task.recipientEmail}:`, error);
          await this.updateJobProgress(task.jobId, 'failure', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      console.log('[QueueProcessor] Queue processing completed. Queue is now empty.');
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
      jobId,
      issuerId,
      issuerAddress,
      issuerEmail,
      certificateName,
    } = task;

    console.log(`[QueueProcessor] Starting certificate issuance for ${recipientEmail} in job ${jobId}`);

    // Create IssuedCertificate record with PENDING status
    const certificate = await prisma.issuedCertificate.create({
      data: {
        assetId: '', // Will be updated after minting
        templateId,
        receiverEmail: recipientEmail,
        issuerId,
        jobId,
        fieldData,
        generatedImageUrl: '', // Will be updated after IPFS upload
        status: CredentialStatus.PENDING,
      },
    });

    console.log(`[QueueProcessor] Created certificate record ${certificate.id} with PENDING status`);

    try {
      // Step 1: Generate certificate image
      console.log(`[QueueProcessor] Step 1/4: Generating image for certificate ${certificate.id}`);
      const imageBuffer = await generateCertificate(templateId, fieldData);

      // Step 2: Upload to IPFS (image + metadata)
      console.log(`[QueueProcessor] Step 2/4: Uploading to IPFS for certificate ${certificate.id}`);
      const { imageHash, metadataHash, imageUrl } = await uploadCertificateWithMetadata(
        imageBuffer,
        certificateName,
        `Certificate issued to ${recipientName}`,
        fieldData
      );

      // Step 3: Mint NFT on Algorand
      console.log(`[QueueProcessor] Step 3/4: Minting NFT for certificate ${certificate.id}`);
      const metadataUrl = `ipfs://${metadataHash}#arc3`;
      const mintResult = await blockchainMintingService.mintCertificate({
        issuerAddress,
        issuerEmail,
        certificateName,
        unitName: 'CERT',
        metadataUrl,
        recipientEmail,
      });

      // Step 4: Update certificate record with success
      console.log(`[QueueProcessor] Step 4/4: Updating certificate ${certificate.id} with success status`);
      await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          assetId: mintResult.assetId,
          generatedImageUrl: imageUrl,
          status: CredentialStatus.CLAIMED, // CLAIMED = successfully minted
          transactionHash: mintResult.transactionId,
          claimedAt: new Date(),
        },
      });

      // Step 5: Send email notification (failures are logged but don't fail the process)
      console.log(`[QueueProcessor] Sending email notification for certificate ${certificate.id}`);
      await sendCertificateEmail({
        recipientEmail,
        recipientName,
        certificateName,
        assetId: mintResult.assetId,
        imageUrl,
      });

      console.log(`[QueueProcessor] Successfully completed certificate ${certificate.id} with asset ID ${mintResult.assetId}`);
    } catch (error) {
      console.error(`[QueueProcessor] Failed to process certificate ${certificate.id}:`, error);

      // Update certificate status to REJECTED on failure
      await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          status: CredentialStatus.REJECTED,
        },
      });

      // Refund credit for this failed certificate
      console.log(`[QueueProcessor] Refunding 1 credit to issuer ${issuerId} for failed certificate ${certificate.id}`);
      await refundCredits(issuerId, 1, TransactionType.MINT_CERTIFICATE);

      throw error;
    }
  }

  /**
   * Update bulk job progress counters
   * Increments processedItems or failedItems and updates job status
   * 
   * @param jobId - Bulk job ID
   * @param result - 'success' or 'failure'
   * @param errorMessage - Optional error message for failures
   */
  private async updateJobProgress(
    jobId: string,
    result: 'success' | 'failure',
    errorMessage?: string
  ): Promise<void> {
    try {
      // Fetch current job state
      const job = await prisma.bulkIssuanceJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        console.error(`[QueueProcessor] Job ${jobId} not found`);
        return;
      }

      // Calculate new counters
      const processedItems = job.processedItems + 1;
      const failedItems = result === 'failure' ? job.failedItems + 1 : job.failedItems;
      const allProcessed = processedItems >= job.totalItems;

      // Update status messages if there's an error
      let statusMessages = job.statusMessages as Record<string, string> | null;
      if (result === 'failure' && errorMessage) {
        statusMessages = statusMessages || {};
        statusMessages[`item_${processedItems}`] = errorMessage;
      }

      // Update job record
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

  /**
   * Get current queue status
   * @returns Number of tasks in queue and processing state
   */
  getStatus(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }
}

// Export singleton instance
export const queueProcessor = new QueueProcessor();

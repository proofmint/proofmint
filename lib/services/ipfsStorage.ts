import { uploadImageToStoracha, uploadJsonToStoracha } from '../storacha';
import { CERTIFICATES_PATH } from '../uploads';
import { certificateImageUrl } from '../imageUrl';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { IPFSUploadResult, CertificateMetadata } from '../types/certificate';

/**
 * IPFS Storage Service
 * 
 * Handles uploading certificate images and metadata to IPFS via Storacha.
 * Implements ARC3 standard for Algorand NFT metadata.
 */

/**
 * Upload an image buffer to IPFS via Storacha
 * 
 * @param imageBuffer - The image data as a Buffer
 * @param filename - The filename for the image (e.g., "certificate.png")
 * @returns IPFS upload result with hash, size, and timestamp
 */
export async function uploadImage(
  imageBuffer: Buffer,
  filename: string
): Promise<IPFSUploadResult> {
  console.log(`[IPFSStorage] Uploading image to IPFS: ${filename} (${imageBuffer.length} bytes)`);
  
  try {
    const uint8Array = new Uint8Array(imageBuffer);
    const blob = new Blob([uint8Array], { type: 'image/png' });
    const file = new File([blob], filename, { type: 'image/png' });

    const result = await uploadImageToStoracha(file);

    // Save local copy
    await fs.writeFile(path.join(CERTIFICATES_PATH, `${result.IpfsHash}.png`), imageBuffer);

    console.log(`[IPFSStorage] Successfully uploaded image to IPFS: ${result.IpfsHash}`);

    return {
      IpfsHash: result.IpfsHash,
    };
  } catch (error) {
    console.error(`[IPFSStorage] Failed to upload image to IPFS:`, error);
    throw new Error(`Failed to upload image to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate SHA256 hash of image buffer for integrity verification
 * 
 * @param imageBuffer - The image data as a Buffer
 * @returns SHA256 hash in base64 format with "sha256-" prefix
 */
export function calculateImageHash(imageBuffer: Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(imageBuffer);
  return `sha256-${hash.digest('base64')}`;
}

/**
 * Upload certificate metadata to IPFS via Storacha
 * Formats metadata according to ARC3 standard for Algorand NFTs
 * 
 * @param metadata - Certificate metadata object
 * @returns IPFS upload result with hash, size, and timestamp
 */
export async function uploadMetadata(
  metadata: CertificateMetadata
): Promise<IPFSUploadResult> {
  console.log(`[IPFSStorage] Uploading metadata to IPFS for certificate: ${metadata.name}`);
  
  try {
    // Validate metadata has required fields
    if (!metadata.name || !metadata.image || !metadata.image_integrity) {
      throw new Error('Metadata must include name, image, and image_integrity fields');
    }

    const result = await uploadJsonToStoracha(metadata);

    console.log(`[IPFSStorage] Successfully uploaded metadata to IPFS: ${result.IpfsHash}`);

    return {
      IpfsHash: result.IpfsHash,
    };
  } catch (error) {
    console.error(`[IPFSStorage] Failed to upload metadata to IPFS:`, error);
    throw new Error(`Failed to upload metadata to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Format IPFS hash as ARC3-compliant URI
 * 
 * @param ipfsHash - The IPFS content hash (CID)
 * @returns Formatted URI: ipfs://hash#arc3
 */
export function formatARC3ImageUri(ipfsHash: string): string {
  return `ipfs://${ipfsHash}#arc3`;
}

/**
 * Complete workflow: Upload image and create metadata with integrity hash
 * 
 * @param imageBuffer - The certificate image as a Buffer
 * @param certificateName - Name of the certificate
 * @param description - Description of the certificate
 * @param properties - Additional properties (e.g., recipient name, course, date)
 * @returns Object containing image IPFS hash and metadata IPFS hash
 */
export async function uploadCertificateWithMetadata(
  imageBuffer: Buffer,
  certificateName: string,
  unitName: string,
  description: string,
  properties: Record<string, string>
): Promise<{
  imageHash: string;
  metadataHash: string;
  imageUrl: string;
}> {
  console.log(`[IPFSStorage] Starting complete upload workflow for certificate: ${certificateName}`);
  
  try {
    // Step 1: Upload image to IPFS
    const imageResult = await uploadImage(imageBuffer, 'certificate.png');

    if(!imageResult || !imageResult.IpfsHash) {
      throw new Error('Failed to upload image to IPFS');
    }

    // Step 2: Calculate image integrity hash
    const imageIntegrity = calculateImageHash(imageBuffer);
    console.log(`[IPFSStorage] Calculated image integrity hash: ${imageIntegrity.substring(0, 20)}...`);

    // Step 3: Create metadata with ARC3-formatted image URI
    const metadata: CertificateMetadata = {
      name: certificateName,
      unit_name: unitName,
      description: description,
      image: formatARC3ImageUri(imageResult.IpfsHash),
      image_integrity: imageIntegrity,
      image_mimetype: 'image/png',
      properties: properties,
    };

    // Step 4: Upload metadata to IPFS
    const metadataResult = await uploadMetadata(metadata);

    if(!metadataResult || !metadataResult.IpfsHash) {
      throw new Error('Failed to upload metadata to IPFS');
    }

    console.log(`[IPFSStorage] Complete upload workflow finished. Image: ${imageResult.IpfsHash}, Metadata: ${metadataResult.IpfsHash}`);

    return {
      imageHash: imageResult.IpfsHash,
      metadataHash: metadataResult.IpfsHash,
      imageUrl: certificateImageUrl(imageResult.IpfsHash),
    };
  } catch (error) {
    console.error(`[IPFSStorage] Failed in complete certificate upload workflow:`, error);
    throw error;
  }
}

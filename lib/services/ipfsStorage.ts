import { PINATA_GATEWAY } from '../const';
import { uploadToPinata, uploadJsonToPinata } from '../pinata';
import crypto from 'crypto';
import { IPFSUploadResult, CertificateMetadata } from '../types/certificate';

/**
 * IPFS Storage Service
 * 
 * Handles uploading certificate images and metadata to IPFS via Pinata.
 * Implements ARC3 standard for Algorand NFT metadata.
 */

/**
 * Upload an image buffer to IPFS via Pinata
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
    // Convert Buffer to File object for Pinata upload
    const uint8Array = new Uint8Array(imageBuffer);
    const blob = new Blob([uint8Array], { type: 'image/png' });
    const file = new File([blob], filename, { type: 'image/png' });

    // Upload to Pinata
    const result = await uploadToPinata(file);

    console.log(`[IPFSStorage] Successfully uploaded image to IPFS: ${result.IpfsHash}`);

    return {
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp,
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
 * Upload certificate metadata to IPFS via Pinata
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

    // Upload metadata JSON to Pinata
    const result = await uploadJsonToPinata(metadata);

    console.log(`[IPFSStorage] Successfully uploaded metadata to IPFS: ${result.IpfsHash}`);

    return {
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp,
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

    console.log(`[IPFSStorage] Complete upload workflow finished. Image: ${imageResult.IpfsHash}, Metadata: ${metadataResult.IpfsHash}`);

    return {
      imageHash: imageResult.IpfsHash,
      metadataHash: metadataResult.IpfsHash,
      imageUrl: `${PINATA_GATEWAY}${imageResult.IpfsHash}`,
    };
  } catch (error) {
    console.error(`[IPFSStorage] Failed in complete certificate upload workflow:`, error);
    throw error;
  }
}

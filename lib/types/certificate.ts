/**
 * Certificate Issuance System Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the certificate issuance system.
 */

// ============================================================================
// Template Types
// ============================================================================

/**
 * Dynamic field definition for certificate templates
 * Defines positioning, styling, and constraints for text fields
 */
export interface DynamicField {
  /** Field identifier (e.g., "recipientName", "courseName") */
  name: string;
  /** X coordinate for text positioning (pixels from left) */
  x: number;
  /** Y coordinate for text positioning (pixels from top) */
  y: number;
  /** Font size in pixels (8-72) */
  fontSize: number;
  /** Font family name (e.g., "Arial", "Times New Roman") */
  fontFamily: string;
  /** Text color in hex format (#RRGGBB) */
  color: string;
  /** Optional maximum width for text wrapping (pixels) */
  maxWidth?: number;
  /** Optional maximum height for text scaling (pixels) */
  maxHeight?: number;
  /** Optional text alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Certificate template configuration
 */
export interface CertificateTemplate {
  id: string;
  issuerId: string;
  templateName: string;
  templateDescription: string;
  /** Filename of background image stored on server */
  backgroundImageUrl: string;
  /** Array of dynamic field definitions */
  dynamicFields: DynamicField[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Issuance Request Types
// ============================================================================

/**
 * Single certificate issuance request
 */
export interface SingleIssuanceRequest {
  /** Template ID to use for generation */
  templateId: string;
  /** Recipient email address */
  recipientEmail: string;
  /** Dynamic field values (field name -> value) */
  fieldData: Record<string, string>;
}

/**
 * Bulk certificate issuance request
 */
export interface BulkIssuanceRequest {
  /** Template ID to use for generation */
  templateId: string;
  /** CSV file with recipient data */
  csvFile: File;
}

/**
 * Recipient data from CSV parsing
 */
export interface RecipientData {
  /** Recipient email address */
  email: string;
  /** Dynamic field values for this recipient */
  fieldData: Record<string, string>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Single certificate issuance response
 */
export interface SingleIssuanceResponse {
  success: boolean;
  certificate?: {
    id: string;
    assetId: string;
    generatedImageUrl: string;
    status: string;
  };
  error?: string;
}

/**
 * Bulk certificate issuance response
 */
export interface BulkIssuanceResponse {
  success: boolean;
  job?: {
    id: string;
    totalItems: number;
    status: string;
  };
  error?: string;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * IPFS upload result from Pinata
 */
export interface IPFSUploadResult {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

/**
 * Certificate metadata following ARC3 standard
 */
export interface CertificateMetadata {
  /** Asset name */
  name: string;
  /** Asset description */
  description: string;
  /** IPFS image URL with #arc3 suffix */
  image: string;
  /** SHA256 hash of image for integrity verification */
  image_integrity: string;
  /** Image MIME type */
  image_mimetype: string;
  /** Additional certificate properties */
  properties: Record<string, string>;
}

/**
 * Blockchain minting result
 */
export interface MintResult {
  /** Algorand asset ID */
  assetId: string;
  /** Transaction ID */
  transactionId: string;
  /** Confirmed round number */
  confirmedRound: number;
}

/**
 * Certificate task for queue processing
 */
export interface CertificateTask {
  /** Template ID to use */
  templateId: string;
  /** Recipient email address */
  recipientEmail: string;
  /** Dynamic field values */
  fieldData: Record<string, string>;
  /** Associated bulk job ID (if applicable) */
  jobId?: string;
  /** Issuer ID */
  issuerId: string;
  /** Issuer email */
  issuerEmail: string;
}

// ============================================================================
// Database Model Types
// ============================================================================

/**
 * Issued certificate record
 */
export interface IssuedCertificate {
  id: string;
  assetId: string;
  templateId: string;
  receiverEmail: string;
  issuerId: string;
  jobId?: string;
  fieldData: Record<string, string>;
  generatedImageUrl: string;
  status: 'PENDING' | 'CLAIMED' | 'REJECTED';
  issuedAt: Date;
  claimedAt?: Date;
  transactionHash?: string;
}

/**
 * Bulk issuance job record
 */
export interface BulkIssuanceJob {
  id: string;
  issuerId: string;
  certificateTemplateId: string;
  recipientData: RecipientData[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  statusMessages?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Template creation request with file upload
 */
export interface CreateTemplateRequest {
  templateName: string;
  templateDescription: string;
  backgroundImage: File;
  dynamicFields: string; // JSON string of DynamicField[]
}

/**
 * Field validation error
 */
export interface FieldValidationError {
  field: string;
  message: string;
}

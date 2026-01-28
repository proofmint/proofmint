import prisma from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

/**
 * Credit Management Service
 * 
 * Handles validation, deduction, and refund of issuer credits for certificate minting.
 * All operations are atomic and create audit trail records.
 */

export interface CreditValidationResult {
  valid: boolean;
  currentBalance: number;
  required: number;
  error?: string;
}

export interface CreditOperationResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

/**
 * Validates that an issuer has sufficient credits for an operation
 * 
 * @param issuerId - The ID of the issuer
 * @param required - Number of credits required
 * @returns Validation result with current balance and validity
 */
export async function validateCredits(
  issuerId: string,
  required: number
): Promise<CreditValidationResult> {
  console.log(`[CreditManager] Validating credits for issuer ${issuerId}, required: ${required}`);
  
  try {
    // Fetch issuer's current credit balance
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      select: { creditBalance: true }
    });

    if (!issuer) {
      console.error(`[CreditManager] Issuer not found: ${issuerId}`);
      return {
        valid: false,
        currentBalance: 0,
        required,
        error: 'Issuer not found'
      };
    }

    const hasEnoughCredits = issuer.creditBalance >= required;

    if (hasEnoughCredits) {
      console.log(`[CreditManager] Credit validation passed for issuer ${issuerId}. Balance: ${issuer.creditBalance}, Required: ${required}`);
    } else {
      console.warn(`[CreditManager] Insufficient credits for issuer ${issuerId}. Balance: ${issuer.creditBalance}, Required: ${required}`);
    }

    return {
      valid: hasEnoughCredits,
      currentBalance: issuer.creditBalance,
      required,
      error: hasEnoughCredits 
        ? undefined 
        : `Insufficient credits. Required: ${required}, Available: ${issuer.creditBalance}`
    };
  } catch (error) {
    console.error(`[CreditManager] Error validating credits for issuer ${issuerId}:`, error);
    return {
      valid: false,
      currentBalance: 0,
      required,
      error: 'Failed to validate credits'
    };
  }
}

/**
 * Deducts credits from an issuer's balance atomically
 * Creates a credit transaction record for audit trail
 * 
 * @param issuerId - The ID of the issuer
 * @param amount - Number of credits to deduct
 * @param transactionType - Type of transaction (MINT_CERTIFICATE, etc.)
 * @returns Operation result with new balance and transaction ID
 */
export async function deductCredits(
  issuerId: string,
  amount: number,
  transactionType: TransactionType = TransactionType.MINT_CERTIFICATE
): Promise<CreditOperationResult> {
  console.log(`[CreditManager] Attempting to deduct ${amount} credits from issuer ${issuerId} for ${transactionType}`);
  
  try {
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // First, verify the issuer has sufficient credits
      const issuer = await tx.issuer.findUnique({
        where: { id: issuerId },
        select: { creditBalance: true }
      });

      if (!issuer) {
        throw new Error('Issuer not found');
      }

      if (issuer.creditBalance < amount) {
        throw new Error(
          `Insufficient credits. Required: ${amount}, Available: ${issuer.creditBalance}`
        );
      }

      // Deduct credits from issuer balance
      const updatedIssuer = await tx.issuer.update({
        where: { id: issuerId },
        data: {
          creditBalance: {
            decrement: amount
          }
        },
        select: { creditBalance: true }
      });

      // Create audit trail record (negative amount for deduction)
      const transaction = await tx.creditTransaction.create({
        data: {
          issuerId,
          type: transactionType,
          amount: -amount // Negative for deduction
        }
      });

      console.log(`[CreditManager] Successfully deducted ${amount} credits from issuer ${issuerId}. New balance: ${updatedIssuer.creditBalance}, Transaction ID: ${transaction.id}`);

      return {
        newBalance: updatedIssuer.creditBalance,
        transactionId: transaction.id
      };
    });

    return {
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId
    };
  } catch (error) {
    console.error(`[CreditManager] Failed to deduct credits for issuer ${issuerId}:`, error);
    return {
      success: false,
      newBalance: 0,
      error: error instanceof Error ? error.message : 'Failed to deduct credits'
    };
  }
}

/**
 * Refunds credits to an issuer's balance (used for failure recovery)
 * Creates a credit transaction record for audit trail
 * 
 * @param issuerId - The ID of the issuer
 * @param amount - Number of credits to refund
 * @param transactionType - Type of transaction (MINT_CERTIFICATE, etc.)
 * @returns Operation result with new balance and transaction ID
 */
export async function refundCredits(
  issuerId: string,
  amount: number,
  transactionType: TransactionType = TransactionType.MINT_CERTIFICATE
): Promise<CreditOperationResult> {
  console.log(`[CreditManager] Attempting to refund ${amount} credits to issuer ${issuerId} for ${transactionType}`);
  
  try {
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Add credits back to issuer balance
      const updatedIssuer = await tx.issuer.update({
        where: { id: issuerId },
        data: {
          creditBalance: {
            increment: amount
          }
        },
        select: { creditBalance: true }
      });

      // Create audit trail record (positive amount for refund)
      const transaction = await tx.creditTransaction.create({
        data: {
          issuerId,
          type: transactionType,
          amount: amount // Positive for refund
        }
      });

      console.log(`[CreditManager] Successfully refunded ${amount} credits to issuer ${issuerId}. New balance: ${updatedIssuer.creditBalance}, Transaction ID: ${transaction.id}`);

      return {
        newBalance: updatedIssuer.creditBalance,
        transactionId: transaction.id
      };
    });

    return {
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId
    };
  } catch (error) {
    console.error(`[CreditManager] Failed to refund credits for issuer ${issuerId}:`, error);
    return {
      success: false,
      newBalance: 0,
      error: error instanceof Error ? error.message : 'Failed to refund credits'
    };
  }
}

import type { X402ProductKind } from "@prisma/client";
import prisma from "@/lib/prisma";
import { USDC_ASA_ID, X402_NETWORK, getPayTo } from "./config";

export interface SettlementRecord {
  kind: X402ProductKind;
  issuerId: string;
  resource: string;
  amountAtomic: string;
  quantity: number;
  refId?: string;
  payer?: string;
  settlementTxId: string;
}

/**
 * Persists a settled x402 payment for audit and reconciliation.
 *
 * settlementTxId is unique, so a replayed settlement is a no-op rather than a
 * duplicate row. Never throws: the mint has already happened and the caller has
 * already been charged, so a bookkeeping failure must not turn into a 500.
 */
export async function recordSettlement(record: SettlementRecord): Promise<void> {
  try {
    await prisma.x402Payment.upsert({
      where: { settlementTxId: record.settlementTxId },
      update: {},
      create: {
        kind: record.kind,
        issuerId: record.issuerId,
        resource: record.resource,
        network: X402_NETWORK,
        asset: USDC_ASA_ID,
        amountAtomic: record.amountAtomic,
        payer: record.payer,
        payTo: getPayTo(),
        settlementTxId: record.settlementTxId,
        quantity: record.quantity,
        refId: record.refId,
      },
    });
  } catch (error) {
    console.error("[x402] failed to record settlement", record.settlementTxId, error);
  }
}

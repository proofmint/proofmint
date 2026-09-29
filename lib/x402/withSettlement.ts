import { NextRequest, NextResponse } from "next/server";
import { decodePaymentResponseHeader } from "@x402/core/http";
import type { SettleResponse } from "@x402/core/types";
import type { X402ProductKind } from "@prisma/client";
import { recordSettlement } from "./payments";

/**
 * Private header the inner handler uses to hand mint details to the outer
 * settlement recorder. Stripped before the response leaves the server.
 */
export const MINT_META_HEADER = "x-proofmint-mint";

export interface MintMeta {
  issuerId: string;
  quantity: number;
  refId?: string;
}

export function mintMetaHeaders(meta: MintMeta): Record<string, string> {
  return { [MINT_META_HEADER]: JSON.stringify(meta) };
}

/**
 * Wraps a withX402-wrapped handler to persist the settlement receipt.
 *
 * The resource-server side of @x402/core exposes no after-settle hook, and
 * withX402 settles only once the handler has already returned -- so the receipt
 * is only observable on the outgoing response, in the PAYMENT-RESPONSE header.
 * We read it here, pair it with the mint details the handler stashed in
 * MINT_META_HEADER, and write the X402Payment row.
 */
export function withSettlementRecording<T>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>,
  kind: X402ProductKind
): (req: NextRequest) => Promise<NextResponse<T>> {
  return async (req: NextRequest) => {
    const res = await handler(req);

    const metaRaw = res.headers.get(MINT_META_HEADER);
    if (metaRaw) res.headers.delete(MINT_META_HEADER);

    const receiptRaw =
      res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
    if (!receiptRaw || !metaRaw) return res;

    try {
      const receipt = decodePaymentResponseHeader(receiptRaw) as SettleResponse;
      if (!receipt?.success || !receipt.transaction) return res;

      const meta = JSON.parse(metaRaw) as MintMeta;
      await recordSettlement({
        kind,
        issuerId: meta.issuerId,
        resource: req.nextUrl.pathname,
        amountAtomic: receipt.amount ?? "",
        quantity: meta.quantity,
        refId: meta.refId,
        payer: receipt.payer,
        settlementTxId: receipt.transaction,
      });
    } catch (error) {
      console.error("[x402] failed to decode settlement receipt", error);
    }

    return res;
  };
}

/** CORS preflight for machine callers, following app/api/verify/route.ts. */
export function corsOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, X-Issuer-Key",
      "Access-Control-Expose-Headers": "PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
      "Access-Control-Max-Age": "86400",
    },
  });
}

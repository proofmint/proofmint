import { NextResponse } from "next/server";
import {
  USDC_ASA_ID,
  X402_CHALLENGE_TAG,
  X402_FACILITATOR_URL,
  X402_NETWORK,
  X402_PRICE_BADGE,
  X402_PRICE_CERTIFICATE,
  X402_PRICE_CLAIM,
  getPayTo,
} from "@/lib/x402/config";
import {
  badgeClaimRoute,
  badgeMintRoute,
  certificateBulkRoute,
  certificateMintRoute,
} from "@/lib/x402/routes";
import { corsOptions } from "@/lib/x402/withSettlement";
import { ALGORAND_NETWORK } from "@/lib/const";

export const runtime = "nodejs";

/**
 * Free, unauthenticated description of the paid surface, so an agent that finds
 * ProofMint through the Bazaar can work out how to call it without paying first.
 */
export async function GET() {
  let payTo: string | null = null;
  try {
    payTo = getPayTo();
  } catch {
    payTo = null;
  }

  return NextResponse.json(
    {
      service: "ProofMint",
      description:
        "Pay-per-mint Algorand credentials. Pay in USDC over x402 and receive an " +
        "ARC-3 badge or certificate ASA minted on Algorand, with image and metadata pinned to IPFS.",
      protocol: { x402Version: 2, scheme: "exact" },
      payment: {
        network: X402_NETWORK,
        mintNetwork: ALGORAND_NETWORK,
        asset: USDC_ASA_ID,
        assetSymbol: "USDC",
        decimals: 6,
        payTo,
        facilitator: X402_FACILITATOR_URL,
        tag: X402_CHALLENGE_TAG,
      },
      auth: {
        header: "X-Issuer-Key",
        description:
          "An issuer API key, created from the ProofMint issuer dashboard. Payment authorizes " +
          "the mint; the key identifies which issuer's wallet creates the ASA.",
      },
      endpoints: [
        {
          method: "POST",
          path: "/api/x402/badges/mint?count=N",
          price: `${X402_PRICE_BADGE} x N (count defaults to 1)`,
          description: badgeMintRoute.description,
          extensions: badgeMintRoute.extensions,
        },
        {
          method: "POST",
          path: "/api/x402/badges/claim/:claimId",
          price: X402_PRICE_CLAIM,
          description: badgeClaimRoute.description,
          extensions: badgeClaimRoute.extensions,
          auth: "Receiver session cookie. Not callable with X-Issuer-Key.",
        },
        {
          method: "POST",
          path: "/api/x402/certificates/mint",
          price: X402_PRICE_CERTIFICATE,
          description: certificateMintRoute.description,
          extensions: certificateMintRoute.extensions,
        },
        {
          method: "POST",
          path: "/api/x402/certificates/bulk?count=N",
          price: `${X402_PRICE_CERTIFICATE} x N`,
          description: certificateBulkRoute.description,
          extensions: certificateBulkRoute.extensions,
        },
      ],
    },
    { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export const OPTIONS = async () => corsOptions();

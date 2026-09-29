import type { RouteConfig } from "@x402/core/server";
import type { HTTPRequestContext, PaymentOption } from "@x402/core/http";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import {
  USDC_ASA_ID,
  X402_CHALLENGE_TAG,
  X402_FEE_PAYER,
  X402_NETWORK,
  X402_PRICE_BADGE,
  X402_PRICE_CERTIFICATE,
  X402_PRICE_CLAIM,
  getPayTo,
  priceFor,
  resourceUrl,
} from "./config";

const ICON_URL = resourceUrl("/icon-192.png");

function accepts(price: PaymentOption["price"]): PaymentOption {
  return {
    scheme: "exact",
    network: X402_NETWORK,
    payTo: () => getPayTo(),
    price,
    maxTimeoutSeconds: 120,
    extra: {
      asset: USDC_ASA_ID,
      // Fee abstraction: the facilitator covers ALGO fees, so a payer holding
      // only USDC can still transact.
      feePayer: X402_FEE_PAYER,
      // Challenge attribution. Written at settlement time and never applied
      // retroactively -- settlements before this tag existed stay uncounted.
      tag: X402_CHALLENGE_TAG,
    },
  };
}

/**
 * Reads the `count` query parameter for a per-unit price.
 *
 * The 402 challenge is built before the request body is read, so quantity has to
 * travel in the query string. Handlers then assert the body matches `count`, so
 * a caller cannot pay for one and receive fifty. Absent means one.
 */
export function countFromRequest(context: HTTPRequestContext): number {
  // getQueryParam is optional on HTTPAdapter; getUrl is not.
  const raw =
    context.adapter.getQueryParam?.("count") ??
    new URL(context.adapter.getUrl(), "http://localhost").searchParams.get("count");
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === null || value === undefined || value === "") return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("count query parameter must be a positive integer");
  }
  return n;
}

const ASSET_OUTPUT_SCHEMA = {
  properties: {
    assetId: { type: "string", description: "Algorand ASA ID of the minted credential" },
    txId: { type: "string", description: "Asset-creation transaction ID" },
    explorerUrl: { type: "string", description: "Block explorer link for the asset" },
    metadataCid: { type: "string", description: "IPFS CID of the ARC-3 metadata" },
    network: { type: "string", description: "Algorand network the ASA was minted on" },
  },
};

export const badgeMintRoute: RouteConfig = {
  accepts: accepts((context: HTTPRequestContext) =>
    priceFor(X402_PRICE_BADGE, countFromRequest(context))
  ),
  resource: resourceUrl("/api/x402/badges/mint"),
  serviceName: "ProofMint",
  iconUrl: ICON_URL,
  tags: [X402_CHALLENGE_TAG, "credentials", "algorand", "nft", "badges"],
  description:
    "Mints an ARC-3 compliant Algorand badge ASA and awards it to one or more recipients. " +
    "A badge is a single ASA whose supply equals the `count` query parameter, priced at the " +
    "per-badge rate times that count. The image and metadata are pinned to IPFS, the ASA is " +
    "created by the calling issuer's wallet, and the response returns the asset ID, the " +
    "metadata CID and the creation transaction ID. Named recipients are emailed a claim " +
    "link; a `magic` distribution instead returns a shareable claim link with `count` uses.",
  mimeType: "application/json",
  extensions: declareDiscoveryExtension({
    bodyType: "json",
    input: {
      badgeName: "Hackathon Finalist",
      unitName: "HACK",
      description: "Awarded to finalists of AlgoHack 1.0",
      imageUrl: "https://example.com/badge.png",
      distributionMethod: "email",
      recipientEmails: ["winner@example.com", "runnerup@example.com"],
    },
    inputSchema: {
      properties: {
        badgeName: { type: "string", maxLength: 32, description: "Badge name (ASA asset name)" },
        unitName: { type: "string", maxLength: 8, description: "ASA unit name" },
        description: { type: "string", maxLength: 128, description: "Badge description" },
        badgeType: { type: "string", description: "Optional badge category" },
        imageUrl: { type: "string", description: "Public URL of the badge image (PNG/JPEG/SVG, max 5MB)" },
        imageBase64: { type: "string", description: "Base64 image, as an alternative to imageUrl" },
        distributionMethod: {
          type: "string",
          enum: ["email", "magic"],
          description: "`email` awards the badge to named recipients; `magic` creates a shareable claim link. Defaults to `email`.",
        },
        recipientEmails: {
          type: "array",
          items: { type: "string" },
          description: "Emails of the recipients who may claim the badge. Required for `email`; length must equal the `count` query parameter.",
        },
        claimLimit: {
          type: "number",
          description: "Number of claims the magic link allows. Required for `magic`; must equal the `count` query parameter.",
        },
        properties: { type: "object", description: "Optional ARC-3 custom properties" },
      },
      required: ["badgeName", "unitName", "description"],
    },
    output: {
      example: {
        badgeId: "clx8k2p9v0001abcdefghijkl",
        assetId: "745823901",
        txId: "N2WKQ7ZL3RJXKQ5MHVLKQ2M4XKZ7YHQF6VJQXK4TXZQ3N5RJ7A2Q",
        explorerUrl: "https://allo.info/asset/745823901",
        metadataCid: "bafkreiavl4vqvzsyofcqmgpx2xkzxqf3rjxg5w4lqzk7tnvdqjq6mv6z4a",
        network: "mainnet",
        count: 2,
        distributionMethod: "email",
        recipientEmails: ["winner@example.com", "runnerup@example.com"],
      },
      schema: {
        properties: {
          ...ASSET_OUTPUT_SCHEMA.properties,
          badgeId: { type: "string", description: "ProofMint badge record ID" },
          count: { type: "number", description: "Badge units minted, equal to the `count` query parameter" },
          distributionMethod: { type: "string", description: "`email` or `magic`, echoing the request" },
          recipientEmails: {
            type: "array",
            items: { type: "string" },
            description: "Recipients awarded the badge; empty for `magic`",
          },
          claimLinkId: {
            type: "string",
            description: "Claim link ID for `magic` distribution, null otherwise",
          },
        },
      },
    },
  }),
};

export const badgeClaimRoute: RouteConfig = {
  accepts: accepts(X402_PRICE_CLAIM),
  resource: resourceUrl("/api/x402/badges/claim/:claimId"),
  serviceName: "ProofMint",
  iconUrl: ICON_URL,
  tags: [X402_CHALLENGE_TAG, "credentials", "algorand", "nft", "badges", "claim"],
  description:
    "Claims one unit of a magic-link badge ASA into the logged-in receiver's custodial " +
    "wallet. The caller must already be signed in as the receiver who is using the claim " +
    "link; payment is a USDC x402 settlement to ProofMint, after which the badge ASA is " +
    "opted in and transferred. Auth is the receiver session cookie, not an issuer API key.",
  mimeType: "application/json",
  extensions: declareDiscoveryExtension({
    bodyType: "json",
    input: {},
    inputSchema: { properties: {} },
    pathParams: { claimId: "clx8k2p9v0001abcdefghijkl" },
    pathParamsSchema: {
      properties: {
        claimId: {
          type: "string",
          description: "Magic-link claim ID from the URL path",
        },
      },
      required: ["claimId"],
    },
    output: {
      example: {
        txnId: "N2WKQ7ZL3RJXKQ5MHVLKQ2M4XKZ7YHQF6VJQXK4TXZQ3N5RJ7A2Q",
      },
      schema: {
        properties: {
          txnId: {
            type: "string",
            description: "Asset-transfer transaction ID of the claimed badge unit",
          },
        },
      },
    },
  }),
};

export const certificateMintRoute: RouteConfig = {
  accepts: accepts(X402_PRICE_CERTIFICATE),
  resource: resourceUrl("/api/x402/certificates/mint"),
  serviceName: "ProofMint",
  iconUrl: ICON_URL,
  tags: [X402_CHALLENGE_TAG, "credentials", "algorand", "nft", "certificates"],
  description:
    "Renders a certificate from one of the calling issuer's templates, pins the image and " +
    "ARC-3 metadata to IPFS, and mints it as a 1-of-1 Algorand ASA. Returns the asset ID, " +
    "metadata CID and transaction ID, and emails the recipient a claim link.",
  mimeType: "application/json",
  extensions: declareDiscoveryExtension({
    bodyType: "json",
    input: {
      templateId: "clx8k2p9v0001abcdefghijkl",
      recipientEmail: "student@example.com",
      certificateName: "Course Completion",
      unitName: "CERT",
      fieldData: { name: "Ada Lovelace", course: "Algorand Developer", date: "2026-09-01" },
    },
    inputSchema: {
      properties: {
        templateId: { type: "string", description: "ID of a certificate template owned by the calling issuer" },
        recipientEmail: { type: "string", description: "Email of the recipient who may claim the certificate" },
        certificateName: { type: "string", maxLength: 32, description: "ASA asset name" },
        unitName: { type: "string", maxLength: 8, description: "ASA unit name" },
        description: { type: "string", description: "Optional certificate description" },
        fieldData: { type: "object", description: "Values for every dynamic field declared on the template" },
        customProperties: { type: "object", description: "Optional ARC-3 custom properties" },
      },
      required: ["templateId", "recipientEmail", "certificateName", "unitName", "fieldData"],
    },
    output: {
      example: {
        assetId: "745823902",
        txId: "V7QKQ2ZL3RJXKQ5MHVLKQ2M4XKZ7YHQF6VJQXK4TXZQ3N5RJ7B4C",
        explorerUrl: "https://allo.info/asset/745823902",
        metadataCid: "bafkreihd4vqvzsyofcqmgpx2xkzxqf3rjxg5w4lqzk7tnvdqjq6mv6abc",
        network: "mainnet",
      },
      schema: ASSET_OUTPUT_SCHEMA,
    },
  }),
};

/**
 * Bulk price is a function of the `count` query parameter, because the 402
 * challenge is built before the request body is read. The handler asserts
 * `recipients.length === count` so a caller cannot underpay.
 */
export const certificateBulkRoute: RouteConfig = {
  accepts: accepts((context: HTTPRequestContext) =>
    priceFor(X402_PRICE_CERTIFICATE, countFromRequest(context))
  ),
  resource: resourceUrl("/api/x402/certificates/bulk"),
  serviceName: "ProofMint",
  iconUrl: ICON_URL,
  tags: [X402_CHALLENGE_TAG, "credentials", "algorand", "nft", "certificates", "bulk"],
  description:
    "Queues a batch of certificate ASAs from one template in a single payment, priced at the " +
    "per-certificate rate times the `count` query parameter. Each certificate is rendered, " +
    "pinned to IPFS and minted as a 1-of-1 Algorand ASA in the background, and every recipient " +
    "is emailed a claim link. Returns a job id to poll for progress.",
  mimeType: "application/json",
  extensions: declareDiscoveryExtension({
    bodyType: "json",
    input: {
      templateId: "clx8k2p9v0001abcdefghijkl",
      certificateName: "Course Completion",
      unitName: "CERT",
      description: "Awarded on completion of the Algorand Developer track",
      recipients: [
        { recipientEmail: "a@example.com", fieldData: { name: "Ada Lovelace" } },
        { recipientEmail: "b@example.com", fieldData: { name: "Alan Turing" } },
      ],
    },
    inputSchema: {
      properties: {
        templateId: { type: "string", description: "ID of a certificate template owned by the calling issuer" },
        certificateName: { type: "string", maxLength: 32, description: "ASA asset name, applied to every certificate in the batch" },
        unitName: { type: "string", maxLength: 8, description: "ASA unit name, applied to every certificate in the batch" },
        description: { type: "string", description: "Certificate description, applied to every certificate in the batch" },
        sendEmail: { type: "boolean", description: "Email each recipient a claim link. Defaults to true." },
        customProperties: {
          type: "array",
          description: "Optional ARC-3 properties added to every certificate",
          items: {
            type: "object",
            properties: { key: { type: "string" }, value: { type: "string" } },
            required: ["key", "value"],
          },
        },
        recipients: {
          type: "array",
          description: "One entry per certificate; length must equal the `count` query parameter",
          items: {
            type: "object",
            properties: {
              recipientEmail: { type: "string" },
              fieldData: {
                type: "object",
                description: "Values for every dynamic field declared on the template",
              },
            },
            required: ["recipientEmail", "fieldData"],
          },
        },
      },
      required: ["templateId", "certificateName", "unitName", "description", "recipients"],
    },
    output: {
      example: {
        success: true,
        job: { id: "clx9m3q7t0002abcdefghijkl", totalItems: 2, status: "PROCESSING" },
        network: "mainnet",
      },
      schema: {
        properties: {
          success: { type: "boolean" },
          job: {
            type: "object",
            description: "The queued issuance job. Poll it for per-certificate progress.",
            properties: {
              id: { type: "string", description: "Bulk issuance job ID" },
              totalItems: { type: "number", description: "Certificates queued" },
              status: { type: "string", description: "Job status, PROCESSING on acceptance" },
            },
          },
          network: { type: "string", description: "Algorand network the ASAs are minted on" },
        },
      },
    },
  }),
};

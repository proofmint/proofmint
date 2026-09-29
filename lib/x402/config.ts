import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_MAINNET_GENESIS_HASH,
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_TESTNET_GENESIS_HASH,
  USDC_MAINNET_ASA_ID,
  USDC_TESTNET_ASA_ID,
} from "@x402/avm";
import type { Network } from "@x402/core/types";
import {
  ALGOD_PORT,
  ALGOD_RPC,
  ALGORAND_NETWORK,
  APPLICATION_HOST,
} from "@/lib/const";

/**
 * x402 configuration.
 *
 * Everything derives from ALGORAND_NETWORK: USDC settles on the same chain the
 * ASAs are minted on, read through the same algod, so there is one network to
 * configure and one place to look for a balance.
 */
export const IS_MAINNET = ALGORAND_NETWORK === "mainnet";

/**
 * CAIP-2 identifiers come in two forms in the wild: @x402/avm truncates the
 * genesis hash to the 32-char CAIP-2 reference limit, while the GoPlausible
 * facilitator advertises the full genesis hash in /supported. We put the
 * facilitator's form on the wire (overridable via X402_NETWORK) and register the
 * scheme under both so lookups succeed either way.
 */
export const X402_NETWORK_CANONICAL = IS_MAINNET
  ? ALGORAND_MAINNET_CAIP2
  : ALGORAND_TESTNET_CAIP2;

export const X402_NETWORK_FULL = IS_MAINNET
  ? `algorand:${ALGORAND_MAINNET_GENESIS_HASH}`
  : `algorand:${ALGORAND_TESTNET_GENESIS_HASH}`;

export const X402_NETWORK = (process.env.X402_NETWORK ||
  X402_NETWORK_FULL) as Network;

export const USDC_ASA_ID = IS_MAINNET ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;

/**
 * Algod base URL for @x402/avm's client config, which takes a URL rather than a
 * host/port pair. Only a non-default port needs appending.
 */
export const ALGOD_BASE_URL =
  !ALGOD_PORT || ALGOD_PORT === 443 || ALGOD_PORT === 80
    ? ALGOD_RPC
    : `${ALGOD_RPC.replace(/\/$/, "")}:${ALGOD_PORT}`;

/** Block explorer for the network we mint and settle on. */
export const EXPLORER_BASE = IS_MAINNET
  ? "https://allo.info"
  : "https://lora.algokit.io/testnet";

export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://facilitator.goplausible.xyz";

/** Facilitator's AVM settlement signer; covers ALGO fees so payers need no ALGO. */
export const X402_FEE_PAYER =
  process.env.X402_FEE_PAYER ||
  "ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA";

export const X402_CHALLENGE_TAG =
  process.env.X402_CHALLENGE_TAG || "x402-global-challenge";

/**
 * Prices are configured as bare numbers ("2.00"), not "$2.00": Next's env loader
 * runs dotenv-expand, which would swallow "$2" as a variable reference and leave
 * ".00" behind.
 */
function priceEnv(name: string, fallback: number): string {
  const raw = process.env[name];
  const parsed = raw ? Number(String(raw).replace(/[^0-9.]/g, "")) : NaN;
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return `$${amount.toFixed(2)}`;
}

export const X402_PRICE_BADGE = priceEnv("X402_PRICE_BADGE", 2);
export const X402_PRICE_CERTIFICATE = priceEnv("X402_PRICE_CERTIFICATE", 2);
export const X402_PRICE_CLAIM = priceEnv("X402_PRICE_CLAIM", 1);

/**
 * Ceiling for a single client-side payment, used as the x402 client's spend
 * control. The SDK defaults to $1, which would reject even a single $2 mint.
 *
 * This is a backstop against a misconfigured price, not a batch limit: a bulk
 * call is already bounded by the issuer's credit balance, and lib/x402/client
 * refuses to sign any declaration that is not our own. Raise it if a single
 * batch can legitimately exceed it.
 */
export const X402_MAX_PAYMENT = priceEnv("X402_MAX_PAYMENT", 10000);

/**
 * Validated lazily rather than in lib/const.ts: that module's required-env check
 * throws at import time and is pulled in by nearly every route, so a missing
 * x402 var must not be able to take the whole app down.
 */
export function getPayTo(): string {
  const payTo = process.env.X402_PAY_TO;
  if (!payTo) {
    throw new Error(
      "X402_PAY_TO is not set. It must be an Algorand address opted into USDC ASA " +
        USDC_ASA_ID
    );
  }
  if (!/^[A-Z2-7]{58}$/.test(payTo)) {
    throw new Error("X402_PAY_TO is not a valid 58-character Algorand address");
  }
  return payTo;
}

/** Absolute public URL for a route; must not be localhost or the Bazaar files it under DEV. */
export function resourceUrl(path: string): string {
  return new URL(path, APPLICATION_HOST).toString();
}

/** Dollar price string for `n` units, e.g. priceFor("$2.00", 3) === "$6.00". */
export function priceFor(unitPrice: string, n: number): string {
  const unit = Number(unitPrice.replace(/[^0-9.]/g, ""));
  return `$${(unit * n).toFixed(2)}`;
}

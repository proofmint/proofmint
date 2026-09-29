import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import {
  ADMIN_WALLET,
  ALGORAND_NETWORK,
  ONBOARDING_WALLET,
  OPERATIONAL_WALLET,
  algodClient,
} from "@/lib/const";
import { EXPLORER_BASE, USDC_ASA_ID } from "./config";

export const USDC_DECIMALS = 6;
const USDC_ASSET_ID = BigInt(USDC_ASA_ID);

/** Base account MBR on Algorand, in ALGO. */
const ACCOUNT_BASE_MBR_ALGO = 0.1;
/** Extra MBR locked by opting into one ASA. */
const ASA_MBR_ALGO = 0.1;
/** Opt-in transaction fee. */
const OPT_IN_FEE_ALGO = 0.002;
/** Extra ALGO left spendable after the opt-in so a later USDC send is not stuck. */
const OPT_IN_HEADROOM_ALGO = 0.05;

export interface UsdcHolding {
  address: string;
  assetId: string;
  /** The network we mint and settle on, straight from ALGORAND_NETWORK. */
  network: string;
  optedIn: boolean;
  /** Atomic units (6 decimals), as a string so large balances stay exact. */
  balanceAtomic: string;
  /** Human-readable USDC, e.g. "12.500000". */
  balance: string;
  algoBalance: number;
  algoMinBalance: number;
  algoSpendable: number;
  explorerUrl: string;
}

function microalgosField(info: any, ...keys: string[]): number {
  for (const key of keys) {
    const value = info?.[key];
    if (value !== undefined && value !== null) {
      return algosdk.microalgosToAlgos(Number(value));
    }
  }
  return 0;
}

export function toUsdcDisplay(atomic: bigint | string | number): string {
  return (Number(atomic) / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS);
}

export function toUsdcAtomic(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

/** Atomic units for a "$1.00"-style x402 price string. */
export function priceToAtomic(price: string): bigint {
  return toUsdcAtomic(Number(price.replace(/[^0-9.]/g, "")));
}

/** Vault transit key for a platform wallet, or null if the address is external. */
export function platformSignerFor(
  address: string
): "admin" | "operational" | "onboarding" | null {
  if (address === ADMIN_WALLET) return "admin";
  if (address === OPERATIONAL_WALLET) return "operational";
  if (address === ONBOARDING_WALLET) return "onboarding";
  return null;
}

export async function getUsdcHolding(address: string): Promise<UsdcHolding> {
  const base = {
    address,
    assetId: USDC_ASA_ID,
    network: ALGORAND_NETWORK,
    explorerUrl: `${EXPLORER_BASE}/account/${address}`,
  };

  let info: any;
  try {
    info = await algodClient.accountInformation(address).do();
  } catch (e: any) {
    // An address that has never been funded on this network 404s; that is a
    // zero-balance, not-opted-in account rather than an error.
    if (e?.status === 404) {
      return {
        ...base,
        optedIn: false,
        balanceAtomic: "0",
        balance: toUsdcDisplay(0),
        algoBalance: 0,
        algoMinBalance: 0,
        algoSpendable: 0,
      };
    }
    throw e;
  }

  const holding = (info.assets ?? []).find(
    (a: any) => BigInt(a.assetId ?? a["asset-id"]) === USDC_ASSET_ID
  );
  const algoBalance = microalgosField(
    info,
    "amountWithoutPendingRewards",
    "amount-without-pending-rewards",
    "amount"
  );
  const minBalance = microalgosField(info, "minBalance", "min-balance");
  const balanceAtomic = holding ? String(holding.amount) : "0";

  return {
    ...base,
    optedIn: Boolean(holding),
    balanceAtomic,
    balance: toUsdcDisplay(balanceAtomic),
    algoBalance,
    algoMinBalance: minBalance,
    algoSpendable: Math.max(algoBalance - minBalance, 0),
  };
}

type SignedTxn = {
  txn: algosdk.Transaction;
  signerEmail: string;
  signerAddress: string;
};

async function sendGroup(group: SignedTxn[]): Promise<string[]> {
  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();
  await algosdk.waitForConfirmation(algodClient, txnIds[0], 5);
  return txnIds;
}

async function sendSigned(
  txn: algosdk.Transaction,
  signerEmail: string,
  signerAddress: string
): Promise<string> {
  const txnIds = await sendGroup([{ txn, signerEmail, signerAddress }]);
  return txnIds[0];
}

/**
 * ALGO the account must hold after a USDC opt-in: current MBR (at least the
 * 0.1 base) plus 0.1 for the new ASA plus the opt-in fee.
 */
function algoRequiredForUsdcOptIn(minBalance: number): number {
  const effectiveMin = Math.max(minBalance, ACCOUNT_BASE_MBR_ALGO);
  return effectiveMin + ASA_MBR_ALGO + OPT_IN_FEE_ALGO;
}

/**
 * Tops an account up from the admin wallet so it can cover the USDC opt-in.
 * Receiver wallets are often sitting at ~0.1 ALGO (onboarding only); opting
 * into an ASA raises min-balance to 0.2, so a spendable-only check is not
 * enough — we compare total ALGO to the post-opt-in min.
 */
async function ensureAlgoForOptIn(address: string, holding: UsdcHolding) {
  const required = algoRequiredForUsdcOptIn(holding.algoMinBalance);
  if (holding.algoBalance >= required) return;
  if (address === ADMIN_WALLET) {
    throw new Error(
      `Admin wallet needs at least ${required} ALGO to opt into USDC`
    );
  }

  const target = required + OPT_IN_HEADROOM_ALGO;
  const amountAlgos = Math.ceil((target - holding.algoBalance) * 1e6) / 1e6;
  const suggestedParams = await algodClient.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: ADMIN_WALLET,
    receiver: address,
    amount: algosdk.algosToMicroalgos(amountAlgos),
    suggestedParams,
  });

  try {
    await sendSigned(txn, "admin", ADMIN_WALLET);
  } catch (e) {
    throw new Error(
      `Could not fund ${address} for the USDC opt-in. It needs about ` +
        `${required} ALGO and the admin wallet could not cover it: ` +
        `${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/** Opts an account into the USDC ASA (a zero-amount self transfer). */
export async function optInToUsdc(params: {
  address: string;
  signerEmail: string;
}): Promise<{ txId: string; alreadyOptedIn: boolean }> {
  const holding = await getUsdcHolding(params.address);
  if (holding.optedIn) return { txId: "", alreadyOptedIn: true };

  await ensureAlgoForOptIn(params.address, holding);

  const suggestedParams = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: params.address,
    receiver: params.address,
    assetIndex: USDC_ASSET_ID,
    amount: 0,
    suggestedParams,
  });

  const txId = await sendSigned(txn, params.signerEmail, params.address);
  return { txId, alreadyOptedIn: false };
}

/** Sends USDC out of a platform-custodied account to any opted-in address. */
export async function withdrawUsdc(params: {
  from: string;
  signerEmail: string;
  to: string;
  amountAtomic: bigint;
}): Promise<{ txId: string }> {
  if (!algosdk.isValidAddress(params.to)) {
    throw new Error("Destination is not a valid Algorand address");
  }
  if (params.amountAtomic <= BigInt(0)) {
    throw new Error("Withdrawal amount must be greater than zero");
  }

  const source = await getUsdcHolding(params.from);
  if (!source.optedIn) {
    throw new Error("This account is not opted into USDC");
  }
  if (BigInt(source.balanceAtomic) < params.amountAtomic) {
    throw new Error(
      `Insufficient USDC: balance is ${source.balance}, requested ${toUsdcDisplay(
        params.amountAtomic
      )}`
    );
  }
  if (source.algoSpendable <= 0.001) {
    throw new Error(
      "Account has no spendable ALGO left to pay the transaction fee"
    );
  }

  // An asset transfer to an account that has not opted in fails on-chain, so
  // check first and give a message the user can act on.
  const destination = await getUsdcHolding(params.to);
  if (!destination.optedIn) {
    throw new Error("Destination address is not opted into USDC");
  }

  const suggestedParams = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: params.from,
    receiver: params.to,
    assetIndex: USDC_ASSET_ID,
    amount: params.amountAtomic,
    suggestedParams,
  });

  const txId = await sendSigned(txn, params.signerEmail, params.from);
  return { txId };
}

export function txExplorerUrl(txId: string): string {
  return `${EXPLORER_BASE}/tx/${txId}`;
}

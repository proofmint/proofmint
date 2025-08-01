import algosdk from "algosdk";

const envVariables = [
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "JWT_SECRET",
  "NODE_ENV",
  "EMAIL_FROM",
  "VAULT_TOKEN",
  "ALGORAND_NETWORK",
  "ADMIN_WALLET_MNEMONIC",
  "VAULT_HOST",
  "ALGOD_LOCALNET_RPC",
  "ALGOD_TESTNET_RPC",
  "ALGOD_MAINNET_RPC",
  "ALGOD_LOCALNET_TOKEN",
  "ALGOD_TESTNET_TOKEN",
  "ALGOD_MAINNET_TOKEN",
  "ALGOD_LOCALNET_PORT",
  "ALGOD_TESTNET_PORT",
  "ALGOD_MAINNET_PORT",
  "PINATA_JWT"
];

const missingEnvVariables = envVariables.filter(
  (variable) => !process.env[variable]
);

if (missingEnvVariables.length > 0) {
  throw new Error(
    `Missing environment variables: ${missingEnvVariables.join(", ")}`
  );
}

export const JWT_SECRET = process.env.JWT_SECRET!;
export const NODE_ENV = process.env.NODE_ENV!;

export const EMAIL_SERVER_HOST = process.env.EMAIL_SERVER_HOST!;
export const EMAIL_SERVER_PORT = Number(process.env.EMAIL_SERVER_PORT!);
export const EMAIL_SERVER_USER = process.env.EMAIL_SERVER_USER!;
export const EMAIL_SERVER_PASSWORD = process.env.EMAIL_SERVER_PASSWORD!;
export const EMAIL_FROM = process.env.EMAIL_FROM!;
export const VAULT_TOKEN = process.env.VAULT_TOKEN!;
export const ALGORAND_NETWORK = process.env.ALGORAND_NETWORK!;
export const ADMIN_WALLET_MNEMONIC = process.env.ADMIN_WALLET_MNEMONIC!;
export const VAULT_HOST = process.env.VAULT_HOST!;

export const ALGOD_LOCALNET_RPC = process.env.ALGOD_LOCALNET_RPC!;
export const ALGOD_TESTNET_RPC = process.env.ALGOD_TESTNET_RPC!;
export const ALGOD_MAINNET_RPC = process.env.ALGOD_MAINNET_RPC!;
export const ALGOD_LOCALNET_TOKEN = process.env.ALGOD_LOCALNET_TOKEN!;
export const ALGOD_TESTNET_TOKEN = process.env.ALGOD_TESTNET_TOKEN!;
export const ALGOD_MAINNET_TOKEN = process.env.ALGOD_MAINNET_TOKEN!;
export const ALGOD_LOCALNET_PORT = Number(process.env.ALGOD_LOCALNET_PORT!);
export const ALGOD_TESTNET_PORT = Number(process.env.ALGOD_TESTNET_PORT!);
export const ALGOD_MAINNET_PORT = Number(process.env.ALGOD_MAINNET_PORT!);

export const PINATA_JWT = process.env.PINATA_JWT!;

let algodClient: algosdk.Algodv2;

if (ALGORAND_NETWORK === "localnet") {
  algodClient = new algosdk.Algodv2(
    ALGOD_LOCALNET_TOKEN,
    ALGOD_LOCALNET_RPC,
    ALGOD_LOCALNET_PORT
  );
} else if (ALGORAND_NETWORK === "testnet") {
  algodClient = new algosdk.Algodv2(
    ALGOD_TESTNET_TOKEN,
    ALGOD_TESTNET_RPC,
    ALGOD_TESTNET_PORT
  );
} else if (ALGORAND_NETWORK === "mainnet") {
  algodClient = new algosdk.Algodv2(
    ALGOD_MAINNET_TOKEN,
    ALGOD_MAINNET_RPC,
    ALGOD_MAINNET_PORT
  );
}

const adminWallet = algosdk.mnemonicToSecretKey(ADMIN_WALLET_MNEMONIC);

export { algodClient, adminWallet };

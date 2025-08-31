import { Algodv2 } from "algosdk";

const envVariables = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",

  "APPLICATION_HOST",

  "VAULT_TOKEN",
  "VAULT_HOST",

  "PINATA_JWT",
  "DATABASE_URL",

  "JWT_SECRET",
  "NODE_ENV",

  "ALGORAND_NETWORK",
  "ALGOD_RPC",
  "ALGOD_PORT",
  "ALGOD_TOKEN",

  "ADMIN_WALLET",
  "OPERATIONAL_WALLET",
  "ONBOARDING_WALLET",

  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

const missingEnvVariables = envVariables.filter(
  (variable) => !process.env[variable]
);

if (missingEnvVariables.length > 0) {
  throw new Error(
    `Missing environment variables: ${missingEnvVariables.join(", ")}`
  );
}

export const EMAIL_SERVER_HOST = process.env.EMAIL_SERVER_HOST!;
export const EMAIL_SERVER_PORT = Number(process.env.EMAIL_SERVER_PORT!);
export const EMAIL_SERVER_USER = process.env.EMAIL_SERVER_USER!;
export const EMAIL_SERVER_PASSWORD = process.env.EMAIL_SERVER_PASSWORD!;
export const EMAIL_FROM = process.env.EMAIL_FROM!;

export const APPLICATION_HOST = process.env.APPLICATION_HOST!;

export const VAULT_TOKEN = process.env.VAULT_TOKEN!;
export const VAULT_HOST = process.env.VAULT_HOST!;

export const PINATA_JWT = process.env.PINATA_JWT!;
export const DATABASE_URL = process.env.DATABASE_URL!;

export const JWT_SECRET = process.env.JWT_SECRET!;
export const NODE_ENV = process.env.NODE_ENV!;

export const ALGORAND_NETWORK = process.env.ALGORAND_NETWORK!;
export const ALGOD_RPC = process.env.ALGOD_RPC!;
export const ALGOD_PORT = Number(process.env.ALGOD_PORT!);
export const ALGOD_TOKEN = process.env.ALGOD_TOKEN!;

export const ADMIN_WALLET = process.env.ADMIN_WALLET!;
export const OPERATIONAL_WALLET = process.env.OPERATIONAL_WALLET!;
export const ONBOARDING_WALLET = process.env.ONBOARDING_WALLET!;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

const algodClient = new Algodv2(ALGOD_TOKEN, ALGOD_RPC, ALGOD_PORT);

export { algodClient };

import "dotenv/config";
import algosdk from "algosdk";

if (!process.env.VAULT_HOST || !process.env.VAULT_TOKEN) {
  throw new Error("VAULT_HOST and VAULT_TOKEN must be set");
}

const VAULT_HOST = process.env.VAULT_HOST!;
const VAULT_TOKEN = process.env.VAULT_TOKEN!;

const getWallet = async (key: string) => {
  try {
    const res = await fetch(`${VAULT_HOST}/v1/transit/keys/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vault-Token": VAULT_TOKEN,
      },
      body: JSON.stringify({
        type: "ed25519",
        derived: false,
        allow_deletion: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();

    const publicKey: Buffer = Buffer.from(
      data.data.keys["1"].public_key,
      "base64"
    );

    const address = algosdk.encodeAddress(publicKey);

    return address;
  } catch (error) {
    console.error("Error getting wallet:", error);
    return null;
  }
};

async function main() {
  const adminWallet = await getWallet("admin");
  const operationalWallet = await getWallet("operational");
  const onboardingWallet = await getWallet("onboarding");

  console.log(`
ADMIN_WALLET="${adminWallet}"
OPERATIONAL_WALLET="${operationalWallet}"
ONBOARDING_WALLET="${onboardingWallet}"
`);
}

main();

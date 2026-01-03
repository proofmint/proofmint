import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  ADMIN_WALLET,
  OPERATIONAL_WALLET,
  ONBOARDING_WALLET,
} from "@/lib/const";
import { getDetailedBalances } from "@/lib/blockchain";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const getBalance = async (address: string) => {
      const { balance, minBalance, deltaBalance } = await getDetailedBalances(
        address
      );
      return {
        address,
        balance,
        minBalance,
        spendableBalance: deltaBalance,
      };
    };

    const [adminWallet, operationalWallet, onboardingWallet] =
      await Promise.all([
        getBalance(ADMIN_WALLET),
        getBalance(OPERATIONAL_WALLET),
        getBalance(ONBOARDING_WALLET),
      ]);

    // Constants for calculations
    const CREDIT_COST = 0.21; // Algos per credit
    const ONBOARDING_COST = 0.101; // Algos per user onboarding

    return NextResponse.json({
      wallets: {
        admin: adminWallet,
        operational: operationalWallet,
        onboarding: onboardingWallet,
      },
      calculations: {
        creditsPerAlgo: 1 / CREDIT_COST,
        usersPerAlgo: 1 / ONBOARDING_COST,
        creditCost: CREDIT_COST,
        onboardingCost: ONBOARDING_COST,
      },
    });
  } catch (e) {
    console.error("Failed to fetch wallet balances:", e);
    return NextResponse.json(
      { message: "Failed to fetch wallet balances" },
      { status: 500 }
    );
  }
}

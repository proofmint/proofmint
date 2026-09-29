import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";
import { getDetailedBalances } from "@/lib/blockchain";
import ProfileForm, { ProfileData } from "./profile-form";
import UsdcWalletCard from "@/components/usdc-wallet-card";

async function getIssuerProfileData(): Promise<ProfileData> {
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    redirect("/auth/login");
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;

    if (!userId) {
      redirect("/auth/login");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        issuerProfile: true,
      },
    });

    if (!user || !user.issuerProfile) {
      redirect("/issuer/dashboard");
    }

    const issuer = await prisma.issuer.findUnique({ where: { userId }, select: { creditBalance: true } });

    return {
      fullName: user.fullName,
      email: user.email,
      organizationName: user.organizationName,
      websiteUrl: user.issuerProfile.websiteUrl,
      walletAddress: user.walletAddress,
      balance: issuer?.creditBalance ?? 0,
      memberSince: user.createdAt,
    };
  } catch (error) {
    console.error("Failed to fetch profile data:", error);
    redirect("/auth/login");
  }
}

export default async function ProfilePage() {
  const profileData = await getIssuerProfileData();
  return (
    <div className="space-y-6">
      <ProfileForm profileData={profileData} />
      <UsdcWalletCard
        endpoint="/api/issuer/x402/usdc"
        title="USDC wallet"
        description="Your wallet pays for x402 mints in USDC. Top it up by sending USDC to the address below."
      />
    </div>
  );
}

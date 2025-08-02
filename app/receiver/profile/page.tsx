import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";
import { getDetailedBalances } from "@/lib/blockchain";
import ProfileForm, { ProfileData } from "./profile-form";

async function getReceiverProfileData(): Promise<ProfileData> {
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
    });

    if (!user || user.role !== "receiver") {
      redirect("/auth/login");
    }

    const { deltaBalance } = await getDetailedBalances(user.walletAddress);

    return {
      fullName: user.fullName,
      email: user.email,
      walletAddress: user.walletAddress,
      balance: deltaBalance,
      memberSince: user.createdAt,
    };
  } catch (error) {
    console.error("Failed to fetch profile data:", error);
    redirect("/auth/login");
  }
}

export default async function ProfilePage() {
  const profileData = await getReceiverProfileData();
  return <ProfileForm profileData={profileData} />;
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const token = (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const userId = (payload as any).userId as string;
    const { jobId } = await params;
    const job = await prisma.bulkIssuanceJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ message: "Not found" }, { status: 404 });
    // TODO: optionally enforce job.issuer.userId === userId
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}



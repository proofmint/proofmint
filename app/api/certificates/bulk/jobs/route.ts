import { NextRequest, NextResponse } from "next/server";
import { requireIssuer } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/certificates/bulk/jobs
 * 
 * Fetch all bulk issuance jobs for the authenticated issuer
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate issuer
    const issuer = await requireIssuer(req);
    if (!issuer || "error" in issuer) {
      if ("error" in issuer) {
        return issuer.error;
      }
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch all bulk jobs for this issuer
    const jobs = await prisma.bulkIssuanceJob.findMany({
      where: {
        issuerId: issuer.payload.userId,
      },
      include: {
        template: {
          select: {
            templateName: true,
            templateDescription: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (error: any) {
    console.error("Error fetching bulk jobs:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

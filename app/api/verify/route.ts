import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidEmail } from "@/lib/validators";

interface VerificationRequest {
  name: string;
  issueDate: string;
  userEmail: string;
}

interface VerificationResponse {
  name: string;
  issuerName: string;
  imageUrl: string;
  dateOfAchievement: string;
  type: "badge" | "certificate";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const issueDate = searchParams.get("issueDate");
    const userEmail = searchParams.get("userEmail");

    // Validate required parameters
    if (!name || !issueDate || !userEmail) {
      return NextResponse.json(
        { error: "Missing required parameters: name, issueDate, userEmail" },
        { status: 400 }
      );
    }

    if (!isValidEmail(userEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Parse the issue date for comparison
    const parsedIssueDate = new Date(issueDate);
    if (isNaN(parsedIssueDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid issue date format" },
        { status: 400 }
      );
    }

    // Search for matching badge
    const issuedBadge = await prisma.issuedBadge.findFirst({
      where: {
        receiverEmail: userEmail.toLowerCase(),
        badge: {
          name: name,
          createdAt: {
            gte: new Date(parsedIssueDate.setHours(0, 0, 0, 0)),
            lt: new Date(parsedIssueDate.setHours(23, 59, 59, 999)),
          },
        },
      },
      include: {
        badge: true,
        issuer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (issuedBadge) {
      const response: VerificationResponse = {
        name: issuedBadge.badge.name,
        issuerName: issuedBadge.issuer.user.organizationName,
        imageUrl: issuedBadge.badge.imageUrl,
        dateOfAchievement: issuedBadge.badge.createdAt.toISOString(),
        type: "badge",
      };

      return NextResponse.json(response);
    }

    // Search for matching certificate
    const issuedCertificate = await prisma.issuedCertificate.findFirst({
      where: {
        receiverEmail: userEmail.toLowerCase(),
        template: {
          templateName: name,
        },
        issuedAt: {
          gte: new Date(parsedIssueDate.setHours(0, 0, 0, 0)),
          lt: new Date(parsedIssueDate.setHours(23, 59, 59, 999)),
        },
      },
      include: {
        template: true,
        issuer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (issuedCertificate) {
      const response: VerificationResponse = {
        name: issuedCertificate.template.templateName,
        issuerName: issuedCertificate.issuer.user.organizationName,
        imageUrl: issuedCertificate.generatedImageUrl,
        dateOfAchievement: issuedCertificate.issuedAt.toISOString(),
        type: "certificate",
      };

      return NextResponse.json(response);
    }

    // No matching credential found
    return NextResponse.json(
      { error: "No matching credential found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Verification failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: VerificationRequest = await req.json();
    const { name, issueDate, userEmail } = body;

    // Validate required parameters
    if (!name || !issueDate || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields: name, issueDate, userEmail" },
        { status: 400 }
      );
    }

    if (!isValidEmail(userEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Parse the issue date for comparison
    const parsedIssueDate = new Date(issueDate);
    if (isNaN(parsedIssueDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid issue date format" },
        { status: 400 }
      );
    }

    // Search for matching badge
    const issuedBadge = await prisma.issuedBadge.findFirst({
      where: {
        receiverEmail: userEmail.toLowerCase(),
        badge: {
          name: name,
          createdAt: {
            gte: new Date(parsedIssueDate.setHours(0, 0, 0, 0)),
            lt: new Date(parsedIssueDate.setHours(23, 59, 59, 999)),
          },
        },
      },
      include: {
        badge: true,
        issuer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (issuedBadge) {
      const response: VerificationResponse = {
        name: issuedBadge.badge.name,
        issuerName: issuedBadge.issuer.user.organizationName,
        imageUrl: issuedBadge.badge.imageUrl,
        dateOfAchievement: issuedBadge.badge.createdAt.toISOString(),
        type: "badge",
      };

      return NextResponse.json(response);
    }

    // Search for matching certificate
    const issuedCertificate = await prisma.issuedCertificate.findFirst({
      where: {
        receiverEmail: userEmail.toLowerCase(),
        template: {
          templateName: name,
        },
        issuedAt: {
          gte: new Date(parsedIssueDate.setHours(0, 0, 0, 0)),
          lt: new Date(parsedIssueDate.setHours(23, 59, 59, 999)),
        },
      },
      include: {
        template: true,
        issuer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (issuedCertificate) {
      const response: VerificationResponse = {
        name: issuedCertificate.template.templateName,
        issuerName: issuedCertificate.issuer.user.organizationName,
        imageUrl: issuedCertificate.generatedImageUrl,
        dateOfAchievement: issuedCertificate.issuedAt.toISOString(),
        type: "certificate",
      };

      return NextResponse.json(response);
    }

    // No matching credential found
    return NextResponse.json(
      { error: "No matching credential found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Verification failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

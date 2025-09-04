import prisma from "@/lib/prisma";
import { APPLICATION_HOST, ALGORAND_NETWORK } from "@/lib/const";
import type { Metadata } from "next";

function toAbsolute(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${APPLICATION_HOST}${url.startsWith("/") ? url : `/${url}`}`;
}

function getTransactionExplorerUrl(txHash: string): string {
  const network = ALGORAND_NETWORK.toLowerCase();
  return `https://lora.algokit.io/${network}/transaction/${txHash}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issuedBadgeId: string }>;
}): Promise<Metadata> {
  const { issuedBadgeId } = await params;
  const data = await prisma.issuedBadge.findUnique({
    where: { id: issuedBadgeId },
    include: { badge: true, issuer: { include: { user: true } } },
  });

  if (!data) {
    return {
      title: "Badge not found",
      description: "The requested badge could not be located.",
    };
  }

  const title = data.badge.name;
  const description =
    data.badge.description || `Issued by ${data.issuer.user.organizationName}`;
  const imageUrl = toAbsolute(data.badge.imageUrl);
  const pageUrl = `${APPLICATION_HOST}/share/badge/${data.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "ProofMint",
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
            },
          ]
        : undefined,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function PublicBadgePage({
  params,
}: {
  params: Promise<{ issuedBadgeId: string }>;
}) {
  const { issuedBadgeId } = await params;
  const data = await prisma.issuedBadge.findUnique({
    where: { id: issuedBadgeId },
    include: { badge: true, issuer: { include: { user: true } } },
  });

  console.log(data);

  // Try to find receiver user information if they exist in the system
  const receiver = data ? await prisma.user.findUnique({
    where: { email: data.receiverEmail },
    select: { fullName: true, organizationName: true },
  }) : null;

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Badge not found</h1>
          <p className="text-gray-500 mt-2">
            The badge you are looking for does not exist.
          </p>
        </div>
      </div>
    );
  }

  const title = data.badge.name;
  const description = data.badge.description || "";
  const imageUrl = toAbsolute(data.badge.imageUrl) || "/placeholder.svg";
  const pageUrl = `${APPLICATION_HOST}/share/badge/${data.id}`;

  const shareText = `I just earned the ${title} badge on ProofMint!`;
  const xUrl = `/api/share/twitter?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(pageUrl)}`;
  const liUrl = `/api/share/linkedin?url=${encodeURIComponent(
    pageUrl
  )}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-xl bg-white/70 backdrop-blur border shadow-sm overflow-hidden flex items-center justify-center">
              <img
                src={imageUrl}
                alt={title}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                {title}
              </h1>
              <p className="text-gray-700 mt-2">
                Issued by {data.issuer.user.organizationName}
              </p>
              {/* 
              <div className="mt-4 flex flex-wrap gap-3 justify-center md:justify-start">
                <a href={xUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.487 11.24H16.17l-5.26-6.874-6.014 6.874H1.588l7.73-8.83L1.125 2.25h6.06l4.754 6.231 6.305-6.231Zm-1.158 18.5h1.833L7.01 4.125H5.05l12.036 16.625Z"/></svg>
                  Share on X
                </a>
                <a href={liUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.036-1.852-3.036-1.853 0-2.136 1.445-2.136 2.939v5.666H9.352V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.368-1.852 3.601 0 4.266 2.37 4.266 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM3.56 20.452h3.554V9H3.56v11.452z"/></svg>
                  Share on LinkedIn
                </a>
              </div>
              */}
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            {description && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">About this badge</h2>
                <p className="text-gray-700 leading-relaxed">{description}</p>
              </div>
            )}
            {data.transactionHash && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Blockchain Transaction</h3>
                <a
                  href={getTransactionExplorerUrl(data.transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  View on Explorer
                </a>
              </div>
            )}
            {data.badge.customProperties &&
              Array.isArray(data.badge.customProperties) &&
              data.badge.customProperties.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Badge Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(data.badge.customProperties as Array<{key: string, value: string}>).map((property, index) => (
                      <div
                        key={index}
                        className="rounded-lg border bg-gray-50 px-4 py-3 text-sm"
                      >
                        <div className="flex flex-col space-y-1">
                          <span className="text-gray-600 font-medium text-xs uppercase tracking-wide">
                            {property.key}
                          </span>
                          <span className="font-medium text-gray-900 break-words leading-relaxed">
                            {property.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Issued</span>
                <div className="font-medium">
                  {new Date(data.issuedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Claimed</span>
                <div className="font-medium">
                  {data.claimedAt
                    ? new Date(data.claimedAt).toLocaleDateString()
                    : "Not claimed"}
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Issuer</span>
                <div className="font-medium">
                  {data.issuer.user.organizationName}
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Receiver</span>
                <div className="font-medium">
                  {receiver?.fullName || data.receiverEmail}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

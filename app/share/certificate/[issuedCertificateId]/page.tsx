import prisma from "@/lib/prisma";
import { APPLICATION_HOST, ALGORAND_NETWORK } from "@/lib/const";
import type { Metadata } from "next";
import { absoluteCertificateImageUrl } from "@/lib/imageUrl";
import { FallbackIpfsImage } from "@/components/FallbackIpfsImage";

function getAssetExplorerUrl(assetId: string): string {
  const network = ALGORAND_NETWORK.toLowerCase();
  return `https://lora.algokit.io/${network}/asset/${assetId}`;
}

function getTxExplorerUrl(txHash: string): string {
  const network = ALGORAND_NETWORK.toLowerCase();
  return `https://lora.algokit.io/${network}/transaction/${txHash}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issuedCertificateId: string }>;
}): Promise<Metadata> {
  const { issuedCertificateId } = await params;
  const data = await prisma.issuedCertificate.findUnique({
    where: { id: issuedCertificateId },
    include: { issuer: { include: { user: true } }, template: true },
  });

  if (!data) {
    return {
      title: "Certificate not found",
      description: "The requested certificate could not be located.",
    };
  }

  const title = data.certificateName;
  const description = data.description || `Issued by ${data.issuer.user.organizationName}`;
  const imageUrl = data.imageCid ? absoluteCertificateImageUrl(data.imageCid) : null;
  const pageUrl = `${APPLICATION_HOST}/share/certificate/${data.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "ProofMint",
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630 }] : undefined,
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

export default async function PublicCertificatePage({
  params,
}: {
  params: Promise<{ issuedCertificateId: string }>;
}) {
  const { issuedCertificateId } = await params;
  const data = await prisma.issuedCertificate.findUnique({
    where: { id: issuedCertificateId },
    include: { issuer: { include: { user: true } }, template: true },
  });

  if (!data || data.mintingStatus !== "MINTED") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Certificate not found</h1>
          <p className="text-gray-500 mt-2">
            The certificate you are looking for does not exist or is not yet available.
          </p>
        </div>
      </div>
    );
  }

  const receiver = await prisma.user.findUnique({
    where: { email: data.receiverEmail },
    select: { fullName: true },
  });

  const title = data.certificateName;
  const issuerName = data.issuer.user.organizationName;
  const properties = data.properties as Record<string, string>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 p-8 flex flex-col md:flex-row items-center gap-6">
            {data.imageCid && (
              <div className="w-48 md:w-64 rounded-xl bg-white/70 backdrop-blur border shadow-sm overflow-hidden">
                <FallbackIpfsImage
                  cid={data.imageCid}
                  type="certificate"
                  alt={title}
                  width={256}
                  height={192}
                  className="w-full h-auto object-cover rounded-xl"
                />
              </div>
            )}
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-700 mt-2">Issued by {issuerName}</p>
              {data.status === "CLAIMED" && (
                <span className="inline-block mt-3 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  Claimed
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 space-y-6">
            {data.description && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">About this Certificate</h2>
                <p className="text-gray-700 leading-relaxed">{data.description}</p>
              </div>
            )}

            {/* Properties */}
            {Object.keys(properties).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Certificate Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(properties).map(([key, value]) => (
                    <div key={key} className="rounded-lg border bg-gray-50 px-4 py-3 text-sm">
                      <div className="flex flex-col space-y-1">
                        <span className="text-gray-600 font-medium text-xs uppercase tracking-wide">
                          {key}
                        </span>
                        <span className="font-medium text-gray-900 break-words leading-relaxed">
                          {value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blockchain info */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Blockchain Verification</h3>
              <div className="flex flex-wrap gap-3">
                {data.assetId && (
                  <a
                    href={getAssetExplorerUrl(data.assetId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Asset (ID: {data.assetId})
                  </a>
                )}
                {data.mintTransactionHash && (
                  <a
                    href={getTxExplorerUrl(data.mintTransactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Mint Transaction
                  </a>
                )}
                {data.claimTransactionHash && (
                  <a
                    href={getTxExplorerUrl(data.claimTransactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Claim Transaction
                  </a>
                )}
              </div>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Issued</span>
                <div className="font-medium">{new Date(data.issuedAt).toLocaleDateString()}</div>
              </div>
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Claimed</span>
                <div className="font-medium">
                  {data.claimedAt ? new Date(data.claimedAt).toLocaleDateString() : "Not yet claimed"}
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Issuer</span>
                <div className="font-medium">{issuerName}</div>
              </div>
              <div className="rounded-lg border p-3 bg-white">
                <span className="text-gray-500">Recipient</span>
                <div className="font-medium">{receiver?.fullName || data.receiverEmail}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

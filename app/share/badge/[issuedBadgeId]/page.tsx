import prisma from "@/lib/prisma";
import { APPLICATION_HOST } from "@/lib/const";
import type { Metadata } from "next";

function toAbsolute(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${APPLICATION_HOST}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function generateMetadata({ params }: { params: { issuedBadgeId: string } }): Promise<Metadata> {
  const data = await prisma.issuedBadge.findUnique({
    where: { id: params.issuedBadgeId },
    include: { badge: true, issuer: { include: { user: true } } },
  });

  if (!data) {
    return {
      title: "Badge not found",
      description: "The requested badge could not be located.",
    };
  }

  const title = data.badge.name;
  const description = data.badge.description || `Issued by ${data.issuer.user.organizationName}`;
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

export default async function PublicBadgePage({ params }: { params: { issuedBadgeId: string } }) {
  const data = await prisma.issuedBadge.findUnique({
    where: { id: params.issuedBadgeId },
    include: { badge: true, issuer: { include: { user: true } } },
  });

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Badge not found</h1>
          <p className="text-gray-500 mt-2">The badge you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <img
          src={toAbsolute(data.badge.imageUrl)}
          alt={data.badge.name}
          className="w-28 h-28 object-contain rounded-lg border"
        />
        <div>
          <h1 className="text-3xl font-bold">{data.badge.name}</h1>
          <p className="text-gray-600">Issued by {data.issuer.user.organizationName}</p>
        </div>
      </div>

      {data.badge.description && (
        <p className="text-gray-800">{data.badge.description}</p>
      )}

      {data.badge.customProperties && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Badge Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries((data.badge.customProperties as any) || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm bg-gray-50 p-2 rounded border">
                <span className="text-gray-600">{k}</span>
                <span className="font-medium text-gray-900">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <p>Issued on {new Date(data.issuedAt).toLocaleDateString()}</p>
        {data.claimedAt && <p>Claimed on {new Date(data.claimedAt).toLocaleDateString()}</p>}
      </div>
    </div>
  );
}



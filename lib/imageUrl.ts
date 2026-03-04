import "server-only";
import { APPLICATION_HOST } from "./const";

export function badgeImageUrl(cid: string): string {
  return `/api/uploads/badges/${cid}`;
}

export function certificateImageUrl(cid: string): string {
  return `/api/uploads/certificates/${cid}`;
}

export function absoluteBadgeImageUrl(cid: string): string {
  return `${APPLICATION_HOST}${badgeImageUrl(cid)}`;
}

export function absoluteCertificateImageUrl(cid: string): string {
  return `${APPLICATION_HOST}${certificateImageUrl(cid)}`;
}

export function ipfsGatewayUrl(cid: string): string {
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs";
  return `${gateway.replace(/\/+$/, "")}/${cid}`;
}

"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";

type FallbackIpfsImageProps = Omit<ImageProps, "src"> & {
  cid: string;
  type: "badge" | "certificate";
};

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs";

export function FallbackIpfsImage({
  cid,
  type,
  ...props
}: FallbackIpfsImageProps) {
  const localUrl = `/api/uploads/${type}s/${cid}`;
  const gatewayUrl = `${IPFS_GATEWAY}/${cid}`;
  const [src, setSrc] = useState(localUrl);
  const [triedFallback, setTriedFallback] = useState(false);

  return (
    <Image
      {...props}
      src={src}
      onError={() => {
        if (!triedFallback) {
          setSrc(gatewayUrl);
          setTriedFallback(true);
        }
      }}
    />
  );
}

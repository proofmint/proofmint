import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getHash(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function cleanString(string: string) {
  return string.toLowerCase().trim();
}

export const calculateSHA256 = async (
  data: Buffer | Uint8Array | ArrayBuffer
): Promise<string> => {
  try {
    const hash = crypto.createHash("sha256");
    hash.update(Buffer.from(data as any));
    return hash.digest("hex");
  } catch (error) {
    throw new Error("Error calculating SHA256");
  }
};

export const getEmailsHash = async (emails: string[]) => {
  return getHash(emails.join(","));
};

export function concatArrays(...arrs: ArrayLike<number>[]) {
  const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
  const c = new Uint8Array(size);

  let offset = 0;
  for (let i = 0; i < arrs.length; i++) {
    c.set(arrs[i], offset);
    offset += arrs[i].length;
  }

  return c;
}

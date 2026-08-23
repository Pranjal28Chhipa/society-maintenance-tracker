import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";

import { blobEnabled, env } from "./env";
import { badRequest } from "./http";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export type StoredPhoto = { url: string; storage: "blob" | "local" };

/**
 * Persists one complaint photo and returns a URL to render it from.
 *
 * Vercel Blob when a token is present, otherwise `public/uploads` on local
 * disk. The fallback keeps `npm run dev` working with no cloud account; it is
 * not viable in production because serverless filesystems are read-only and
 * ephemeral, which is why `BLOB_READ_WRITE_TOKEN` is documented as required
 * for the hosted deployment.
 */
export async function storePhoto(file: File): Promise<StoredPhoto> {
  validatePhoto(file);

  const extension = EXTENSIONS[file.type] ?? "bin";
  const key = `complaints/${randomUUID()}.${extension}`;

  if (blobEnabled()) {
    const blob = await put(key, file, {
      access: "public",
      token: env.blobToken,
      contentType: file.type,
      // The random UUID already makes the key unique; this keeps the stored
      // filename identical to the one referenced in the database row.
      addRandomSuffix: false,
    });
    return { url: blob.url, storage: "blob" };
  }

  const relativePath = path.join("uploads", ...key.split("/"));
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return { url: `/${relativePath.split(path.sep).join("/")}`, storage: "local" };
}

/** Rejects oversized files and anything that is not an allowed image type. */
export function validatePhoto(file: File): void {
  if (!file.size) {
    throw badRequest("Validation failed", { photo: "The uploaded file is empty" });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw badRequest("Validation failed", {
      photo: `Photo must be ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB or smaller`,
    });
  }
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw badRequest("Validation failed", {
      photo: "Photo must be a JPEG, PNG, WebP or HEIC image",
    });
  }
}

import { json } from "@/lib/http";

export async function GET() {
  const keys = Object.keys(process.env).filter(
    (k) =>
      k.includes("BLOB") ||
      k.includes("TOKEN") ||
      k.includes("SECRET") ||
      k.includes("DATABASE") ||
      k.includes("veenila") ||
      k.includes("VEENILA")
  );
  return json({
    envKeys: keys,
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasVercelBlobToken: Boolean(process.env.VERCEL_BLOB_READ_WRITE_TOKEN),
  });
}

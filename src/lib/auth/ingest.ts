import { NextRequest } from "next/server";

export function verifyIngestAuth(request: NextRequest): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const bodySecret = request.headers.get("x-ingest-secret");
  return bodySecret === secret;
}

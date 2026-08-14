import { jsonResponse } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return jsonResponse({
    status: "ok",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
    timestamp: new Date().toISOString(),
  });
}

import type { NextRequest } from "next/server";
import handler from "@/legacy/api/products";
import { runLegacyHandler } from "@/lib/legacy-route-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const response = await runLegacyHandler(request, handler);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=30, stale-while-revalidate=300",
  );
  return response;
}

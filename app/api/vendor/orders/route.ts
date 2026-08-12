import type { NextRequest } from "next/server";
import handler from "@/legacy/api/vendor/orders";
import { runLegacyHandler } from "@/lib/legacy-route-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runLegacyHandler(request, handler);
}

export function PATCH(request: NextRequest) {
  return runLegacyHandler(request, handler);
}

import type { NextRequest } from "next/server";
import handler from "@/legacy/api/vendor/product-image";
import { runLegacyHandler } from "@/lib/legacy-route-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return runLegacyHandler(request, handler);
}

export function DELETE(request: NextRequest) {
  return runLegacyHandler(request, handler);
}

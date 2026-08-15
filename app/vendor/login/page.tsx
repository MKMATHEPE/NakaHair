"use client";

import { useRouter } from "next/navigation";

import { AuthDialog } from "@/components/shared/auth-dialog";

export default function VendorLoginPage() {
  const router = useRouter();

  return <AuthDialog mode="login" onClose={() => router.replace("/vendor/products")} />;
}

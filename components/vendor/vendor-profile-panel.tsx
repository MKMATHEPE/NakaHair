"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";

type VendorProfile = { business_name: string; contact_name: string; email: string; phone: string; business_type: string; registration_number: string | null; tax_number: string | null; website_url: string | null; social_media_url: string | null; street_address: string; city: string; province: string; postal_code: string; business_description: string; status: string };

export function VendorProfilePanel() {
  const { client, user } = useSession();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  useEffect(() => { if (user) void client.from("vendor_requests").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setProfile(data)); }, [client, user]);
  if (!profile) return <p>Loading vendor profile…</p>;
  return <><p className="naka-eyebrow">Business details</p><h2>Vendor Profile</h2><div className="naka-profile-grid"><article><span>Business</span><strong>{profile.business_name}</strong></article><article><span>Status</span><strong>{profile.status}</strong></article><article><span>Contact</span><strong>{profile.contact_name}</strong><p>{profile.email}<br />{profile.phone}</p></article><article><span>Business type</span><strong>{profile.business_type}</strong><p>{profile.registration_number || "No registration number"}<br />{profile.tax_number || "No VAT number"}</p></article><article className="naka-span-2"><span>Address</span><p>{profile.street_address}, {profile.city}, {profile.province} {profile.postal_code}</p></article><article className="naka-span-2"><span>About</span><p>{profile.business_description}</p></article></div></>;
}

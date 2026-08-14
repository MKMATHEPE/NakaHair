"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";

export function VendorApplicationPanel() {
  const { accessToken, refresh, user } = useSession();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(new URLSearchParams(window.location.search).get("vendor_application") === "1"), []);
  if (user?.isVendor) return <><p className="naka-eyebrow">Vendor access</p><h2>Your vendor profile is approved</h2><a className="naka-button" href="/vendor/products">Open Vendor Portal</a></>;

  async function requestLink() {
    const token = await accessToken();
    const response = await fetch("/api/vendor-requests/start", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" });
    const body = await response.json();
    if (!response.ok) return setError(body.error);
    setMessage(body.message); setReady(Boolean(body.canContinue));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const token = await accessToken();
    const response = await fetch("/api/vendor-requests/complete", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const body = await response.json();
    if (!response.ok) return setError(body.error);
    setMessage(body.message); await refresh();
  }
  return <><p className="naka-eyebrow">Sell with NAKA Hair</p><h2>Vendor Application</h2><p>Request a secure application link, then provide your complete business information.</p>{!ready ? <button className="naka-button" onClick={() => void requestLink()} type="button">Email Me the Application Link</button> : <form className="naka-form naka-form-grid" onSubmit={submit}><label>Business name<input maxLength={160} name="businessName" required /></label><label>Contact person<input maxLength={120} name="contactName" required /></label><label>Business phone<input maxLength={50} name="phone" required /></label><label>Business type<select name="businessType" required><option value="">Select type</option><option value="salon">Salon</option><option value="stylist">Hair stylist</option><option value="retailer">Retailer</option><option value="wholesaler">Wholesaler</option><option value="online-store">Online store</option><option value="other">Other</option></select></label><label>Registration number<input maxLength={100} name="registrationNumber" /></label><label>Tax / VAT number<input maxLength={100} name="taxNumber" /></label><label>Website<input maxLength={500} name="websiteUrl" type="url" /></label><label>Social profile<input maxLength={500} name="socialMediaUrl" type="url" /></label><label className="naka-span-2">Street address<input maxLength={200} name="streetAddress" required /></label><label>City<input maxLength={100} name="city" required /></label><label>Province<input maxLength={100} name="province" required /></label><label>Postal code<input maxLength={20} name="postalCode" required /></label><label className="naka-span-2">About your business<textarea maxLength={2000} name="businessDescription" required rows={5} /></label><button className="naka-button" type="submit">Create Vendor Profile</button></form>}{message ? <p className="naka-success">{message}</p> : null}{error ? <p className="naka-error">{error}</p> : null}</>;
}

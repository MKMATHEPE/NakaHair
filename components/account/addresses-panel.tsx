"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";

type Address = { id: number; label: string; address: string; street: string; city: string; province: string; postal_code: string };

export function AddressesPanel() {
  const { accessToken } = useSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = await accessToken();
    const response = await fetch("/api/addresses", { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load addresses.");
    setAddresses(body);
  }, [accessToken]);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const token = await accessToken();
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Unable to save address.");
    form.reset();
    await load();
  }

  async function remove(id: number) {
    const token = await accessToken();
    const response = await fetch(`/api/addresses?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return setError("Unable to remove address.");
    setAddresses((current) => current.filter((address) => address.id !== id));
  }

  return <><p className="naka-eyebrow">Delivery details</p><h2>Saved Addresses</h2><div className="naka-address-grid">{addresses.map((entry) => <article key={entry.id}><strong>{entry.label}</strong><p>{entry.address}<br />{entry.street}<br />{entry.city}, {entry.province} {entry.postal_code}</p><button className="naka-text-action" onClick={() => void remove(entry.id)} type="button">Remove</button></article>)}</div><h3>Add an address</h3><form className="naka-form naka-form-grid" onSubmit={save}><label>Label<input defaultValue="Home" maxLength={80} name="label" required /></label><label>Address<input maxLength={200} name="address" required /></label><label>Street<input maxLength={200} name="street" required /></label><label>City<input maxLength={100} name="city" required /></label><label>Province<input maxLength={100} name="province" required /></label><label>Postal code<input maxLength={20} name="postalCode" required /></label>{error ? <p className="naka-error naka-span-2">{error}</p> : null}<button className="naka-button" type="submit">Save Address</button></form></>;
}

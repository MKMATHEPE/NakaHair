"use client";

import { useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";

export function SettingsPanel() {
  const { accessToken, refresh, user } = useSession();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!user) return null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const token = await accessToken();
    const response = await fetch("/api/account", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Unable to update your account.");
    await refresh();
    setMessage("Your account has been updated.");
  }

  return <><p className="naka-eyebrow">Personal details</p><h2>Account Settings</h2><form className="naka-form naka-form-grid" onSubmit={save}><label>First name<input defaultValue={user.firstName} maxLength={120} name="firstName" required /></label><label>Last name<input defaultValue={user.lastName} maxLength={120} name="lastName" required /></label><label>Phone<input defaultValue={user.phone} maxLength={50} name="phone" required /></label><label>Email<input disabled value={user.email} /></label><label className="naka-span-2">New password <small>Leave blank to keep your current password.</small><input autoComplete="new-password" minLength={8} name="password" type="password" /></label>{error ? <p className="naka-error naka-span-2">{error}</p> : null}{message ? <p className="naka-success naka-span-2">{message}</p> : null}<button className="naka-button" type="submit">Save Changes</button></form></>;
}

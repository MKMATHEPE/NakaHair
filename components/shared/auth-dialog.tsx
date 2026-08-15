"use client";

import { useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";
import type { Portal } from "@/lib/client/types";

export function AuthDialog({ mode, onClose }: { mode: "login" | "register"; onClose(): void }) {
  const { client, login, portal, register } = useSession();
  const [activeMode, setActiveMode] = useState(mode);
  const [selectedPortal, setSelectedPortal] = useState<Portal>(portal);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (activeMode === "login") {
        await login({
          email: String(data.get("email") || "").trim().toLowerCase(),
          password: String(data.get("password") || ""),
        }, selectedPortal);
        onClose();
      } else {
        const password = String(data.get("password") || "");
        if (password !== String(data.get("confirmPassword") || "")) {
          throw new Error("Passwords do not match.");
        }
        setMessage(await register({
          email: String(data.get("email") || "").trim().toLowerCase(),
          password,
          firstName: String(data.get("firstName") || "").trim(),
          lastName: String(data.get("lastName") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
        }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: resetError } = await client.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/account/settings`,
      });
      if (resetError) throw resetError;
      setMessage("Check your email for a password reset link.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send the password reset email.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setActiveMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <div className="naka-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="naka-modal naka-auth-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close" className="naka-modal-close" onClick={onClose} type="button">×</button>
        <p className="naka-eyebrow">My account</p>
        <h2 id="auth-title">{activeMode === "login" ? "Sign in." : "Create Account"}</h2>
        {activeMode === "login" ? <p className="naka-auth-copy">Access your NAKA Hair account.</p> : null}
        {message ? <p className="naka-success">{message}</p> : (
          <form className="naka-form" onSubmit={submit}>
            {activeMode === "login" ? (
              <label className="naka-portal-select">
                <span>Signing in as</span>
                <select aria-label="Choose login portal" onChange={(event) => setSelectedPortal(event.target.value as Portal)} value={selectedPortal}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                </select>
              </label>
            ) : null}
            {activeMode === "register" ? (
              <div className="naka-form-grid">
                <label>First name<input name="firstName" maxLength={120} required /></label>
                <label>Last name<input name="lastName" maxLength={120} required /></label>
                <label className="naka-span-2">Phone number<input name="phone" maxLength={50} required type="tel" /></label>
              </div>
            ) : null}
            <label>Email address<input autoComplete="email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
            <div>
              <label className="naka-auth-field-label" htmlFor="auth-password">Password</label>
              <div className="naka-password-field"><input autoComplete={activeMode === "login" ? "current-password" : "new-password"} id="auth-password" minLength={8} name="password" required type={showPassword ? "text" : "password"} /><button onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? "Hide" : "Show"}</button></div>
            </div>
            {activeMode === "register" ? <label>Confirm password<input minLength={8} name="confirmPassword" required type="password" /></label> : null}
            {error ? <p className="naka-error">{error}</p> : null}
            <button className="naka-button" disabled={busy} type="submit">{busy ? "Please wait…" : activeMode === "login" ? "Sign In" : "Create Account"}</button>
            <div className="naka-auth-links">
              {activeMode === "login" ? <><button onClick={() => setSelectedPortal((current) => current === "customer" ? "vendor" : "customer")} type="button">{selectedPortal === "customer" ? "Manage a store instead" : "Shop as a customer instead"}</button><span aria-hidden="true">·</span><button onClick={() => changeMode("register")} type="button">Create account</button><span aria-hidden="true">·</span><button disabled={busy} onClick={() => void resetPassword()} type="button">Forgot password?</button></> : <button onClick={() => changeMode("login")} type="button">Already have an account? Sign in</button>}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

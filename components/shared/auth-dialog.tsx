"use client";

import { useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";

export function AuthDialog({ mode, onClose }: { mode: "login" | "register"; onClose(): void }) {
  const { login, portal, register } = useSession();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        await login({
          email: String(data.get("email") || "").trim().toLowerCase(),
          password: String(data.get("password") || ""),
        });
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
        <p className="naka-eyebrow">{portal === "vendor" ? "Vendor portal" : "My account"}</p>
        <h2 id="auth-title">{mode === "login" ? `${portal === "vendor" ? "Vendor" : "Customer"} Login` : "Create Account"}</h2>
        {message ? <p className="naka-success">{message}</p> : (
          <form className="naka-form" onSubmit={submit}>
            {mode === "register" ? (
              <div className="naka-form-grid">
                <label>First name<input name="firstName" maxLength={120} required /></label>
                <label>Last name<input name="lastName" maxLength={120} required /></label>
                <label className="naka-span-2">Phone number<input name="phone" maxLength={50} required type="tel" /></label>
              </div>
            ) : null}
            <label>Email address<input autoComplete="email" name="email" required type="email" /></label>
            <label>Password<input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} name="password" required type="password" /></label>
            {mode === "register" ? <label>Confirm password<input minLength={8} name="confirmPassword" required type="password" /></label> : null}
            {error ? <p className="naka-error">{error}</p> : null}
            <button className="naka-button" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}</button>
          </form>
        )}
      </section>
    </div>
  );
}

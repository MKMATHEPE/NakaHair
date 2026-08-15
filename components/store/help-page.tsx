"use client";

import { useState, type FormEvent } from "react";

export function HelpPage() {
  const [notice, setNotice] = useState("");

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    const body = await response.json();
    setNotice(body.message || body.error);
    if (response.ok) form.reset();
  }

  return (
    <main>
      <section className="naka-contact" id="contact"><div><p className="naka-eyebrow">Need help?</p><h2>Contact Us</h2><p>Send us a message and our support team will get back to you.</p></div><form className="naka-form" onSubmit={submitContact}><label>Name<input maxLength={160} name="name" required /></label><label>Email<input maxLength={320} name="email" required type="email" /></label><label>Message<textarea maxLength={3000} name="message" required rows={5} /></label><button className="naka-button" type="submit">Send Message</button>{notice ? <p aria-live="polite" className="naka-notice">{notice}</p> : null}</form></section>
    </main>
  );
}

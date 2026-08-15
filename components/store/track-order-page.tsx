"use client";

import { useState, type FormEvent } from "react";

export function TrackOrderPage() {
  const [trackingResult, setTrackingResult] = useState("");

  async function trackOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setTrackingResult("Looking for your order…");
    const response = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    const body = await response.json();
    setTrackingResult(response.ok ? `${body.orderNumber} is currently ${body.status}.` : body.error || "Unable to track this order.");
  }

  return (
    <main className="naka-track-page">
      <section className="naka-track-content">
        <p className="naka-eyebrow">Track order</p>
        <h1>Follow every step.</h1>
        <p>Use the order number and email address from your confirmation email.</p>
        <form className="naka-form naka-track-form" onSubmit={trackOrder}>
          <label>Order number<input maxLength={80} name="orderNumber" placeholder="e.g. NAKA-1048" required /></label>
          <label>Email used at checkout<input maxLength={320} name="email" placeholder="you@example.com" required type="email" /></label>
          <button className="naka-button" type="submit">Show My Order</button>
        </form>
        {trackingResult ? <p aria-live="polite" className="naka-track-result"><span aria-hidden="true" />{trackingResult}</p> : null}
      </section>
    </main>
  );
}

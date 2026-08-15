"use client";

import { useState, type FormEvent } from "react";

export function DeliveryPage() {
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
    <main>
      <section className="naka-service-grid" id="shipping">
        <article><p className="naka-eyebrow">Delivery</p><h2>Shipping information</h2><p>Choose standard or express delivery during checkout. We will email your order number once your order is confirmed.</p></article>
        <article id="track"><p className="naka-eyebrow">Already ordered?</p><h2>Track your order</h2><form className="naka-form" onSubmit={trackOrder}><label>Order number<input maxLength={80} name="orderNumber" required /></label><label>Email used at checkout<input maxLength={320} name="email" required type="email" /></label><button className="naka-button" type="submit">Track Order</button></form>{trackingResult ? <p aria-live="polite" className="naka-notice">{trackingResult}</p> : null}</article>
      </section>
    </main>
  );
}

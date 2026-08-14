"use client";

import { useState, type FormEvent } from "react";

import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/components/providers/session-provider";
import { formatMoney } from "@/lib/client/types";

import { ProductImage } from "./product-image";

export function CartDrawer({ onClose }: { onClose(): void }) {
  const { accessToken, user } = useSession();
  const { clear, items, remove, subtotal, update } = useCart();
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [attemptKey, setAttemptKey] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("Standard Delivery");

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const deliveryMethod = String(data.get("deliveryMethod") || "Standard Delivery");
    const currentAttemptKey = attemptKey || crypto.randomUUID();
    if (!attemptKey) setAttemptKey(currentAttemptKey);
    try {
      const token = await accessToken();
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          idempotencyKey: currentAttemptKey,
          items,
          email: String(data.get("email") || ""),
          phone: String(data.get("phone") || ""),
          deliveryAddress: ["address", "street", "city", "province", "postalCode"]
            .map((field) => String(data.get(field) || "").trim()).filter(Boolean).join(", "),
          deliveryMethod,
          paymentMethod: String(data.get("paymentMethod") || "EFT"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to place your order.");
      clear();
      setConfirmation(body.orderNumber);
      setAttemptKey("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to place your order.");
    } finally {
      setBusy(false);
    }
  }

  const deliveryFee = checkout ? deliveryMethod === "Express Delivery" ? 250 : 150 : 0;
  return (
    <div className="naka-drawer-backdrop" onMouseDown={onClose} role="presentation">
      <aside aria-label="Shopping bag" className="naka-cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="naka-drawer-heading"><div><p className="naka-eyebrow">Your order</p><h2>{checkout ? "Checkout" : "Shopping Bag"}</h2></div><button aria-label="Close bag" className="naka-modal-close" onClick={onClose} type="button">×</button></div>
        {confirmation ? <div className="naka-confirmation"><h3>Order successfully placed</h3><p>Your order number is <strong>{confirmation}</strong>.</p><button className="naka-button" onClick={onClose} type="button">Continue Shopping</button></div> : null}
        {!confirmation && !items.length ? <div className="naka-empty"><h3>Your bag is empty</h3><p>Choose a premium style to begin your order.</p></div> : null}
        {!confirmation && items.length && !checkout ? (
          <>
            <div className="naka-cart-items">{items.map((item) => (
              <article className="naka-cart-item" key={item.key}>
                <div className="naka-cart-image"><ProductImage alt={item.name} src={item.image} /></div>
                <div><h3>{item.name}</h3><p>{item.selectedOrigin} · {item.selectedSize}</p><strong>{formatMoney(item.price * item.quantity)}</strong><div className="naka-quantity"><button onClick={() => update(item.key, item.quantity - 1)} type="button">−</button><span>{item.quantity}</span><button onClick={() => update(item.key, item.quantity + 1)} type="button">+</button><button onClick={() => remove(item.key)} type="button">Remove</button></div></div>
              </article>
            ))}</div>
            <div className="naka-cart-total"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
            <button className="naka-button naka-button-block" onClick={() => setCheckout(true)} type="button">Checkout</button>
          </>
        ) : null}
        {!confirmation && items.length && checkout ? (
          <form className="naka-form naka-checkout-form" onChange={() => setAttemptKey(crypto.randomUUID())} onSubmit={placeOrder}>
            <div className="naka-form-grid">
              <label>Email<input defaultValue={user?.email} name="email" required type="email" /></label>
              <label>Phone<input defaultValue={user?.phone} name="phone" required type="tel" /></label>
              <label className="naka-span-2">Address<input name="address" required /></label>
              <label>Street<input name="street" required /></label><label>City<input name="city" required /></label>
              <label>Province<input name="province" required /></label><label>Postal code<input name="postalCode" required /></label>
              <label>Delivery<select name="deliveryMethod" onChange={(event) => setDeliveryMethod(event.target.value)} value={deliveryMethod}><option>Standard Delivery</option><option>Express Delivery</option></select></label>
              <label>Payment<select name="paymentMethod"><option>EFT</option><option>PayFast</option><option>Yoco</option></select></label>
            </div>
            {error ? <p className="naka-error">{error}</p> : null}
            <div className="naka-cart-total"><span>Total</span><strong>{formatMoney(subtotal + deliveryFee)}</strong></div>
            <div className="naka-inline-actions"><button className="naka-button-secondary" onClick={() => setCheckout(false)} type="button">Back</button><button className="naka-button" disabled={busy} type="submit">{busy ? "Placing order…" : "Place Order"}</button></div>
          </form>
        ) : null}
      </aside>
    </div>
  );
}

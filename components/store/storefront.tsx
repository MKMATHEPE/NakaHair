"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { collections } from "@/lib/client/collections";
import type { Product } from "@/lib/client/types";

import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";

export function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [trackingResult, setTrackingResult] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load products.");
        return response.json() as Promise<Product[]>;
      })
      .then(setProducts)
      .catch((error) => {
        if (error.name !== "AbortError") setNotice(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query ? products.filter((product) => [product.name, product.type, product.hairType, product.collection].some((value) => value.toLowerCase().includes(query))) : products;
    return matches.slice(0, 4);
  }, [products, search]);

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
      <section className="naka-hero">
        <div><p className="naka-eyebrow">Premium hair · South Africa</p><h1>Confidence starts with great hair.</h1><p>Discover wigs, bundles, closures, and frontals selected for quality, comfort, and effortless beauty.</p><a className="naka-button" href="#shop">Shop the Collection</a></div>
        <div className="naka-hero-art"><span>NAKA</span><p>Premium hair for every version of you.</p></div>
      </section>

      <section className="naka-section" id="shop">
        <div className="naka-section-heading"><div><p className="naka-eyebrow">The catalogue</p><h2>Shop NAKA Hair</h2></div><label className="naka-search"><span className="sr-only">Search products</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" type="search" value={search} /></label></div>
        {loading ? <p className="naka-empty">Loading the collection…</p> : null}
        {notice ? <p className="naka-notice">{notice}</p> : null}
        {!loading && !visible.length ? <p className="naka-empty">No products match your search.</p> : null}
        <div className="naka-product-grid">{visible.map((product) => <ProductCard key={product.id} onSelect={setSelected} product={product} />)}</div>
      </section>

      {collections.map((collection) => {
        const collectionProducts = products.filter((product) => product.collection === collection.key).slice(0, 4);
        return <section className={`naka-collection naka-collection-${collection.key}`} id={collection.key} key={collection.key}><Link aria-label={`View ${collection.eyebrow}`} className="naka-collection-copy" href={`/collections/${collection.key}`}><p className="naka-eyebrow">{collection.eyebrow}</p><h2>{collection.title}</h2><p>{collection.copy}</p></Link><div className="naka-product-grid">{collectionProducts.map((product) => <ProductCard key={product.id} onSelect={setSelected} product={product} />)}</div></section>;
      })}

      <section className="naka-story" id="about"><p className="naka-eyebrow">Our promise</p><h2>Hair that feels like you.</h2><p>We curate dependable styles with clear product information, thoughtful service, and options for every budget.</p></section>
      <section className="naka-service-grid" id="shipping">
        <article><p className="naka-eyebrow">Delivery</p><h2>Shipping information</h2><p>Choose standard or express delivery during checkout. We will email your order number once your order is confirmed.</p></article>
        <article id="track"><p className="naka-eyebrow">Already ordered?</p><h2>Track your order</h2><form className="naka-form" onSubmit={trackOrder}><label>Order number<input maxLength={80} name="orderNumber" required /></label><label>Email used at checkout<input maxLength={320} name="email" required type="email" /></label><button className="naka-button" type="submit">Track Order</button></form>{trackingResult ? <p aria-live="polite" className="naka-notice">{trackingResult}</p> : null}</article>
      </section>
      <section className="naka-contact" id="contact"><div><p className="naka-eyebrow">Need help?</p><h2>Contact Us</h2><p>Send us a message and our support team will get back to you.</p></div><form className="naka-form" onSubmit={submitContact}><label>Name<input maxLength={160} name="name" required /></label><label>Email<input maxLength={320} name="email" required type="email" /></label><label>Message<textarea maxLength={3000} name="message" required rows={5} /></label><button className="naka-button" type="submit">Send Message</button></form></section>
      {selected ? <ProductDialog onClose={() => setSelected(null)} product={selected} /> : null}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import { formatMoney } from "@/lib/client/types";

export type VendorOrder = { id: number; order_number: string; customer_email: string; customer_phone: string; delivery_address: string; items: { name: string; quantity: number }[]; subtotal: number; status: string; created_at: string };
const statuses = ["Order received", "Processing", "Ready for dispatch", "Dispatched", "Completed", "Cancelled"];

export function useVendorOrders() {
  const { accessToken } = useSession();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const token = await accessToken();
    const response = await fetch("/api/vendor/orders", { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load orders.");
    setOrders(body); setLoading(false);
  }, [accessToken]);
  useEffect(() => { void load().catch((reason) => { setError(reason.message); setLoading(false); }); }, [load]);
  return { accessToken, error, load, loading, orders };
}

export function VendorOrdersPanel() {
  const { accessToken, error, load, loading, orders } = useVendorOrders();
  async function updateStatus(id: number, status: string) {
    const token = await accessToken();
    const response = await fetch("/api/vendor/orders", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, status }) });
    if (response.ok) await load();
  }
  return <><p className="naka-eyebrow">Fulfilment</p><h2>My Orders</h2><p>Only orders containing products owned by your vendor profile appear here.</p>{loading ? <p>Loading orders…</p> : null}{error ? <p className="naka-error">{error}</p> : null}<div className="naka-table-wrap"><table className="naka-table"><thead><tr><th>Order</th><th>Customer & delivery</th><th>Your items</th><th>Subtotal</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString("en-ZA")}</small></td><td>{order.customer_email}<small>{order.customer_phone}<br />{order.delivery_address}</small></td><td>{order.items.map((item) => <span className="naka-table-line" key={`${item.name}-${item.quantity}`}>{item.quantity} × {item.name}</span>)}</td><td>{formatMoney(Number(order.subtotal))}</td><td><select aria-label={`Status for ${order.order_number}`} onChange={(event) => void updateStatus(order.id, event.target.value)} value={order.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>{!loading && !orders.length ? <p className="naka-empty">No orders for your products yet.</p> : null}</>;
}

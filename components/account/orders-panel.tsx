"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import { formatMoney } from "@/lib/client/types";

type Order = { id: number; order_number: string; items: { name: string; quantity: number }[]; total: number; status: string; created_at: string };

export function OrdersPanel() {
  const { accessToken } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void accessToken().then((token) => fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }))
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load orders.");
        if (active) setOrders(body);
      }).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken]);

  return <><p className="naka-eyebrow">Order history</p><h2>My Orders</h2>{loading ? <p>Loading orders…</p> : null}{error ? <p className="naka-error">{error}</p> : null}{!loading && !orders.length ? <p className="naka-empty">You have not placed an order yet.</p> : <div className="naka-order-list">{orders.map((order) => <article key={order.id}><div><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleDateString("en-ZA")}</span></div><div>{order.items.map((item) => <p key={`${item.name}-${item.quantity}`}>{item.quantity} × {item.name}</p>)}</div><div><strong>{formatMoney(Number(order.total))}</strong><span>{order.status}</span></div></article>)}</div>}</>;
}

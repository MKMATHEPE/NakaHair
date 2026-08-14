"use client";

import { formatMoney } from "@/lib/client/types";

import { useVendorOrders } from "./vendor-orders-panel";
import { useVendorProducts } from "./use-vendor-data";

export function VendorAnalyticsPanel() {
  const { orders, loading: ordersLoading } = useVendorOrders();
  const { products, loading: productsLoading } = useVendorProducts();
  const revenue = orders.reduce((sum, order) => sum + Number(order.subtotal), 0);
  const active = products.filter((product) => product.status === "active").length;
  const maxOrder = Math.max(1, ...orders.map((order) => Number(order.subtotal)));
  return <><p className="naka-eyebrow">Performance</p><h2>Analytics</h2>{ordersLoading || productsLoading ? <p>Loading analytics…</p> : <><div className="naka-stats"><article><span>Revenue</span><strong>{formatMoney(revenue)}</strong></article><article><span>Vendor orders</span><strong>{orders.length}</strong></article><article><span>Active products</span><strong>{active}</strong></article><article><span>Total stock</span><strong>{products.reduce((sum, product) => sum + product.stock_quantity, 0)}</strong></article></div><section className="naka-chart"><h3>Order value</h3>{orders.length ? orders.slice(0, 10).reverse().map((order) => <div className="naka-bar-row" key={order.id}><span>{order.order_number}</span><div><i style={{ width: `${Math.max(4, Number(order.subtotal) / maxOrder * 100)}%` }} /></div><strong>{formatMoney(Number(order.subtotal))}</strong></div>) : <p className="naka-empty">Order analytics will appear after your first sale.</p>}</section></>}</>;
}

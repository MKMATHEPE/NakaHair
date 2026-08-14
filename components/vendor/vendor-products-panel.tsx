"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";
import type { ProductVariantPrice, VendorProduct } from "@/lib/client/types";
import { formatMoney } from "@/lib/client/types";

import { ProductImage } from "../shared/product-image";
import { useVendorProducts } from "./use-vendor-data";

type EditorState = {
  product: VendorProduct | null;
  origins: string[];
  sizes: string[];
  variants: Record<string, number>;
};

const variantKey = (origin: string, size: string) => JSON.stringify([origin, size]);
const splitOptions = (value: FormDataEntryValue | null) => [...new Set(
  String(value || "").split(",").map((item) => item.trim()).filter(Boolean),
)].slice(0, 20);

function stateFor(product: VendorProduct | null): EditorState {
  return {
    product,
    origins: product?.hair_origins || [],
    sizes: product?.sizes || [],
    variants: Object.fromEntries((product?.variant_prices || []).map((variant) => [
      variantKey(variant.hairOrigin || "", variant.size || ""),
      Number(variant.price),
    ])),
  };
}

async function fileData(file: File) {
  if (file.size > 2 * 1024 * 1024) throw new Error(`${file.name} is larger than 2 MB.`);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function PendingImage({ file }: { file: File }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return source ? <ProductImage alt={file.name} src={source} /> : null;
}

export function VendorProductsPanel() {
  const { accessToken } = useSession();
  const { error, load, loading, products, setError } = useVendorProducts();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorProduct | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const combinations = useMemo(() => {
    if (!editor) return [];
    const origins = editor.origins.length ? editor.origins : [""];
    const sizes = editor.sizes.length ? editor.sizes : [""];
    return origins.flatMap((origin) => sizes.map((size) => ({ origin, size })));
  }, [editor]);

  function openEditor(product: VendorProduct | null) {
    setPendingFiles([]);
    setEditor(stateFor(product));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const basePrice = Number(data.get("price"));
    const origins = splitOptions(data.get("origins"));
    const sizes = splitOptions(data.get("sizes"));
    const optionOrigins = origins.length ? origins : [""];
    const optionSizes = sizes.length ? sizes : [""];
    const variantPrices: ProductVariantPrice[] = origins.length || sizes.length
      ? optionOrigins.flatMap((hairOrigin) => optionSizes.map((size) => ({
        hairOrigin: hairOrigin || null,
        size: size || null,
        price: Number(data.get(`variant:${variantKey(hairOrigin, size)}`)
          ?? editor.variants[variantKey(hairOrigin, size)] ?? basePrice),
      }))) : [];
    const payload = {
      ...(editor.product ? { id: editor.product.id } : {}),
      name: String(data.get("name") || ""),
      productType: String(data.get("productType") || ""),
      hairType: String(data.get("hairType") || ""),
      collection: String(data.get("collection") || "everyday"),
      price: basePrice,
      oldPrice: data.get("oldPrice"),
      stockQuantity: Number(data.get("stockQuantity")),
      status: String(data.get("status") || "draft"),
      tag: String(data.get("tag") || ""),
      shortDescription: String(data.get("shortDescription") || ""),
      description: String(data.get("description") || ""),
      hairOrigins: origins,
      sizes,
      variantPrices,
      details: {
        Texture: String(data.get("texture") || "Not specified"),
        Colour: String(data.get("colour") || "Natural Black (1B)"),
      },
    };

    try {
      const token = await accessToken();
      const response = await fetch("/api/vendor/products", {
        method: editor.product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      let body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save product.");
      for (const file of pendingFiles) {
        const upload = await fetch("/api/vendor/product-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: body.id, image: await fileData(file) }),
        });
        body = await upload.json();
        if (!upload.ok) throw new Error(body.error || "Unable to upload image.");
      }
      await load();
      setEditor(null);
      setPendingFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save product.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct() {
    if (!deleteTarget) return;
    const token = await accessToken();
    const response = await fetch(`/api/vendor/products?id=${deleteTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Unable to delete product.");
    setDeleteTarget(null);
    await load();
  }

  async function removeImage(imageUrl: string) {
    if (!editor?.product) return;
    const token = await accessToken();
    const response = await fetch("/api/vendor/product-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: editor.product.id, imageUrl }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Unable to remove image.");
    setEditor(stateFor(body));
  }

  return (
    <>
      <div className="naka-panel-heading">
        <div><p className="naka-eyebrow">Catalogue management</p><h2>My Products</h2><p>Create and manage only products owned by your vendor profile.</p></div>
        <button className="naka-button-secondary" onClick={() => openEditor(null)} type="button">+ Add Product</button>
      </div>
      {error ? <p className="naka-error">{error}</p> : null}
      {loading ? <p>Loading products…</p> : null}
      <div className="naka-table-wrap">
        <table className="naka-table">
          <thead><tr><th>Product</th><th>Collection</th><th>Price</th><th>Stock</th><th>Status</th><th>Preview</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{products.map((product) => (
            <tr key={product.id}>
              <td><strong>{product.name}</strong><small>{product.product_type}</small></td>
              <td>{product.collection}</td><td>{formatMoney(Number(product.price))}</td><td>{product.stock_quantity}</td><td>{product.status}</td>
              <td><div className="naka-table-image"><ProductImage alt={product.name} src={product.image_urls?.[0] || product.image_url} /></div></td>
              <td><div className="naka-inline-actions"><button className="naka-small-button" onClick={() => openEditor(product)} type="button">Edit</button><button className="naka-small-button" onClick={() => setDeleteTarget(product)} type="button">Delete</button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {editor ? (
        <div className="naka-modal-backdrop" onMouseDown={() => setEditor(null)} role="presentation">
          <section aria-modal="true" className="naka-modal naka-editor-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label="Close editor" className="naka-modal-close" onClick={() => setEditor(null)} type="button">×</button>
            <p className="naka-eyebrow">Vendor · {editor.product ? "Edit Product" : "Add Product"}</p>
            <h2>{editor.product?.name || "New Product"}</h2>
            <form className="naka-form" onSubmit={save}>
              <label>Product images (up to 8)<input accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setPendingFiles(Array.from(event.target.files || []).slice(0, 8 - (editor.product?.image_urls?.length || 0)))} type="file" /></label>
              {editor.product?.image_urls?.length || pendingFiles.length ? (
                <div className="naka-image-manager">
                  {(editor.product?.image_urls || []).map((source, index) => <div key={source}><ProductImage alt={`${editor.product?.name} image ${index + 1}`} src={source} /><button aria-label={`Remove image ${index + 1}`} onClick={() => void removeImage(source)} type="button">×</button>{index === 0 ? <span>Primary</span> : null}</div>)}
                  {pendingFiles.map((file) => <div key={`${file.name}-${file.lastModified}`}><PendingImage file={file} /><button aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles((files) => files.filter((entry) => entry !== file))} type="button">×</button></div>)}
                </div>
              ) : null}
              <div className="naka-form-grid">
                <label>Name<input defaultValue={editor.product?.name} maxLength={160} name="name" required /></label>
                <label>Product type<input defaultValue={editor.product?.product_type} maxLength={100} name="productType" required /></label>
                <label>Hair type<input defaultValue={editor.product?.hair_type} maxLength={100} name="hairType" required /></label>
                <label>Collection<select defaultValue={editor.product?.collection || "everyday"} name="collection"><option value="everyday">Glam On A Budget</option><option value="signature">Signature</option><option value="luxe">Luxe</option></select></label>
                <label>Base price<input defaultValue={editor.product?.price} min={0} name="price" required step="0.01" type="number" /></label>
                <label>Old price<input defaultValue={editor.product?.old_price || ""} min={0} name="oldPrice" step="0.01" type="number" /></label>
                <label>Stock<input defaultValue={editor.product?.stock_quantity || 0} min={0} name="stockQuantity" required type="number" /></label>
                <label>Visibility<select defaultValue={editor.product?.status || "draft"} name="status"><option value="draft">Draft</option><option value="active">Active in Store</option></select></label>
                <label>Hair origins, comma separated<input defaultValue={editor.origins.join(", ")} name="origins" onBlur={(event) => setEditor((current) => current ? { ...current, origins: splitOptions(event.target.value) } : current)} /></label>
                <label>Sizes, comma separated<input defaultValue={editor.sizes.join(", ")} name="sizes" onBlur={(event) => setEditor((current) => current ? { ...current, sizes: splitOptions(event.target.value) } : current)} /></label>
                <label>Texture<input defaultValue={editor.product?.details?.Texture || ""} name="texture" /></label>
                <label>Colour<input defaultValue={editor.product?.details?.Colour || "Natural Black (1B)"} name="colour" /></label>
                <label className="naka-span-2">Tag<input defaultValue={editor.product?.tag || ""} maxLength={50} name="tag" /></label>
                <label className="naka-span-2">Short description<textarea defaultValue={editor.product?.short_description || ""} maxLength={300} name="shortDescription" rows={2} /></label>
                <label className="naka-span-2">Description<textarea defaultValue={editor.product?.description || ""} maxLength={3000} name="description" required rows={5} /></label>
              </div>
              {combinations.length ? <div><h3>Combination pricing</h3><div className="naka-variant-grid">{combinations.map(({ origin, size }) => { const key = variantKey(origin, size); return <label key={key}>{[origin, size].filter(Boolean).join(" · ")}<input defaultValue={editor.variants[key] ?? editor.product?.price ?? ""} min={0} name={`variant:${key}`} required step="0.01" type="number" /></label>; })}</div></div> : null}
              <button className="naka-button" disabled={busy} type="submit">{busy ? "Saving…" : "Save Product"}</button>
            </form>
          </section>
        </div>
      ) : null}

      {deleteTarget ? <div className="naka-modal-backdrop" role="presentation"><section aria-modal="true" className="naka-modal naka-confirm-modal" role="alertdialog"><p className="naka-eyebrow">Delete product</p><h2>Delete {deleteTarget.name}?</h2><p>This cannot be undone.</p><div className="naka-inline-actions"><button className="naka-button-secondary" onClick={() => setDeleteTarget(null)} type="button">Cancel</button><button className="naka-button" onClick={() => void removeProduct()} type="button">Delete</button></div></section></div> : null}
    </>
  );
}

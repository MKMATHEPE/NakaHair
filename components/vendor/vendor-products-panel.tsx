"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useSession } from "@/components/providers/session-provider";
import { collectionLabel, vendorCollectionTabs, type CollectionKey, type VendorCollectionTab } from "@/lib/client/collections";
import type { ProductVariantPrice, VendorProduct } from "@/lib/client/types";
import { formatMoney } from "@/lib/client/types";
import { MAX_FEATURED_PRODUCTS, displayOrderSort, publicationIssue } from "@/lib/vendor-product-rules";

import { ProductImage } from "../shared/product-image";
import { useVendorProducts } from "./use-vendor-data";

type EditorState = {
  product: VendorProduct | null;
  collection: CollectionKey;
  origins: string[];
  sizes: string[];
  texture: string;
  variants: Record<string, number>;
};

const variantKey = (origin: string, size: string) => JSON.stringify([origin, size]);
const hairOriginOptions = [
  "Synthetic Blend", "Human Hair Blend", "Brazilian Remy", "Vietnamese Remy",
  "Malaysian Remy", "Peruvian Remy", "Cambodian Remy", "Brazilian Virgin",
  "Vietnamese Virgin", "Malaysian Virgin", "Peruvian Virgin", "Cambodian Virgin",
  "Indian Virgin",
];
const sizeOptions = Array.from({ length: 17 }, (_, index) => `${8 + index * 2}\"`);
const textureOptions = [
  "Straight", "Silky Straight", "Straight Bob", "Body Wave", "Loose Wave",
  "Deep Wave", "Water Wave", "Loose Curly", "Deep Curly", "Kinky Curly",
  "Jerry Curl", "Afro Kinky", "Double Drawn Straight", "Pixie Cut",
];

function optionsWithExisting(options: string[], selected: string[]) {
  return [...new Set([...options, ...selected])];
}

function OptionSelector({
  allowCustom = false,
  compact = false,
  legend,
  onToggle,
  options,
  selected,
}: {
  allowCustom?: boolean;
  compact?: boolean;
  legend: string;
  onToggle(value: string): void;
  options: string[];
  selected: string[];
}) {
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState("");

  function addCustomOption() {
    const normalized = customValue.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 80) {
      setCustomError("Enter an origin between 2 and 80 characters.");
      return;
    }
    if (["__proto__", "prototype", "constructor"].includes(normalized.toLowerCase())) {
      setCustomError("Enter a valid hair origin.");
      return;
    }
    const existing = optionsWithExisting(options, selected).find(
      (option) => option.toLowerCase() === normalized.toLowerCase(),
    );
    if (existing && selected.includes(existing)) {
      setCustomError(`${existing} is already selected.`);
      return;
    }
    if (!existing && selected.length >= 20) {
      setCustomError("You can select up to 20 hair origins.");
      return;
    }
    onToggle(existing || normalized);
    setCustomValue("");
    setCustomError("");
  }

  return <fieldset className={`naka-choice-fieldset naka-span-2${compact ? " naka-choice-fieldset-compact" : ""}`}>
    <legend>{legend}</legend>
    <small>Select all that apply.</small>
    <div className="naka-choice-grid">
      {optionsWithExisting(options, selected).map((option) => <button
        aria-pressed={selected.includes(option)}
        key={option}
        onClick={() => onToggle(option)}
        type="button"
      >{option}</button>)}
    </div>
    {allowCustom ? <>
      <div className="naka-custom-option">
        <input
          aria-label="Custom hair origin"
          maxLength={80}
          onChange={(event) => {
            setCustomValue(event.target.value);
            setCustomError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomOption();
            }
          }}
          placeholder="Add a custom origin"
          value={customValue}
        />
        <button className="naka-small-button" disabled={!customValue.trim()} onClick={addCustomOption} type="button">+ Add origin</button>
      </div>
      {customError ? <p aria-live="polite" className="naka-field-error">{customError}</p> : null}
    </> : null}
  </fieldset>;
}

function stateFor(product: VendorProduct | null, collection: CollectionKey = "everyday"): EditorState {
  return {
    product,
    collection: product?.collection || collection,
    origins: product?.hair_origins || [],
    sizes: product?.sizes || [],
    texture: product?.details?.Texture || "Straight",
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
  const [pendingAction, setPendingAction] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<VendorCollectionTab>("catalogue");
  const [savedMessage, setSavedMessage] = useState("");

  const combinations = useMemo(() => {
    if (!editor) return [];
    const origins = editor.origins.length ? editor.origins : [""];
    const sizes = editor.sizes.length ? editor.sizes : [""];
    return origins.flatMap((origin) => sizes.map((size) => ({ origin, size })));
  }, [editor]);

  const counts = useMemo(() => Object.fromEntries(vendorCollectionTabs.map((tab) => [
    tab.key,
    tab.key === "catalogue" ? products.length : products.filter((product) => product.collection === tab.key).length,
  ])), [products]);

  const visibleProducts = useMemo(() => products
    .filter((product) => selectedTab === "catalogue" || product.collection === selectedTab)
    .sort(displayOrderSort), [products, selectedTab]);

  const featuredCount = products.filter((product) => product.is_featured).length;

  function openEditor(product: VendorProduct | null) {
    setPendingFiles([]);
    const defaultCollection = selectedTab === "catalogue" ? "everyday" : selectedTab;
    setEditor(stateFor(product, defaultCollection));
  }

  async function updateProduct(product: VendorProduct, changes: Record<string, unknown>) {
    setPendingAction(product.id);
    setError("");
    setSavedMessage("");
    try {
      const token = await accessToken();
      const response = await fetch("/api/vendor/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: product.id, ...changes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update the product.");
      await load();
      setSavedMessage("Saved just now");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update the product.");
    } finally {
      setPendingAction(null);
    }
  }

  function toggleOption(field: "origins" | "sizes", value: string) {
    setEditor((current) => {
      if (!current) return current;
      const selected = current[field];
      return {
        ...current,
        [field]: selected.includes(value)
          ? selected.filter((option) => option !== value)
          : [...selected, value],
      };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const basePrice = Number(data.get("price"));
    const origins = editor.origins;
    const sizes = editor.sizes;
    const optionOrigins = origins.length ? origins : [""];
    const optionSizes = sizes.length ? sizes : [""];
    const desiredStatus = String(data.get("status") || "draft");
    const hasStoredImage = Boolean(editor.product?.image_urls?.some(Boolean) || editor.product?.image_url);
    const stageUntilImagesUpload = desiredStatus === "active" && !hasStoredImage && pendingFiles.length > 0;
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
      status: stageUntilImagesUpload ? "draft" : desiredStatus,
      tag: String(data.get("tag") || ""),
      shortDescription: String(data.get("shortDescription") || ""),
      description: String(data.get("description") || ""),
      hairOrigins: origins,
      sizes,
      variantPrices,
      details: {
        Texture: editor.texture,
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
      if (stageUntilImagesUpload) {
        const publish = await fetch("/api/vendor/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: body.id, status: "active" }),
        });
        body = await publish.json();
        if (!publish.ok) throw new Error(body.error || "The product was saved as a draft but could not be published.");
      }
      await load();
      setSavedMessage("Saved just now");
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
        <div><p className="naka-eyebrow">Catalogue management</p><h2>My Products</h2><p>Choose a collection, then manage the products customers see there.</p></div>
        <div className="naka-product-heading-actions">{savedMessage ? <span aria-live="polite">{savedMessage}</span> : null}<button className="naka-button-secondary" onClick={() => openEditor(null)} type="button">+ Add Product</button></div>
      </div>
      <nav aria-label="Product collections" className="naka-product-collection-tabs">
        {vendorCollectionTabs.map((tab) => <button
          aria-current={selectedTab === tab.key ? "page" : undefined}
          className={selectedTab === tab.key ? "active" : ""}
          key={tab.key}
          onClick={() => setSelectedTab(tab.key)}
          type="button"
        ><span>{tab.label}</span><small>{counts[tab.key] || 0}</small></button>)}
      </nav>
      <p className="naka-editing-collection">Editing: <strong>{selectedTab === "catalogue" ? "The Catalogue" : collectionLabel(selectedTab)}</strong></p>
      {error ? <p className="naka-error">{error}</p> : null}
      {loading ? <p>Loading products…</p> : null}
      {!loading && !visibleProducts.length ? <p className="naka-empty">No products have been added to this collection yet.</p> : null}
      {visibleProducts.length ? <div className="naka-table-wrap naka-product-management-wrap">
        <table className="naka-table naka-product-management">
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Show in store</th><th>Featured <small>{MAX_FEATURED_PRODUCTS} maximum</small></th><th>Order</th><th>Preview</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{visibleProducts.map((product) => {
            const issue = publicationIssue(product);
            const collectionProducts = products.filter((entry) => entry.collection === product.collection).sort(displayOrderSort);
            const collectionIndex = collectionProducts.findIndex((entry) => entry.id === product.id);
            const actionPending = pendingAction === product.id;
            const featureBlocked = product.status !== "active"
              || Boolean(issue)
              || (!product.is_featured && featuredCount >= MAX_FEATURED_PRODUCTS);
            return <tr key={product.id}>
              <td data-label="Product"><div className="naka-product-cell"><div className="naka-table-image"><ProductImage alt={product.name} src={product.image_urls?.[0] || product.image_url} /></div><div><strong>{product.name}</strong><small>{collectionLabel(product.collection)}</small>{issue ? <em>{issue}</em> : null}</div></div></td>
              <td data-label="Price">{formatMoney(Number(product.price))}</td>
              <td data-label="Stock">{product.stock_quantity}</td>
              <td data-label="Show in store"><button aria-checked={product.status === "active"} aria-label={`${product.status === "active" ? "Hide" : "Show"} ${product.name} in store`} className={`naka-switch${product.status === "active" ? " active" : ""}`} disabled={actionPending || (product.status !== "active" && Boolean(issue))} onClick={() => void updateProduct(product, { status: product.status === "active" ? "draft" : "active" })} role="switch" type="button"><span aria-hidden="true" /><small>{product.status === "active" ? "Shown" : "Hidden"}</small></button></td>
              <td data-label="Featured"><button aria-checked={product.is_featured} aria-label={`${product.is_featured ? "Remove" : "Add"} ${product.name} ${product.is_featured ? "from" : "to"} featured products`} className={`naka-switch${product.is_featured ? " active" : ""}`} disabled={actionPending || (!product.is_featured && featureBlocked)} onClick={() => void updateProduct(product, { isFeatured: !product.is_featured })} role="switch" type="button"><span aria-hidden="true" /><small>{product.is_featured ? "Featured" : "Not featured"}</small></button></td>
              <td data-label="Order"><div className="naka-order-controls"><strong>{collectionIndex + 1}</strong><button aria-label={`Move ${product.name} up`} disabled={actionPending || collectionIndex <= 0} onClick={() => void updateProduct(product, { action: "move", direction: -1 })} type="button">↑</button><button aria-label={`Move ${product.name} down`} disabled={actionPending || collectionIndex >= collectionProducts.length - 1} onClick={() => void updateProduct(product, { action: "move", direction: 1 })} type="button">↓</button></div></td>
              <td data-label="Preview"><Link className="naka-preview-link" href="/vendor/preview">View</Link></td>
              <td data-label="Actions"><div className="naka-inline-actions"><button className="naka-small-button" onClick={() => openEditor(product)} type="button">Edit</button><button className="naka-small-button" onClick={() => setDeleteTarget(product)} type="button">Delete</button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : null}

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
                <label>Collection<select defaultValue={editor.collection} name="collection"><option value="everyday">Glam On A Budget</option><option value="signature">Signature Collection</option><option value="luxe">Luxe Collection</option></select></label>
                <label>Base price<input defaultValue={editor.product?.price} min={0} name="price" required step="0.01" type="number" /></label>
                <label>Old price<input defaultValue={editor.product?.old_price || ""} min={0} name="oldPrice" step="0.01" type="number" /></label>
                <label>Stock<input defaultValue={editor.product?.stock_quantity || 0} min={0} name="stockQuantity" required type="number" /></label>
                <label>Visibility<select defaultValue={editor.product?.status || "draft"} name="status"><option value="draft">Draft</option><option value="active">Active in Store</option></select></label>
                <OptionSelector allowCustom compact legend="Hair origins" onToggle={(value) => toggleOption("origins", value)} options={hairOriginOptions} selected={editor.origins} />
                <OptionSelector compact legend="Sizes" onToggle={(value) => toggleOption("sizes", value)} options={sizeOptions} selected={editor.sizes} />
                <label>Texture<select onChange={(event) => setEditor((current) => current ? { ...current, texture: event.target.value } : current)} value={editor.texture}>{optionsWithExisting(textureOptions, [editor.texture]).map((texture) => <option key={texture} value={texture}>{texture}</option>)}</select></label>
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

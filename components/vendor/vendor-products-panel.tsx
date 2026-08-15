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
  customOrigins: string[];
  texture: string;
  variants: VariantEditorRow[];
};

type VariantEditorRow = {
  hairOrigin: string;
  id: string;
  price: string;
  size: string;
  stock: string;
};

type ProductPreviewState = {
  name: string;
  oldPrice: string;
  productType: string;
  shortDescription: string;
};

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
const productTypeOptions = ["Wig", "Bundles", "Closure", "Frontal", "Ponytail", "Extensions"];

function optionsWithExisting(options: string[], selected: string[]) {
  return [...new Set([...options, ...selected])];
}

function stateFor(product: VendorProduct | null, collection: CollectionKey = "everyday"): EditorState {
  const savedVariants = product?.variant_prices?.length
    ? product.variant_prices
    : product
      ? [{ hairOrigin: product.hair_origins?.[0] || null, size: product.sizes?.[0] || null, price: product.price }]
      : [{ hairOrigin: null, size: null, price: 0 }];
  const definedStock = savedVariants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
  let remainingStock = Math.max(0, Number(product?.stock_quantity || 0) - definedStock);
  return {
    product,
    collection: product?.collection || collection,
    customOrigins: (product?.hair_origins || []).filter((origin) => !hairOriginOptions.includes(origin)),
    texture: product?.details?.Texture || "Straight",
    variants: savedVariants.map((variant, index) => {
      const stock = variant.stock ?? (remainingStock > 0 ? remainingStock : 0);
      if (variant.stock === undefined) remainingStock = 0;
      return {
        hairOrigin: variant.hairOrigin || "",
        id: `variant-${product?.id || "new"}-${index}`,
        price: variant.price ? String(variant.price) : "",
        size: variant.size || "",
        stock: String(stock),
      };
    }),
  };
}

function previewFor(product: VendorProduct | null): ProductPreviewState {
  return {
    name: product?.name || "Product Name",
    oldPrice: product?.old_price == null ? "" : String(product.old_price),
    productType: product?.product_type || "Product type",
    shortDescription: product?.short_description || "Your short product description will appear here.",
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
  const [customOrigin, setCustomOrigin] = useState("");
  const [customOriginError, setCustomOriginError] = useState("");
  const [pendingAction, setPendingAction] = useState<number | null>(null);
  const [preview, setPreview] = useState<ProductPreviewState>(() => previewFor(null));
  const [selectedTab, setSelectedTab] = useState<VendorCollectionTab>("catalogue");
  const [savedMessage, setSavedMessage] = useState("");

  const counts = useMemo(() => Object.fromEntries(vendorCollectionTabs.map((tab) => [
    tab.key,
    tab.key === "catalogue" ? products.length : products.filter((product) => product.collection === tab.key).length,
  ])), [products]);

  const visibleProducts = useMemo(() => products
    .filter((product) => selectedTab === "catalogue" || product.collection === selectedTab)
    .sort(displayOrderSort), [products, selectedTab]);

  const featuredCount = products.filter((product) => product.is_featured).length;
  const editorPrices = editor?.variants.map((variant) => Number(variant.price)).filter(Number.isFinite) || [];
  const editorPrice = editorPrices.length ? Math.min(...editorPrices) : 0;
  const editorStock = editor
    ? editor.variants.reduce((sum, variant) => sum + (Number.isInteger(Number(variant.stock)) ? Number(variant.stock) : 0), 0)
    : 0;

  function openEditor(product: VendorProduct | null) {
    if (!product && selectedTab === "catalogue") return;
    setPendingFiles([]);
    const defaultCollection = selectedTab === "catalogue" ? product?.collection || "everyday" : selectedTab;
    setEditor(stateFor(product, defaultCollection));
    setPreview(previewFor(product));
    setCustomOrigin("");
    setCustomOriginError("");
  }

  function closeEditor() {
    setEditor(null);
    setPendingFiles([]);
  }

  function addPendingImages(files: FileList | null) {
    const selected = Array.from(files || []);
    const invalid = selected.find((file) => file.size > 2 * 1024 * 1024);
    if (invalid) {
      setError(`${invalid.name} is larger than 2 MB.`);
      return;
    }
    setError("");
    setPendingFiles((current) => {
      const available = Math.max(0, 8 - (editor?.product?.image_urls?.length || 0));
      const unique = [...current, ...selected].filter((file, index, all) => all.findIndex((candidate) =>
        candidate.name === file.name
        && candidate.size === file.size
        && candidate.lastModified === file.lastModified) === index);
      return unique.slice(0, available);
    });
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

  function updateVariant(id: string, field: keyof Omit<VariantEditorRow, "id">, value: string) {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        variants: current.variants.map((variant) => variant.id === id ? { ...variant, [field]: value } : variant),
      };
    });
  }

  function addVariant() {
    setEditor((current) => current ? {
      ...current,
      variants: [...current.variants, {
        hairOrigin: "",
        id: `variant-new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        price: "",
        size: "",
        stock: "0",
      }],
    } : current);
  }

  function removeVariant(id: string) {
    setEditor((current) => current ? {
      ...current,
      variants: current.variants.length > 1
        ? current.variants.filter((variant) => variant.id !== id)
        : current.variants,
    } : current);
  }

  function reorderVariant(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setEditor((current) => {
      if (!current) return current;
      const sourceIndex = current.variants.findIndex((variant) => variant.id === sourceId);
      const targetIndex = current.variants.findIndex((variant) => variant.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const variants = [...current.variants];
      const [source] = variants.splice(sourceIndex, 1);
      variants.splice(targetIndex, 0, source);
      return { ...current, variants };
    });
  }

  function addCustomOrigin() {
    const normalized = customOrigin.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 80
      || ["__proto__", "prototype", "constructor"].includes(normalized.toLowerCase())) {
      setCustomOriginError("Enter a valid origin between 2 and 80 characters.");
      return;
    }
    const options = optionsWithExisting(hairOriginOptions, editor?.customOrigins || []);
    const existing = options.find((option) => option.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      setCustomOriginError(`${existing} is already available.`);
      return;
    }
    setEditor((current) => current ? { ...current, customOrigins: [...current.customOrigins, normalized] } : current);
    setCustomOrigin("");
    setCustomOriginError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const variantPrices: ProductVariantPrice[] = editor.variants.map((variant) => ({
      hairOrigin: variant.hairOrigin || null,
      price: Number(variant.price),
      size: variant.size || null,
      stock: Number(variant.stock),
    }));
    const variantKeys = new Set(variantPrices.map((variant) => JSON.stringify([variant.hairOrigin, variant.size])));
    if (variantPrices.some((variant) => !variant.hairOrigin || !variant.size
      || !Number.isFinite(variant.price) || variant.price < 0
      || !Number.isInteger(variant.stock) || Number(variant.stock) < 0)
      || variantKeys.size !== variantPrices.length) {
      setError("Each variant needs a unique hair origin and size, a valid price, and whole-number stock.");
      setBusy(false);
      return;
    }
    const origins = [...new Set(variantPrices.map((variant) => String(variant.hairOrigin)))];
    const sizes = [...new Set(variantPrices.map((variant) => String(variant.size)))];
    const basePrice = Math.min(...variantPrices.map((variant) => Number(variant.price)));
    const stockQuantity = variantPrices.reduce((sum, variant) => sum + Number(variant.stock), 0);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const desiredStatus = submitter?.value === "active" ? "active" : "draft";
    const hasStoredImage = Boolean(editor.product?.image_urls?.some(Boolean) || editor.product?.image_url);
    const stageUntilImagesUpload = desiredStatus === "active" && !hasStoredImage && pendingFiles.length > 0;
    const payload = {
      ...(editor.product ? { id: editor.product.id } : {}),
      name: String(data.get("name") || ""),
      productType: String(data.get("productType") || ""),
      hairType: String(data.get("hairType") || ""),
      collection: editor.collection,
      price: basePrice,
      oldPrice: data.get("oldPrice"),
      stockQuantity,
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
      closeEditor();
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
        <div className="naka-product-heading-actions">{savedMessage ? <span aria-live="polite">{savedMessage}</span> : null}{!editor ? <button className="naka-button-secondary" disabled={selectedTab === "catalogue"} onClick={() => openEditor(null)} title={selectedTab === "catalogue" ? "Choose a collection before adding a product" : undefined} type="button">{selectedTab === "catalogue" ? "Select a collection to add" : "+ Add Product"}</button> : null}</div>
      </div>
      <nav aria-label="Product collections" className="naka-product-collection-tabs">
        {vendorCollectionTabs.map((tab) => <button
          aria-current={selectedTab === tab.key ? "page" : undefined}
          className={selectedTab === tab.key ? "active" : ""}
          disabled={Boolean(editor)}
          key={tab.key}
          onClick={() => setSelectedTab(tab.key)}
          type="button"
        ><span>{tab.label}</span><small>{counts[tab.key] || 0}</small></button>)}
      </nav>
      {error ? <p className="naka-error">{error}</p> : null}
      {editor ? <section className="naka-product-editor-page">
        <p className="naka-editor-collection-context">{editor.product ? "Editing in" : "Adding a product to"} <strong>{collectionLabel(editor.collection)}</strong></p>
        <form className="naka-form naka-concept-editor" onInput={(event) => {
          const data = new FormData(event.currentTarget);
          setPreview({
            name: String(data.get("name") || "Product Name"),
            oldPrice: String(data.get("oldPrice") || ""),
            productType: String(data.get("productType") || "Product type"),
            shortDescription: String(data.get("shortDescription") || "Your short product description will appear here."),
          });
        }} onSubmit={save}>
          <div className="naka-editor-workspace">
            <div className="naka-editor-fields">
              <section className="naka-editor-section">
                <h3>1. Product Details</h3>
                <div className="naka-concept-details-grid">
                  <label>Product Name *<input defaultValue={editor.product?.name} maxLength={160} name="name" placeholder="e.g. NAKA Luxe Straight Bundle" required /></label>
                  <label>Product Type *<select defaultValue={editor.product?.product_type || ""} name="productType" required><option disabled value="">Select type</option>{optionsWithExisting(productTypeOptions, editor.product?.product_type ? [editor.product.product_type] : []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label>Short Description *<input defaultValue={editor.product?.short_description || ""} maxLength={300} name="shortDescription" placeholder="A short, benefit-driven description of your product." required /></label>
                </div>
              </section>

              <section className="naka-editor-section">
                <h3>2. Images</h3>
                <p className="naka-editor-section-copy">Upload clear, high-quality images. The first image is used as the main catalogue image.</p>
                <div className="naka-concept-image-strip">
                  <label className="naka-image-add-tile"><input accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => { addPendingImages(event.target.files); event.currentTarget.value = ""; }} type="file" /><span>+</span><strong>Add Images</strong><small>JPG, PNG or WebP<br />up to 2 MB each</small></label>
                  {(editor.product?.image_urls || []).map((source, index) => <div className="naka-concept-image-tile" key={source}><ProductImage alt={`${editor.product?.name} image ${index + 1}`} src={source} /><button aria-label={`Remove image ${index + 1}`} onClick={() => void removeImage(source)} type="button">×</button>{index === 0 ? <span>Main image</span> : null}</div>)}
                  {pendingFiles.map((file, index) => <div className="naka-concept-image-tile" key={`${file.name}-${file.lastModified}`}><PendingImage file={file} /><button aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles((files) => files.filter((entry) => entry !== file))} type="button">×</button>{!editor.product?.image_urls?.length && index === 0 ? <span>Main image</span> : null}</div>)}
                </div>
              </section>

              <section className="naka-editor-section">
                <h3>3. Variants</h3>
                <div className="naka-variant-editor-head" aria-hidden="true"><span /><span>Hair Origin *</span><span>Size *</span><span>Price (ZAR) *</span><span>Stock *</span><span /></div>
                <div className="naka-variant-editor-list">{editor.variants.map((variant, index) => <div
                  className="naka-variant-editor-row"
                  key={variant.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => reorderVariant(event.dataTransfer.getData("text/plain"), variant.id)}
                >
                  <span aria-hidden="true" className="naka-variant-drag" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", variant.id)}>⠿</span>
                  <label data-label="Hair Origin"><span className="sr-only">Hair origin {index + 1}</span><select aria-label={`Hair origin ${index + 1}`} onChange={(event) => updateVariant(variant.id, "hairOrigin", event.target.value)} required value={variant.hairOrigin}><option disabled value="">Select origin</option>{optionsWithExisting(hairOriginOptions, editor.customOrigins).map((origin) => <option key={origin} value={origin}>{origin}</option>)}</select></label>
                  <label data-label="Size"><span className="sr-only">Size {index + 1}</span><select aria-label={`Size ${index + 1}`} onChange={(event) => updateVariant(variant.id, "size", event.target.value)} required value={variant.size}><option disabled value="">Select size</option>{sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
                  <label data-label="Price (ZAR)"><span className="sr-only">Price {index + 1}</span><span className="naka-money-input"><b>R</b><input aria-label={`Price ${index + 1}`} min={0} onChange={(event) => updateVariant(variant.id, "price", event.target.value)} required step="0.01" type="number" value={variant.price} /></span></label>
                  <label data-label="Stock"><span className="sr-only">Stock {index + 1}</span><input aria-label={`Stock ${index + 1}`} min={0} onChange={(event) => updateVariant(variant.id, "stock", event.target.value)} required step={1} type="number" value={variant.stock} /></label>
                  <button aria-label={`Remove variant ${index + 1}`} className="naka-variant-remove" disabled={editor.variants.length === 1} onClick={() => removeVariant(variant.id)} type="button">×</button>
                </div>)}</div>
                <div className="naka-variant-tools"><button className="naka-small-button" onClick={addVariant} type="button">+ Add Variant</button><div className="naka-custom-origin-inline"><input aria-label="Custom hair origin" maxLength={80} onChange={(event) => { setCustomOrigin(event.target.value); setCustomOriginError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomOrigin(); } }} placeholder="Create a hair origin" value={customOrigin} /><button className="naka-small-button" disabled={!customOrigin.trim()} onClick={addCustomOrigin} type="button">+ Add Origin</button></div></div>
                {customOriginError ? <p aria-live="polite" className="naka-field-error">{customOriginError}</p> : null}
              </section>

              <section className="naka-editor-section naka-more-details">
                <h3>4. More Product Details</h3>
                <div className="naka-form-grid">
                  <label>Hair type *<input defaultValue={editor.product?.hair_type} maxLength={100} name="hairType" required /></label>
                  <label>Texture<select onChange={(event) => setEditor((current) => current ? { ...current, texture: event.target.value } : current)} value={editor.texture}>{optionsWithExisting(textureOptions, [editor.texture]).map((texture) => <option key={texture} value={texture}>{texture}</option>)}</select></label>
                  <label>Colour<input defaultValue={editor.product?.details?.Colour || "Natural Black (1B)"} name="colour" /></label>
                  <label>Old price (ZAR)<span className="naka-money-input"><b>R</b><input defaultValue={editor.product?.old_price || ""} min={0} name="oldPrice" step="0.01" type="number" /></span></label>
                  <label>Tag<input defaultValue={editor.product?.tag || ""} maxLength={50} name="tag" /></label>
                  <label className="naka-span-2">Description *<textarea defaultValue={editor.product?.description || ""} maxLength={3000} name="description" required rows={4} /></label>
                </div>
              </section>
            </div>

            <aside className="naka-editor-preview">
              <h3>Customer Preview</h3>
              <div className="naka-editor-preview-card">
                <div className="naka-editor-preview-image">{editor.product?.image_urls?.[0] || editor.product?.image_url ? <ProductImage alt={preview.name} src={editor.product?.image_urls?.[0] || editor.product?.image_url} /> : pendingFiles[0] ? <PendingImage file={pendingFiles[0]} /> : <ProductImage alt={preview.name} />}</div>
                <div className="naka-editor-preview-copy"><span>{preview.productType}</span><strong>{preview.name}</strong><p className="naka-editor-preview-price">{preview.oldPrice ? <del>{formatMoney(Number(preview.oldPrice))}</del> : null}{formatMoney(editorPrice)}</p><p>{preview.shortDescription}</p><dl><div><dt>Collection</dt><dd>{collectionLabel(editor.collection)}</dd></div><div><dt>Variants</dt><dd>{editor.variants.length}</dd></div><div><dt>Stock</dt><dd>{editorStock}</dd></div></dl><button className="naka-button-secondary" disabled type="button">Add to Cart · Preview</button></div>
              </div>
            </aside>
          </div>

          <div className="naka-editor-actions">
            <button className="naka-link-button" disabled={busy} onClick={closeEditor} type="button">Cancel</button>
            <button className="naka-button-secondary" disabled={busy} type="submit" value="draft">{busy ? "Saving…" : "Save Draft"}</button>
            <button className="naka-button" disabled={busy} type="submit" value="active">{busy ? "Saving…" : `Publish to ${collectionLabel(editor.collection)}`}</button>
          </div>
        </form>
      </section> : <>
        <p className="naka-editing-collection">Editing: <strong>{selectedTab === "catalogue" ? "The Catalogue" : collectionLabel(selectedTab)}</strong></p>
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
              const featureBlocked = product.status !== "active" || Boolean(issue) || (!product.is_featured && featuredCount >= MAX_FEATURED_PRODUCTS);
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
      </>}

      {deleteTarget ? <div className="naka-modal-backdrop" role="presentation"><section aria-modal="true" className="naka-modal naka-confirm-modal" role="alertdialog"><p className="naka-eyebrow">Delete product</p><h2>Delete {deleteTarget.name}?</h2><p>This cannot be undone.</p><div className="naka-inline-actions"><button className="naka-button-secondary" onClick={() => setDeleteTarget(null)} type="button">Cancel</button><button className="naka-button" onClick={() => void removeProduct()} type="button">Delete</button></div></section></div> : null}
    </>
  );
}

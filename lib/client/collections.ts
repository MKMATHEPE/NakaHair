export const collections = [
  { key: "everyday", eyebrow: "Glam On A Budget", title: "Everyday confidence", copy: "Soft, reliable styles at prices that work for you." },
  { key: "signature", eyebrow: "Signature Collection", title: "Our most-loved styles", copy: "A considered balance of quality, finish, and lasting value." },
  { key: "luxe", eyebrow: "Luxe Collection", title: "The finest hair we carry", copy: "Top-grade virgin hair, handpicked for exceptional softness and longevity." },
] as const;

export type CollectionKey = typeof collections[number]["key"];

export function collectionByKey(key: string) {
  return collections.find((collection) => collection.key === key);
}

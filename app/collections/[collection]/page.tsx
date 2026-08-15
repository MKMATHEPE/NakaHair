import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionStorefront } from "@/components/store/collection-storefront";
import { collectionByKey, collections } from "@/lib/client/collections";

type Props = { params: Promise<{ collection: string }> };

export function generateStaticParams() {
  return collections.map((collection) => ({ collection: collection.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = collectionByKey((await params).collection);
  return collection ? { title: `${collection.eyebrow} | NAKA Hair`, description: collection.copy } : {};
}

export default async function CollectionPage({ params }: Props) {
  const collection = collectionByKey((await params).collection);
  if (!collection) notFound();
  return <CollectionStorefront collection={collection.key} copy={collection.copy} eyebrow={collection.eyebrow} title={collection.title} />;
}

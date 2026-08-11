"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="grid min-h-[60vh] place-items-center px-4 text-center"><div><p className="eyebrow">Something went wrong</p><h1 className="font-serif text-4xl">We couldn&apos;t load the collection.</h1><p className="mt-3 text-sm text-muted-foreground">Please try again in a moment.</p><Button className="mt-7" onClick={reset}>Try again</Button></div></div>;
}

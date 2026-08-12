import { readFileSync } from "node:fs";
import path from "node:path";
import { StorefrontBootstrap } from "./storefront-bootstrap";

export const dynamic = "force-static";

function readLegacyStorefront() {
  const source = readFileSync(path.join(process.cwd(), "legacy", "index.html"), "utf8");
  const styles = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const body = source.match(/<body>([\s\S]*?)<script>/i)?.[1] ?? "";

  if (!styles || !body) {
    throw new Error("The preserved storefront template is incomplete.");
  }

  return { styles, body };
}

export default function HomePage() {
  const { styles, body } = readLegacyStorefront();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div
        style={{ display: "contents" }}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <StorefrontBootstrap />
    </>
  );
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { StorefrontBootstrap } from "./storefront-bootstrap";

function readLegacyStorefront() {
  const source = readFileSync(path.join(process.cwd(), "legacy", "index.html"), "utf8");
  const styles = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const body = source.match(/<body>([\s\S]*?)<script>/i)?.[1] ?? "";

  if (!styles || !body) {
    throw new Error("The preserved storefront template is incomplete.");
  }

  return { styles, body };
}

const legacyStorefront = readLegacyStorefront();

export function StorefrontPage() {
  const { styles, body } = legacyStorefront;

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

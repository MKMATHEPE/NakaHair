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

function createAccountPageBody(body: string) {
  const accountView = body.match(
    /<main class="account-view" id="account-view" style="display: none"><\/main>/,
  )?.[0];
  const footer = body.match(/<footer>[\s\S]*?<\/footer>/)?.[0];

  if (!accountView || !footer) {
    throw new Error("The preserved account page structure is incomplete.");
  }

  const bodyWithoutAccountView = body.replace(accountView, "");
  const navigationEnd = bodyWithoutAccountView.indexOf("</nav>") + "</nav>".length;
  const footerStart = bodyWithoutAccountView.indexOf(footer);

  if (navigationEnd < "</nav>".length || footerStart < navigationEnd) {
    throw new Error("The preserved storefront page order is incomplete.");
  }

  const navigation = bodyWithoutAccountView.slice(0, navigationEnd);
  const homeContent = bodyWithoutAccountView.slice(navigationEnd, footerStart);
  const footerAndOverlays = bodyWithoutAccountView.slice(footerStart);

  return `${navigation}
    <div hidden aria-hidden="true">${homeContent}</div>
    ${accountView}
    ${footerAndOverlays}`;
}

const accountPageBody = createAccountPageBody(legacyStorefront.body);

export function StorefrontPage({
  accountPage = false,
  vendorPage = false,
}: {
  accountPage?: boolean;
  vendorPage?: boolean;
}) {
  const { styles } = legacyStorefront;
  const body = accountPage ? accountPageBody : legacyStorefront.body;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {accountPage ? (
        <style>{`.account-route #account-view { min-height: calc(100vh - 160px); }`}</style>
      ) : null}
      {vendorPage ? (
        <style>{`.vendor-route .nav-search, .vendor-route .nav-wishlist, .vendor-route .nav-cart, .vendor-route #customer-menu, .vendor-route #login-nav-link { display: none !important; }`}</style>
      ) : null}
      <div
        className={
          accountPage
            ? `account-route${vendorPage ? " vendor-route" : ""}`
            : undefined
        }
        style={{ display: "contents" }}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <StorefrontBootstrap />
    </>
  );
}

# Bono Hair — site with admin login, price edits, and image uploads

## What changed from the static file you had

Your original page was a single HTML file with the product catalogue
hardcoded in JavaScript — anyone could edit it, but only by editing the file
itself, and everyone who visited saw the same fixed data. That's fine for a
brochure page, but it can't support "the owner logs in and changes a price
and everyone else immediately sees the new price."

This version adds a small **Node.js backend** (`/server`) that:

- Stores every product in a real database (SQLite — a single file, no
  separate database server to run)
- Serves the product list to any visitor with **no login required**
  (`GET /api/products`)
- Only allows **price/name/description edits** and **image uploads** from a
  request carrying a valid admin login token
- Hashes the admin password (bcrypt) — the real password is never stored or
  logged anywhere

The frontend (`/public/index.html`) is your original design, unchanged
visually, with:

- Products now loaded from the server on page load instead of being
  hardcoded (falls back to a tiny built-in demo product if the server is
  unreachable, so the page never shows completely blank)
- A small "Admin" link in the nav that opens a login form
- Once logged in, an edit panel appears on any product page, letting you
  change the name, price, old price, tag, description, and image
- Customers never see any of this — there's no signup flow, no account
  system for shoppers, nothing gating browsing

## Getting it running locally

You'll need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a long random string. You can generate
one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create your admin login:

```bash
npm run create-admin
```

You'll be prompted for a username and password (password typing is hidden).
Run this command again any time to reset the password.

Start the server:

```bash
npm start
```

Visit **http://localhost:3000** — that's the whole site, frontend and API
together on one port.

## Project layout

```
bono-hair/
  server/
    index.js          Express app: static file serving + API routes
    db.js              SQLite schema + one-time seeding from seed-products.json
    auth.js            JWT verification middleware for admin-only routes
    create-admin.js    CLI to create/reset the admin account
    seed-products.json Initial catalogue (your 15 original products)
    uploads/           Uploaded product images land here
    .env.example       Copy to .env and fill in
  public/
    index.html         The site itself (your original design + admin UI)
    content/           Put your original product images here (bobBudget.PNG, etc.)
```

Note: the product photos referenced in the seed data (e.g.
`content/bobBudget.PNG`) aren't included — copy your actual image files into
`public/content/` with matching names, or just upload new photos through the
admin panel once the site is running (that's the easiest path, and it's
exactly what the image upload feature is for).

## How the admin login actually works

- `POST /api/admin/login` checks the username/password against the hashed
  password in the database and, if correct, returns a signed **JWT** valid
  for 12 hours.
- The browser stores that token and sends it as an `Authorization: Bearer …`
  header on every admin request (price edits, image uploads).
- `PUT /api/admin/products/:id` and `POST /api/admin/products/:id/image`
  both check that header before doing anything — a request without a valid
  token gets a 401 and nothing changes.
- Login attempts are rate-limited (10 per 10 minutes per IP) to slow down
  password guessing.
- There is exactly one admin account by design, matching what you described
  (the owner). If you ever want multiple staff accounts, the `admins` table
  can hold more than one row — ask if you want that added.

## Deploying this for real

This is a normal Node.js app, so it runs on almost any host that runs
Node: a VPS (DigitalOcean, Linode, Hetzner), Railway, Render, Fly.io, etc.
A few things matter for your specific case:

1. **Persistent disk.** SQLite (`data.db`) and the uploaded images
   (`server/uploads/`) are plain files. Make sure wherever you deploy keeps
   a persistent disk across restarts/deploys — this is true of a regular
   VPS and most of Railway/Render's standard (non-serverless) offerings,
   but is **not** true of purely serverless platforms (e.g. Vercel
   functions), which wipe the filesystem between requests.
2. **HTTPS.** Put this behind a reverse proxy (Nginx, Caddy, or the
   platform's built-in TLS) so login credentials and tokens are encrypted
   in transit. Don't run this over plain HTTP in production.
3. **Environment variables.** Set `JWT_SECRET` (and `PORT` if needed) as
   real environment variables in your hosting platform's dashboard, not by
   uploading a `.env` file — most platforms have a secrets/env-vars section
   for this.
4. **Since you mentioned you may have real file/image hosting available**
   (e.g. an S3-compatible bucket or a CMS): the current setup stores
   uploaded images on local disk, which is simplest and works everywhere.
   If you'd rather have images go straight to a bucket (better for
   multi-server setups, CDNs, etc.), that's a fairly small change to the
   `multer` storage configuration in `server/index.js` — happy to wire that
   up if you tell me which provider/bucket you're using.
5. **Back up `server/data.db` periodically** once real customers/products
   are in it — it's a single file, so this is as simple as copying it
   somewhere safe on a schedule.

## Extending this later

A few things I deliberately left out to keep this focused on what you
asked for (login + price/image edits), but are natural next steps if you
want them:

- Adding brand-new products (not just editing existing ones) or deleting
  products, from the admin panel
- Multiple admin/staff accounts with different permissions
- An order/checkout system (right now "Add to Cart" is still just a
  frontend counter, as it was in your original file)

Let me know if you'd like any of these added.

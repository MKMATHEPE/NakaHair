const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    collection TEXT NOT NULL,
    hairType TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    price TEXT NOT NULL,
    oldPrice TEXT,
    tag TEXT,
    rating REAL NOT NULL DEFAULT 4.5,
    reviewCount INTEGER NOT NULL DEFAULT 0,
    shortDesc TEXT,
    desc TEXT,
    image TEXT,
    sizes TEXT NOT NULL DEFAULT '[]',
    hairOrigins TEXT NOT NULL DEFAULT '[]',
    details TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('admin', 'customer')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_method TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    address TEXT NOT NULL,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    street TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Lightweight migration for existing stores created before order statuses
// were introduced.
const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
if (!orderColumns.some((column) => column.name === "status")) {
  db.exec("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'Order received'");
}

// Seed the product catalogue once, the first time the server ever runs.
const existingCount = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
if (existingCount === 0) {
  const seedData = require("./seed-products.json");
  const insert = db.prepare(`
    INSERT INTO products
      (id, collection, hairType, name, type, price, oldPrice, tag, rating, reviewCount, shortDesc, desc, image, sizes, hairOrigins, details)
    VALUES
      (@id, @collection, @hairType, @name, @type, @price, @oldPrice, @tag, @rating, @reviewCount, @shortDesc, @desc, @image, @sizes, @hairOrigins, @details)
  `);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(
    seedData.map((p) => ({
      ...p,
      oldPrice: p.oldPrice || null,
      tag: p.tag || "",
      image: p.image || "",
      sizes: JSON.stringify(p.sizes || []),
      hairOrigins: JSON.stringify(p.hairOrigins || []),
      details: JSON.stringify(p.details || {}),
    })),
  );
  console.log(`Seeded ${seedData.length} products into data.db`);
}

function rowToProduct(row) {
  return {
    ...row,
    sizes: JSON.parse(row.sizes || "[]"),
    hairOrigins: JSON.parse(row.hairOrigins || "[]"),
    details: JSON.parse(row.details || "{}"),
  };
}

module.exports = { db, rowToProduct };

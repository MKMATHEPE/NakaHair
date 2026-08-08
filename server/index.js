const path = require("path");
// Always load the configuration that belongs to this server, regardless of
// whether it is started with `npm start` inside /server or `node server/index.js`
// from the project root.
require("dotenv").config({ path: path.join(__dirname, ".env") });
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, rowToProduct } = require("./db");
const { authenticateUser, requireAdmin, requireCustomer } = require("./auth");

if (!process.env.JWT_SECRET) {
  console.error(
    "Missing JWT_SECRET in .env — copy .env.example to .env and set a long random value, then restart.",
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", true); // needed so req.ip is correct behind a reverse proxy / load balancer
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ── image uploads ──
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${req.params.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.mimetype,
    );
    cb(ok ? null : new Error("Only JPG, PNG, WEBP, or GIF images are allowed."), ok);
  },
});

// ── very small in-memory rate limiter, just for the login endpoint ──
const loginAttempts = new Map(); // ip -> { count, resetAt }
function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }
  if (entry.count >= 10) {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }
  entry.count++;
  next();
}

// ─────────────────────────────────────────────────────────
// PUBLIC — anyone can call these, no login required
// ─────────────────────────────────────────────────────────
app.get("/api/products", (req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY id").all();
  res.json(rows.map(rowToProduct));
});

app.get("/api/products/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found." });
  res.json(rowToProduct(row));
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (user) => ({ id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, phone: user.phone, role: user.role, createdAt: user.created_at });
const createToken = (user) => jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: "12h" });

app.post("/api/orders/track", rateLimitLogin, (req, res) => {
  const orderNumber = String((req.body || {}).orderNumber || "").trim();
  const email = String((req.body || {}).email || "").trim().toLowerCase();
  if (!orderNumber || !emailPattern.test(email)) {
    return res.status(400).json({ error: "Enter your order number and email address." });
  }
  const order = db
    .prepare("SELECT order_number, created_at FROM orders WHERE order_number = ? AND lower(email) = ?")
    .get(orderNumber, email);
  if (!order) return res.status(404).json({ error: "We could not find an order with those details." });
  res.json({ orderNumber: order.order_number, status: "Order received", createdAt: order.created_at });
});

app.post("/api/contact", rateLimitLogin, (req, res) => {
  const name = String((req.body || {}).name || "").trim();
  const email = String((req.body || {}).email || "").trim().toLowerCase();
  const message = String((req.body || {}).message || "").trim();
  if (!name || !emailPattern.test(email) || !message) {
    return res.status(400).json({ error: "Enter your name, a valid email address, and a message." });
  }
  if (name.length > 120 || message.length > 3000) {
    return res.status(400).json({ error: "Please keep your message under 3,000 characters." });
  }
  db.prepare("INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)").run(name, email, message);
  res.status(201).json({ message: "Thanks — your message has been received." });
});

// ─────────────────────────────────────────────────────────
// CUSTOMER AUTH + ACCOUNT
// ─────────────────────────────────────────────────────────
app.post("/api/auth/register", rateLimitLogin, (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (![firstName, lastName, normalizedEmail, phone, password, confirmPassword].every((v) => String(v || "").trim())) return res.status(400).json({ error: "All fields are required." });
  if (!emailPattern.test(normalizedEmail)) return res.status(400).json({ error: "Enter a valid email address." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (password !== confirmPassword) return res.status(400).json({ error: "Passwords do not match." });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail)) return res.status(409).json({ error: "An account with this email already exists." });
  const result = db.prepare("INSERT INTO users (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)").run(String(firstName).trim(), String(lastName).trim(), normalizedEmail, String(phone).trim(), bcrypt.hashSync(password, 12));
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", rateLimitLogin, (req, res) => {
  const email = String((req.body || {}).email || "").trim().toLowerCase();
  const password = (req.body || {}).password;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !password || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "Invalid email or password." });
  res.json({ token: createToken(user), user: publicUser(user) });
});

app.post("/api/auth/logout", authenticateUser, (req, res) => res.status(204).end());
app.get("/api/auth/me", requireCustomer, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
  res.json({ user: publicUser(user) });
});
app.put("/api/account", requireCustomer, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  const firstName = String(req.body.firstName || user.first_name).trim();
  const lastName = String(req.body.lastName || user.last_name).trim();
  const phone = String(req.body.phone || user.phone).trim();
  const password = req.body.password;
  if (!firstName || !lastName || !phone) return res.status(400).json({ error: "First name, last name, and phone are required." });
  if (password && String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  db.prepare("UPDATE users SET first_name=?, last_name=?, phone=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(firstName, lastName, phone, password ? bcrypt.hashSync(password, 12) : user.password_hash, user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
});

app.get("/api/orders", requireCustomer, (req, res) => res.json(db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(req.user.sub)));
app.get("/api/addresses", requireCustomer, (req, res) => res.json(db.prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC").all(req.user.sub)));
app.post("/api/addresses", requireCustomer, (req, res) => {
  const { label, address, province, city, street, postalCode } = req.body || {};
  if (![address, province, city, street, postalCode].every((v) => String(v || "").trim())) return res.status(400).json({ error: "Complete all address fields." });
  const result = db.prepare("INSERT INTO addresses (user_id, label, address, province, city, street, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?)").run(req.user.sub, String(label || "Home").trim(), String(address).trim(), String(province).trim(), String(city).trim(), String(street).trim(), String(postalCode).trim());
  res.status(201).json(db.prepare("SELECT * FROM addresses WHERE id = ?").get(result.lastInsertRowid));
});
app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.items) || !body.items.length || !body.email || !body.phone || !body.deliveryAddress || !body.deliveryMethod || !body.paymentMethod || !Number.isFinite(Number(body.total))) return res.status(400).json({ error: "Complete checkout details are required." });
  let userId = null;
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token) { try { const decoded = jwt.verify(token, process.env.JWT_SECRET); if (decoded.role === "customer") userId = decoded.sub; } catch (_) {} }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const orderNumber = `BH-${stamp}-${String(Date.now()).slice(-6)}`;
  db.prepare("INSERT INTO orders (order_number, user_id, email, phone, delivery_address, delivery_method, payment_method, items, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(orderNumber, userId, String(body.email).trim(), String(body.phone).trim(), String(body.deliveryAddress).trim(), body.deliveryMethod, body.paymentMethod, JSON.stringify(body.items), Number(body.total));
  res.status(201).json({ orderNumber });
});

// ─────────────────────────────────────────────────────────
// ADMIN AUTH
// ─────────────────────────────────────────────────────────
app.post("/api/admin/login", rateLimitLogin, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = jwt.sign(
    { sub: admin.id, username: admin.username, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "12h" },
  );
  res.json({ token, role: "admin" });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, role: req.admin.role || "admin" });
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT id, order_number, email, phone, delivery_address, delivery_method,
           payment_method, items, total, status, created_at
    FROM orders
    ORDER BY created_at DESC
  `).all();
  res.json(orders.map((order) => ({ ...order, items: JSON.parse(order.items || "[]") })));
});

app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const statuses = ["Order received", "Processing", "Dispatched", "Delivered", "Cancelled"];
  const status = String((req.body || {}).status || "");
  if (!statuses.includes(status)) return res.status(400).json({ error: "Invalid order status." });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Order not found." });
  res.json(db.prepare("SELECT id, order_number, status FROM orders WHERE id = ?").get(req.params.id));
});

app.get("/api/admin/customers", requireAdmin, (req, res) => {
  const customers = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at,
           COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_spend
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.role = 'customer'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(customers);
});

app.get("/api/admin/reports", requireAdmin, (req, res) => {
  const totals = db.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS revenue,
           COALESCE(AVG(total), 0) AS average_order_value
    FROM orders
    WHERE status <> 'Cancelled'
  `).get();
  const recentOrders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE created_at >= datetime('now', '-30 days')").get();
  const customerCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'").get();
  res.json({ ...totals, recentOrders: recentOrders.count, customerCount: customerCount.count });
});

// ─────────────────────────────────────────────────────────
// ADMIN — product edits (price, name, description, tag, image, origins, sizes, details)
// ─────────────────────────────────────────────────────────
const editableFields = [
  "name",
  "type",
  "price",
  "oldPrice",
  "tag",
  "shortDesc",
  "desc",
  "hairOrigins",
  "sizes",
  "details",
];

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found." });

  const updates = {};
  for (const field of editableFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.name === "") return res.status(400).json({ error: "Name cannot be empty." });
  if (updates.price === "") return res.status(400).json({ error: "Price cannot be empty." });

  const merged = { ...row, ...updates };
  db.prepare(
    `UPDATE products
     SET name=@name,
         type=@type,
         price=@price,
         oldPrice=@oldPrice,
         tag=@tag,
         shortDesc=@shortDesc,
         desc=@desc,
         hairOrigins=@hairOrigins,
         sizes=@sizes,
         details=@details
     WHERE id=@id`,
  ).run({
    ...merged,
    hairOrigins: typeof merged.hairOrigins === "string" ? merged.hairOrigins : JSON.stringify(merged.hairOrigins || []),
    sizes: typeof merged.sizes === "string" ? merged.sizes : JSON.stringify(merged.sizes || []),
    details: typeof merged.details === "string" ? merged.details : JSON.stringify(merged.details || {}),
  });

  const updatedRow = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json(rowToProduct(updatedRow));
});

app.post("/api/admin/products/:id/image", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found." });

  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No image uploaded." });

    // Clean up the previously uploaded file (if any) so uploads/ doesn't grow forever.
    if (row.image && row.image.startsWith("/uploads/")) {
      const oldPath = path.join(__dirname, row.image.replace("/uploads/", "uploads/"));
      fs.unlink(oldPath, () => {});
    }

    const imageUrl = "/uploads/" + req.file.filename;
    db.prepare("UPDATE products SET image = ? WHERE id = ?").run(imageUrl, req.params.id);
    const updatedRow = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    res.json(rowToProduct(updatedRow));
  });
});

app.listen(PORT, () => {
  console.log(`Bono Hair server running on http://localhost:${PORT}`);
});

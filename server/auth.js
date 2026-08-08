const jwt = require("jsonwebtoken");

function authenticateUser(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  authenticateUser(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    req.admin = req.user;
    next();
  });
}

function requireCustomer(req, res, next) {
  authenticateUser(req, res, () => {
    if (req.user.role !== "customer") return res.status(403).json({ error: "Customer access required." });
    next();
  });
}

module.exports = { authenticateUser, requireAdmin, requireCustomer };

import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET;
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required.");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "15mb" }));

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NULL,
      google_sub VARCHAR(255) NULL UNIQUE,
      avatar_url TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS annotations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      doc_id VARCHAR(255) NOT NULL,
      highlights_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY annotations_user_doc_unique (user_id, doc_id),
      CONSTRAINT annotations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), jwtSecret, { expiresIn: "30d" });
}

async function findUserByEmail(email) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Sessao expirada. Faca login novamente." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: "Sessao expirada. Faca login novamente." });
  }
}

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || password.length < 8) {
    return res.status(400).json({ message: "Informe nome, e-mail e uma senha com pelo menos 8 caracteres." });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ message: "Ja existe uma conta com esse e-mail." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash],
  );
  const user = await findUserById(result.insertId);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = await findUserByEmail(email);
  if (!user || !user.password_hash) {
    return res.status(401).json({ message: "E-mail ou senha invalidos." });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ message: "E-mail ou senha invalidos." });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/google", async (req, res) => {
  if (!googleClient || !googleClientId) {
    return res.status(503).json({ message: "Login com Google ainda nao foi configurado." });
  }

  const credential = String(req.body.credential || "");
  if (!credential) {
    return res.status(400).json({ message: "Credencial do Google ausente." });
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    return res.status(401).json({ message: "Nao foi possivel validar a conta Google." });
  }

  const email = payload.email.toLowerCase();
  let user = await findUserByEmail(email);

  if (user) {
    await pool.execute(
      "UPDATE users SET google_sub = COALESCE(google_sub, ?), avatar_url = COALESCE(?, avatar_url) WHERE id = ?",
      [payload.sub, payload.picture || null, user.id],
    );
    user = await findUserById(user.id);
  } else {
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, google_sub, avatar_url) VALUES (?, ?, ?, ?)",
      [payload.name || email, email, payload.sub, payload.picture || null],
    );
    user = await findUserById(result.insertId);
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ message: "Usuario nao encontrado." });
  }
  res.json({ user: publicUser(user) });
});

app.get("/api/annotations/:docId", requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT highlights_json FROM annotations WHERE user_id = ? AND doc_id = ? LIMIT 1",
    [req.user.id, req.params.docId],
  );
  res.json({ highlights: rows[0]?.highlights_json || [] });
});

app.put("/api/annotations/:docId", requireAuth, async (req, res) => {
  const highlights = Array.isArray(req.body.highlights) ? req.body.highlights : [];
  const serialized = JSON.stringify(highlights);

  await pool.execute(
    `INSERT INTO annotations (user_id, doc_id, highlights_json)
     VALUES (?, ?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE highlights_json = VALUES(highlights_json), updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, req.params.docId, serialized],
  );

  res.json({ ok: true });
});

app.use(express.static(path.join(rootDir, "dist")));
app.use(express.static(path.join(rootDir, "public")));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

await ensureSchema();
app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

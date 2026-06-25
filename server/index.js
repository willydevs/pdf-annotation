import Anthropic from "@anthropic-ai/sdk";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import fs from "node:fs/promises";
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
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const anthropicModel = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const vadeMecumTextPath = path.join(rootDir, "public", "vade_mecum_text_pages.json");
const vadeMecumTextFallbackPath = path.join(rootDir, "output", "pdf", "vade_mecum_text_pages.json");

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(190) NOT NULL DEFAULT 'Nova conversa',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT ai_conversations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content MEDIUMTEXT NOT NULL,
      actions_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ai_messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
      CONSTRAINT ai_messages_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

function parseHighlights(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseActions(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function loadVadeMecumPages() {
  try {
    const raw = await fs.readFile(vadeMecumTextPath, "utf8");
    return JSON.parse(raw);
  } catch {
    try {
      const raw = await fs.readFile(vadeMecumTextFallbackPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

let vadeMecumPagesPromise = loadVadeMecumPages();

function scorePage(page, terms) {
  const text = page.text.toLowerCase();
  return terms.reduce((score, term) => {
    if (!term || term.length < 3) {
      return score;
    }

    const matches = text.split(term).length - 1;
    return score + matches * Math.min(term.length, 16);
  }, 0);
}

async function searchVadeMecum(query, limit = 6) {
  const pages = await vadeMecumPagesPromise;
  const terms = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length >= 3);

  if (!pages.length || !terms.length) {
    return [];
  }

  const normalizedPages = pages.map((page) => ({
    ...page,
    text: page.text || "",
    normalizedText: (page.text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  }));

  return normalizedPages
    .map((page) => ({ ...page, score: scorePage({ text: page.normalizedText }, terms) }))
    .filter((page) => page.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text.slice(0, 1800),
    }));
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Invalid AI JSON response.");
  }
}

function toClientMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    actions: parseActions(row.actions_json),
    createdAt: row.created_at,
  };
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
  res.json({ highlights: parseHighlights(rows[0]?.highlights_json) });
});

app.put("/api/annotations/:docId", requireAuth, async (req, res) => {
  const highlights = Array.isArray(req.body.highlights) ? req.body.highlights : [];
  const serialized = JSON.stringify(highlights);

  await pool.execute(
    `INSERT INTO annotations (user_id, doc_id, highlights_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE highlights_json = VALUES(highlights_json), updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, req.params.docId, serialized],
  );

  res.json({ ok: true });
});

app.get("/api/ai/conversations", requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, title, created_at, updated_at
     FROM ai_conversations
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT 50`,
    [req.user.id],
  );

  res.json({
    conversations: rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
});

app.post("/api/ai/conversations", requireAuth, async (req, res) => {
  const title = String(req.body.title || "Nova conversa").trim().slice(0, 190) || "Nova conversa";
  const [result] = await pool.execute(
    "INSERT INTO ai_conversations (user_id, title) VALUES (?, ?)",
    [req.user.id, title],
  );

  res.status(201).json({
    conversation: {
      id: result.insertId,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
});

app.get("/api/ai/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const [conversations] = await pool.execute(
    "SELECT id FROM ai_conversations WHERE id = ? AND user_id = ? LIMIT 1",
    [req.params.conversationId, req.user.id],
  );

  if (!conversations.length) {
    return res.status(404).json({ message: "Conversa nao encontrada." });
  }

  const [rows] = await pool.execute(
    `SELECT id, role, content, actions_json, created_at
     FROM ai_messages
     WHERE conversation_id = ? AND user_id = ?
     ORDER BY id ASC`,
    [req.params.conversationId, req.user.id],
  );

  res.json({ messages: rows.map(toClientMessage) });
});

app.post("/api/ai/chat", requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ message: "IA nao configurada. Informe ANTHROPIC_API_KEY no servidor." });
  }

  const content = String(req.body.content || "").trim();
  const docId = String(req.body.docId || "vade_mecum_default").slice(0, 255);
  let conversationId = req.body.conversationId ? Number(req.body.conversationId) : null;

  if (!content) {
    return res.status(400).json({ message: "Digite uma pergunta para a IA." });
  }

  if (conversationId) {
    const [rows] = await pool.execute(
      "SELECT id FROM ai_conversations WHERE id = ? AND user_id = ? LIMIT 1",
      [conversationId, req.user.id],
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Conversa nao encontrada." });
    }
  } else {
    const title = content.slice(0, 80);
    const [result] = await pool.execute(
      "INSERT INTO ai_conversations (user_id, title) VALUES (?, ?)",
      [req.user.id, title || "Nova conversa"],
    );
    conversationId = result.insertId;
  }

  await pool.execute(
    "INSERT INTO ai_messages (conversation_id, user_id, role, content) VALUES (?, ?, 'user', ?)",
    [conversationId, req.user.id, content],
  );

  const [historyRows] = await pool.execute(
    `SELECT role, content
     FROM ai_messages
     WHERE conversation_id = ? AND user_id = ?
     ORDER BY id DESC
     LIMIT 10`,
    [conversationId, req.user.id],
  );
  const history = historyRows.reverse();
  const contextPages = await searchVadeMecum(content);

  const systemPrompt = `
Voce e uma IA juridica dentro de um leitor de PDF do Vade Mecum.
Responda em portugues do Brasil, com objetividade e cuidado juridico.
Use as paginas recuperadas do Vade Mecum quando forem relevantes.
Voce pode sugerir acoes para o app executar.

Retorne somente JSON valido neste formato:
{
  "message": "resposta para o usuario",
  "actions": [
    {
      "type": "go_to_page",
      "label": "Abrir pagina 10",
      "pageNumber": 10
    },
    {
      "type": "create_annotation",
      "label": "Criar anotacao",
      "pageNumber": 10,
      "quote": "trecho curto encontrado ou sugerido",
      "note": "texto da nota"
    }
  ]
}

Use no maximo 4 acoes. So crie actions quando forem realmente uteis.
Para criar anotacao, escolha pageNumber e quote curtos. Se nao tiver pagina segura, nao crie action.
Nao invente citacoes. Se o contexto nao bastar, diga o que precisa ser verificado.
`.trim();

  const contextText = contextPages.length
    ? contextPages.map((page) => `Pagina ${page.pageNumber}:\n${page.text}`).join("\n\n---\n\n")
    : "Nenhuma pagina relevante encontrada no indice local.";

  const anthropicMessages = [
    ...history.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })),
    {
      role: "user",
      content: `Pergunta atual: ${content}\n\nDocumento: ${docId}\n\nContexto recuperado do Vade Mecum:\n${contextText}`,
    },
  ];

  const completion = await anthropic.messages.create({
    model: anthropicModel,
    max_tokens: 1200,
    temperature: 0.2,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const text = completion.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const parsed = extractJsonObject(text);
  const assistantContent = String(parsed.message || "Nao consegui montar uma resposta.");
  const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : [];

  const [messageResult] = await pool.execute(
    "INSERT INTO ai_messages (conversation_id, user_id, role, content, actions_json) VALUES (?, ?, 'assistant', ?, ?)",
    [conversationId, req.user.id, assistantContent, JSON.stringify(actions)],
  );
  await pool.execute("UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [conversationId]);

  res.json({
    conversationId,
    message: {
      id: messageResult.insertId,
      role: "assistant",
      content: assistantContent,
      actions,
      createdAt: new Date().toISOString(),
    },
  });
});

app.get("/api/vade-mecum/toc", async (_req, res) => {
  const pages = await vadeMecumPagesPromise;
  if (!pages.length) {
    return res.json({ entries: [] });
  }

  // Patterns that indicate the start of a major law or section
  const titlePatterns = [
    /^CONSTITUIÇÃO/,
    /^EMENDA CONSTITUCIONAL/,
    /^ATO DAS DISPOSIÇÕES/,
    /^CÓDIGO\s+\w/,
    /^CONSOLIDAÇÃO DAS LEIS/,
    /^ESTATUTO\s+D[AEOI]/,
    /^LEI\s+N[Oº°\.]\s*[\d.]+/,
    /^DECRETO-LEI\s+N[Oº°\.]\s*[\d.]+/,
    /^DECRETO\s+N[Oº°\.]\s*[\d.]+/,
    /^LEI COMPLEMENTAR\s+N[Oº°\.]\s*[\d.]+/,
    /^MEDIDA PROVISÓRIA\s+N[Oº°\.]\s*[\d.]+/,
    /^SÚMULA/,
  ];

  const entries = [];
  const seen = new Set();

  for (const page of pages) {
    const text = (page.text || '').trim();
    if (!text) continue;

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines.slice(0, 12)) {
      if (line.length < 8 || line.length > 180) continue;

      const upper = line.toUpperCase();
      const isAllCaps = line === upper && /[A-ZÁÉÍÓÚÀÃÕÂÊÔ]/.test(line) && line.length >= 12;
      const matchesPattern = titlePatterns.some(p => p.test(upper));

      if (matchesPattern || isAllCaps) {
        const clean = line.replace(/\s+/g, ' ').trim();
        if (!seen.has(clean)) {
          seen.add(clean);
          entries.push({ title: clean, pageNumber: page.pageNumber });
        }
        break;
      }
    }
  }

  res.json({ entries });
});

app.use(express.static(path.join(rootDir, "dist")));
app.use(express.static(path.join(rootDir, "public")));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

await ensureSchema();

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });
}

export default app;

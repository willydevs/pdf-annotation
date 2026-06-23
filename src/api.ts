import type { AiConversation, AiMessage, Highlight, Session, User } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const SESSION_KEY = "pdf-annotation-session";

interface AuthResponse {
  token: string;
  user: User;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({
    message:
      response.status === 404
        ? "API não encontrada no servidor. Verifique o deploy do backend na Vercel."
        : "Não foi possível concluir a solicitação.",
  }));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível concluir a solicitação.");
  }

  return data as T;
}

export const authStorage = {
  get(): Session | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },
  set(session: Session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};

export async function registerUser(name: string, email: string, password: string): Promise<Session> {
  const data = await request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return data;
}

export async function loginUser(email: string, password: string): Promise<Session> {
  const data = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data;
}

export async function loginWithGoogle(credential: string): Promise<Session> {
  const data = await request<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  return data;
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const data = await request<{ user: User }>("/api/auth/me", {}, token);
  return data.user;
}

export async function fetchHighlights(token: string, docId: string): Promise<Highlight[]> {
  const data = await request<{ highlights: Highlight[] }>(
    `/api/annotations/${encodeURIComponent(docId)}`,
    {},
    token,
  );
  return data.highlights;
}

export async function saveHighlights(token: string, docId: string, highlights: Highlight[]): Promise<void> {
  await request<{ ok: boolean }>(
    `/api/annotations/${encodeURIComponent(docId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ highlights }),
    },
    token,
  );
}

export async function fetchAiConversations(token: string): Promise<AiConversation[]> {
  const data = await request<{ conversations: AiConversation[] }>("/api/ai/conversations", {}, token);
  return data.conversations;
}

export async function createAiConversation(token: string, title = "Nova conversa"): Promise<AiConversation> {
  const data = await request<{ conversation: AiConversation }>(
    "/api/ai/conversations",
    {
      method: "POST",
      body: JSON.stringify({ title }),
    },
    token,
  );
  return data.conversation;
}

export async function fetchAiMessages(token: string, conversationId: number): Promise<AiMessage[]> {
  const data = await request<{ messages: AiMessage[] }>(
    `/api/ai/conversations/${conversationId}/messages`,
    {},
    token,
  );
  return data.messages;
}

export async function sendAiMessage(
  token: string,
  content: string,
  docId: string,
  conversationId?: number,
): Promise<{ conversationId: number; message: AiMessage }> {
  return request<{ conversationId: number; message: AiMessage }>(
    "/api/ai/chat",
    {
      method: "POST",
      body: JSON.stringify({ content, docId, conversationId }),
    },
    token,
  );
}

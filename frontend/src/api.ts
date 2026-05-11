const BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Preference {
  id: number;
  name: string;
  leboncoin_location: string;
  seloger_location: string;
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
  rooms_max: number | null;
  active: number;
}

export interface Template {
  id: number;
  name: string;
  body: string;
  is_default: number;
}

export interface Listing {
  id: number;
  platform: string;
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  city: string | null;
  discovered_at: string;
  message_status: string | null;
}

export interface Stats {
  totalListings: number;
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  pendingMessages: number;
  listingsPerDay: Array<{ day: string; count: number }>;
  messagesPerDay: Array<{ day: string; count: number }>;
}

export interface Session {
  id: number;
  platform: string;
  last_valid_at: string | null;
  status: string;
}

export const api = {
  preferences: {
    list: () => fetchJson<Preference[]>("/preferences"),
    create: (data: Omit<Preference, "id" | "active">) => fetchJson<Preference>("/preferences", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Preference>) => fetchJson<void>(`/preferences/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => fetchJson<void>(`/preferences/${id}`, { method: "DELETE" }),
  },
  templates: {
    list: () => fetchJson<Template[]>("/templates"),
    create: (data: Omit<Template, "id">) => fetchJson<Template>("/templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Template>) => fetchJson<void>(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => fetchJson<void>(`/templates/${id}`, { method: "DELETE" }),
  },
  listings: {
    list: (params: { limit?: number; offset?: number; platform?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      if (params.platform) qs.set("platform", params.platform);
      return fetchJson<{ listings: Listing[]; total: number }>(`/listings?${qs}`);
    },
    sendRecent: (days = 15) => fetchJson<{ scraped: number; queued: number; listings: number }>("/listings/send-recent", { method: "POST", body: JSON.stringify({ days }) }),
  },
  stats: () => fetchJson<Stats>("/stats"),
  sessions: {
    list: () => fetchJson<Session[]>("/sessions"),
    login: (platform: string) => fetchJson<{ message: string }>(`/sessions/${platform}/login`, { method: "POST" }),
  },
};

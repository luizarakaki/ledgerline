/* Thin client for the Ledgerline API. All calls are cookie-authenticated. */
import type { ConsolidationResult, DatasetSummary, SlotKey, User } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "same-origin",
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export interface UploadFile {
  filename: string;
  text: string;
}

export const api = {
  // ---- auth ----
  signUp(data: { name: string; email: string; password: string }) {
    return request<{ user: User }>("/auth/signup", { method: "POST", body: JSON.stringify(data) });
  },
  signIn(data: { email: string; password: string }) {
    return request<{ user: User }>("/auth/signin", { method: "POST", body: JSON.stringify(data) });
  },
  signOut() {
    return request<{ ok: true }>("/auth/signout", { method: "POST" });
  },
  me() {
    return request<{ user: User }>("/auth/me");
  },

  // ---- datasets ----
  listDatasets() {
    return request<{ datasets: DatasetSummary[] }>("/datasets");
  },
  createDataset(files: Partial<Record<SlotKey, UploadFile>>, name?: string) {
    return request<{ dataset: DatasetSummary }>("/datasets", {
      method: "POST",
      body: JSON.stringify({ name, files }),
    });
  },
  getDataset(id: string) {
    return request<{ dataset: DatasetSummary }>(`/datasets/${id}`);
  },
  consolidate(id: string) {
    return request<{ dataset: { id: string; name: string; createdAt: string }; result: ConsolidationResult }>(
      `/datasets/${id}/consolidation`,
    );
  },
  deleteDataset(id: string) {
    return request<{ ok: true }>(`/datasets/${id}`, { method: "DELETE" });
  },
};

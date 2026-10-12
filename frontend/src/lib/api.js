// Thin fetch wrapper. All paths are relative (/api/...) so the same build works
// behind the Vite dev proxy, the Compose Nginx proxy and the Kubernetes Ingress.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function describe(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  // FastAPI validation errors: [{loc: ["body", "quantity"], msg: "..."}]
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${d.loc?.filter((p) => p !== "body").join(".") || "field"}: ${d.msg}`)
      .join("; ");
  }
  return JSON.stringify(detail);
}

async function request(path, { method = "GET", body, params } = {}) {
  const query = params
    ? "?" +
      new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
      )
    : "";
  let response;
  try {
    response = await fetch(`${path}${query === "?" ? "" : query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the Pantrix API. Is the backend running?", 0);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      describe(data?.detail) ?? `Request failed (${response.status})`,
      response.status,
    );
  }
  return data;
}

export const api = {
  listItems: (params) => request("/api/items", { params }),
  stats: () => request("/api/items/stats"),
  createItem: (body) => request("/api/items", { method: "POST", body }),
  updateItem: (id, body) => request(`/api/items/${id}`, { method: "PUT", body }),
  deleteItem: (id) => request(`/api/items/${id}`, { method: "DELETE" }),

  listDonors: () => request("/api/donors"),
  createDonor: (body) => request("/api/donors", { method: "POST", body }),
  updateDonor: (id, body) => request(`/api/donors/${id}`, { method: "PUT", body }),
  deleteDonor: (id) => request(`/api/donors/${id}`, { method: "DELETE" }),

  listDistributions: (limit = 50) => request("/api/distributions", { params: { limit } }),
  distribute: (body) => request("/api/distributions", { method: "POST", body }),
};

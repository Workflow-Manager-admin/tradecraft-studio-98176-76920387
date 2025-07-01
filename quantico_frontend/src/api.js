//
// API client for Quantico Frontend
// Handles REST API requests and error management per backend specification.
//
const BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

// Helper for unified fetch with error handling
// PUBLIC_INTERFACE
async function apiFetch(path, { method = "GET", data, token, params, headers, isForm = false } = {}) {
  let url = BASE_URL + path;
  if (params && typeof params === "object") {
    const qs = new URLSearchParams(params).toString();
    url += "?" + qs;
  }
  const opts = {
    method,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(data ? { body: isForm ? data : JSON.stringify(data) } : {}),
  };

  const resp = await fetch(url, opts);
  const text = await resp.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!resp.ok) {
    const message = (json && json.detail) || resp.statusText || "API Error";
    throw { message, status: resp.status, detail: json };
  }
  return json;
}

export default apiFetch;

// Thin wrapper around fetch for our own API. The login cookie is HttpOnly, so no token is ever
// handled by JavaScript; the custom header below is the CSRF check the server expects.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, body) {
  const options = { method, credentials: "same-origin", cache: "no-store", headers: { "X-Requested-With": "meleri" } };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, options);
  } catch (e) {
    return { ok: false, status: 0, data: { error: "network" } };
  }
  let data = {};
  try {
    data = await response.json();
  } catch (e) {}
  // Session ended (expired, or the admin removed this account): go back to the login screen.
  if (response.status === 401 && path !== "/api/session" && onUnauthorized) onUnauthorized();
  return { ok: response.ok, status: response.status, data };
}

export const api = {
  session: () => request("GET", "/api/session"),
  login: (idToken) => request("POST", "/api/session", { idToken }),
  logout: () => request("DELETE", "/api/session"),
  stats: () => request("GET", "/api/stats"),
  admin: {
    list: () => request("GET", "/api/admin-emails"),
    add: (email) => request("POST", "/api/admin-emails", { email }),
    remove: (email) => request("DELETE", "/api/admin-emails?email=" + encodeURIComponent(email))
  }
};

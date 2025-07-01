import React, { useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

// PUBLIC_INTERFACE
export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Always require backend validation for login, and display error if not valid
  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // For most FastAPI/JWT/Python backends, login expects 'username' and 'password'
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        data: { username: email, password }
      });

      // Only successful backend response with token and user enables login
      if (resp && resp.access_token && resp.user) {
        login(resp.access_token, resp.user);
      } else {
        setError("Unexpected authentication response. Please contact support.");
      }
    } catch (err) {
      // Enforce: If backend does not confirm, do not login!
      if (err && (err.status === 401 || (err.message && err.message.toLowerCase().includes("invalid")))) {
        setError("Invalid email or password.");
      } else if (err && err.message) {
        setError(err.message);
      } else {
        setError("Unable to login. Please try again later.");
      }
    }
    setLoading(false);
  }

  function onGoogleLogin() {
    window.location.href = (process.env.REACT_APP_BACKEND_URL || "http://localhost:3001") + "/auth/google/login";
  }

  return (
    <section className="login">
      <h2>Sign in to Quantico</h2>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          value={email}
          placeholder="Email"
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          placeholder="Password"
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <button className="btn btn-google" onClick={onGoogleLogin} disabled={loading}>
        Sign in with Google
      </button>
      {error && <div className="error" role="alert">{error}</div>}
    </section>
  );
}

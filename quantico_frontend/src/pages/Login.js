import React, { useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

/**
 * Login page component for Quantico frontend.
 * Handles email/password login, invokes backend, blocks bypass,
 * provides clear and secure messaging, and performs validation.
 *
 * - Ensures ONLY backend-originating token/user enables login
 * - Handles all backend error cases with messages
 * - Prevents login-button bypass or client-side fake success
 * - Performs both field-level/form-level validation
 * - Redirect is managed by parent Route (see App.js)
 */

// PUBLIC_INTERFACE
export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formTouched, setFormTouched] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Util: simple email format check
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }
  // Util: enforce minimum password length (edit as policy changes)
  function isValidPassword(val) {
    return typeof val === "string" && val.length >= 6;
  }

  // Handle form submit
  async function onSubmit(e) {
    e.preventDefault();
    setFormTouched(true);
    setError(null);

    if (!isValidEmail(email) || !isValidPassword(password)) {
      setError("Please provide a valid email and a password (min 6 characters).");
      return;
    }

    setLoading(true);

    try {
      // Prefer FastAPI spec naming: username/password
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        data: { username: email, password }
      });

      // Only allow login if backend confirms identity and sends BOTH:
      // access_token (jwt or similar) AND user object.
      if (resp && resp.access_token && resp.user) {
        login(resp.access_token, resp.user);
        setError(null); // Defensive
        // Redirect is handled by App.js Route (see Navigate after login)
      } else {
        // Unexpected response structure, block login
        setError("Login response is malformed. Please contact support.");
      }
    } catch (err) {
      // Parse FastAPI/REST error semantics and display user-friendly error
      let message = "Login failed. Please try again.";
      if (err && typeof err === "object") {
        if (err.status === 401 || (err.message && err.message.toLowerCase().includes("invalid"))) {
          message = "Invalid email or password.";
        } else if (err.status === 429) {
          message = "Too many login attempts. Please wait and try again.";
        } else if (err.status === 0 || err.status === 502 || err.status === 503) {
          message = "Cannot reach authentication server. Check your network.";
        } else if (err.message) {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Always initiate only backend OAuth (no client-side bypass possible)
  function onGoogleLogin() {
    // Use centralized config for backend URL
    // Import here if not already imported to avoid cyclic dependency in SSR contexts
    // eslint-disable-next-line no-restricted-imports
    const { BACKEND_URL } = require("../config");
    window.location.href = BACKEND_URL + "/auth/google/login";
  }

  // "Show password" toggle state
  const [showPassword, setShowPassword] = useState(false);

  // Validation helpers for touched/blur feedback (UX improvements)
  const emailInvalid = formTouched && !isValidEmail(email);
  const passwordInvalid = formTouched && !isValidPassword(password);

  return (
    <section className="login" aria-label="Login form">
      <h2>Sign in to Quantico</h2>
      <form onSubmit={onSubmit} noValidate aria-describedby={error ? "login-error" : undefined}>
        <label htmlFor="login-email" style={{ display: "none" }}>Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          placeholder="Email"
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="username"
          disabled={loading}
          aria-invalid={!!emailInvalid}
          onBlur={() => setFormTouched(true)}
        />
        {emailInvalid && (
          <div className="error" role="alert" aria-live="assertive">Please enter a valid email address.</div>
        )}
        <label htmlFor="login-password" style={{ display: "none" }}>Password</label>
        <div style={{ position: "relative" }}>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            placeholder="Password"
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
            disabled={loading}
            aria-invalid={!!passwordInvalid}
            onBlur={() => setFormTouched(true)}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(v => !v)}
            style={{
              position: "absolute",
              right: "0.5rem",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888"
            }}
            tabIndex={-1}
            disabled={loading}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
        {passwordInvalid && (
          <div className="error" role="alert" aria-live="assertive">
            Password must be at least 6 characters.
          </div>
        )}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <button className="btn btn-google" onClick={onGoogleLogin} disabled={loading}>
        Sign in with Google
      </button>
      {error && (
        <div className="error" id="login-error" role="alert" aria-live="assertive">{error}</div>
      )}
    </section>
  );
}

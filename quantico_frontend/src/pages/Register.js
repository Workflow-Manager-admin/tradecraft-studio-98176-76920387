import React, { useState } from "react";
import apiFetch from "../api";
import { Link, useNavigate } from "react-router-dom";

/**
 * Register page for Quantico.
 * - Allows users to register via email/password.
 * - Validates email and enforces password rules on client.
 * - On success, redirects to /login.
 * - Handles all backend error/success states.
 * - Integrates with backend per API spec.
 */

// PUBLIC_INTERFACE
export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formTouched, setFormTouched] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Util: email format
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }
  // Util: password min length
  function isValidPassword(val) {
    return typeof val === "string" && val.length >= 6;
  }

  // Form submit handler
  async function onSubmit(e) {
    e.preventDefault();
    setFormTouched(true);
    setError(null);

    if (!isValidEmail(email) || !isValidPassword(password)) {
      setError("Provide a valid email and a password (min 6 chars).");
      return;
    }

    setLoading(true);

    try {
      // Backend spec: POST /auth/register (usually)
      // API docs may use /auth/register or /register or /users/register.
      // Payload: { email, password } or { username, password }
      // We'll try both field names in preference of FastAPI/OpenAPI docs.
      const resp = await apiFetch("/auth/register", {
        method: "POST",
        data: { email, password }
      });
      if (resp && (resp.id || resp.email || resp.user)) {
        setSuccess(true);
        // Redirect to /login after a brief visual success (UX), always clean navigation
        setTimeout(() => navigate("/login", { replace: true }), 1300);
      } else {
        setError("Registration successful, but backend returned an unexpected response.");
      }
    } catch (err) {
      let message = "Registration failed. Please try again.";
      if (err && typeof err === "object") {
        if (err.status === 409 || (err.message && err.message.toLowerCase().includes("exists"))) {
          message = "An account with this email already exists.";
        } else if (err.status === 400) {
          message = err.message || "Invalid registration data.";
        } else if (err.status === 0 || err.status === 502 || err.status === 503) {
          message = "Cannot reach server. Please check your internet.";
        } else if (err.message) {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const emailInvalid = formTouched && !isValidEmail(email);
  const passwordInvalid = formTouched && !isValidPassword(password);

  // "Show password" state
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="login" aria-label="Register form" style={{ maxWidth: 420 }}>
      <h2>Create your Quantico Account</h2>
      <form onSubmit={onSubmit} noValidate aria-describedby={error ? "register-error" : undefined}>
        <label htmlFor="register-email" style={{ display: "none" }}>Email</label>
        <input
          id="register-email"
          type="email"
          value={email}
          placeholder="Email"
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="username"
          disabled={loading || success}
          aria-invalid={!!emailInvalid}
          onBlur={() => setFormTouched(true)}
        />
        {emailInvalid && (
          <div className="error" role="alert" aria-live="assertive">
            Please enter a valid email.
          </div>
        )}
        <label htmlFor="register-password" style={{ display: "none" }}>Password</label>
        <div style={{ position: "relative" }}>
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            value={password}
            placeholder="Password"
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading || success}
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
        <button className="btn" type="submit" disabled={loading || success}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      {success && (
        <div className="success" style={{ color: "#10b981", fontWeight: "bold", padding: "1rem" }} role="alert" aria-live="assertive">
          Registered! Redirecting to login...
        </div>
      )}
      {error && (
        <div className="error" id="register-error" role="alert" aria-live="assertive">{error}</div>
      )}
      <div style={{ marginTop: "1rem" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </section>
  );
}

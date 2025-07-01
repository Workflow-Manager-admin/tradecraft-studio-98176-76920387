import React, { useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

// PUBLIC_INTERFACE
export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      setError(null);
      // Most FastAPI auth endpoints expect username, not email, and 'password' fields.
      // Try payload with 'username' instead of 'email' if backend requires it.
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        data: { username: email, password } // fix to match common FastAPI backend expectations
      });
      // On success: resp.access_token & resp.user must exist
      if (resp && resp.access_token && resp.user) {
        login(resp.access_token, resp.user);
      } else {
        setError("Unexpected response. Please contact support.");
      }
    } catch (err) {
      if (err && (err.status === 401 || (err.message && err.message.toLowerCase().includes("invalid")))) {
        setError("Invalid email or password.");
      } else if (err && err.message) {
        setError(err.message); // show any other API error messages that aren't credentials related
      } else {
        setError("Unable to login. Please try again later.");
      }
    }
  }

  function onGoogleLogin() {
    window.location.href = process.env.REACT_APP_BACKEND_URL + "/auth/google/login";
  }

  return (
    <section className="login">
      <h2>Sign in to Quantico</h2>
      <form onSubmit={onSubmit}>
        <input
          type="email" value={email} placeholder="Email"
          onChange={e => setEmail(e.target.value)} required
        />
        <input
          type="password" value={password} placeholder="Password"
          onChange={e => setPassword(e.target.value)} required
        />
        <button className="btn" type="submit">Login</button>
      </form>
      <button className="btn btn-google" onClick={onGoogleLogin}>
        Sign in with Google
      </button>
      {error && <div className="error">{error}</div>}
    </section>
  );
}

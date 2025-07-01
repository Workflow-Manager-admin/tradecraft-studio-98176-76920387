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
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        data: { email, password }
      });
      login(resp.access_token, resp.user);
    } catch (err) {
      setError("Invalid login.");
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

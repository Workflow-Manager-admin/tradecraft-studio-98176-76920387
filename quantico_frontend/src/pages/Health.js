import React, { useEffect, useState } from "react";
import apiFetch from "../api";

// PUBLIC_INTERFACE
export default function Health() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch("/health");
        setHealth(data);
      } catch {
        setError("Backend unavailable.");
      }
    }
    load();
  }, []);
  return (
    <section className="health">
      <h2>Platform Status</h2>
      {error && <div className="error">{error}</div>}
      {health && (
        <div>
          <div>Status: {health.status}</div>
          <div>Version: {health.version}</div>
        </div>
      )}
    </section>
  );
}

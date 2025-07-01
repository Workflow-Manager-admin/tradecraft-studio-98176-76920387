import React, { useState, useEffect } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

// PUBLIC_INTERFACE
export default function Builder() {
  const { token } = useAuth();
  const [strategies, setStrategies] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch("/strategies", { token });
        setStrategies(data || []);
      } catch (e) {
        setError("Failed to load strategies.");
      }
    }
    load();
  }, [token]);

  // Drag and drop builder stub
  return (
    <section className="builder">
      <h2>Strategy Builder</h2>
      {error && <div className="error">{error}</div>}
      <div className="builder-list">
        {strategies.map(s => (
          <div key={s.id} className="builder-strategy-card">
            <div className="builder-strategy-title">{s.name}</div>
            <div>{s.description || "No description."}</div>
            {/* TODO: trigger edit, visualize, delete, etc. */}
          </div>
        ))}
      </div>
      {/* TODO: Drag-and-drop UI for indicator block design */}
    </section>
  );
}

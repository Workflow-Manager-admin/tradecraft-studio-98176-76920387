import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

// PUBLIC_INTERFACE
export default function Portfolio() {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch("/portfolio", { token });
        setItems(data || []);
      } catch {
        setError("Failed to load portfolio.");
      }
    }
    load();
  }, [token]);

  return (
    <section className="portfolio">
      <h2>Your Portfolio</h2>
      {error && <div className="error">{error}</div>}
      <div className="portfolio-table">
        {items.map((item) => (
          <div key={item.id} className="portfolio-strategy-card">
            <div className="portfolio-strategy-title">{item.name}</div>
            <div>ROI: {item.roi}</div>
            <div>Status: {item.status}</div>
            <div>Trades: {item.trades || 0}</div>
            {/* Expand with metrics from backend */}
          </div>
        ))}
      </div>
    </section>
  );
}

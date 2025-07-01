import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

export default function Trading() {
  const { token } = useAuth();
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch("/papertrading/positions", { token });
        setPositions(data || []);
      } catch {
        setError("Could not load trading data.");
      }
    }
    load();
  }, [token]);

  return (
    <section className="trading">
      <h2>Paper Trading</h2>
      {error && <div className="error">{error}</div>}
      <div className="trading-table">
        {positions.map((p) => (
          <div key={p.id} className="trading-position-card">
            <div>{p.symbol}: {p.shares} @ {p.avg_price}</div>
            <div>P&L: {p.pnl}</div>
            {/* More data as per backend */}
          </div>
        ))}
      </div>
    </section>
  );
}

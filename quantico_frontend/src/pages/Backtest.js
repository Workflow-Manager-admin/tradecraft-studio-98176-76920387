import React, { useState, useEffect } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

export default function Backtest() {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch("/backtest/results", { token });
        setResults(data || []);
      } catch {
        setError("Failed to load backtests.");
      }
    }
    load();
  }, [token]);

  return (
    <section className="backtest">
      <h2>Backtest Results</h2>
      {error && <div className="error">{error}</div>}
      <div className="backtest-table">
        {results.map(r => (
          <div key={r.id} className="backtest-result-card">
            <div>Strategy: {r.strategy_name}</div>
            <div>ROI: {r.roi || "--"}%</div>
            <div>Sharpe: {r.sharpe || "--"}</div>
            {/* Chart slot - will use TradingView or Recharts */}
            <div>Chart: [candlestick chart placeholder]</div>
          </div>
        ))}
      </div>
    </section>
  );
}

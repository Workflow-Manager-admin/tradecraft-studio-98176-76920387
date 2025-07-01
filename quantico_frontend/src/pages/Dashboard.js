import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

export default function Dashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch("/dashboard", { token });
        setStats(data);
      } catch {
        setStats(null);
      }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return <div>Loading...</div>;
  if (!stats) return <div className="error">Could not load stats.</div>;
  return (
    <section className="dashboard">
      <h2>Welcome, {user.name || user.email}</h2>
      <div className="stats-grid">
        <div className="stat-card">Profits: {stats.profits}</div>
        <div className="stat-card">Sharpe: {stats.sharpe}</div>
        <div className="stat-card">Drawdown: {stats.drawdown}%</div>
        <div className="stat-card">Win Rate: {stats.win_rate}%</div>
      </div>
      {/* add more metrics as per backend API */}
    </section>
  );
}

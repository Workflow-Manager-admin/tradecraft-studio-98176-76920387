import React, { useEffect, useState, useCallback } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Interval for refreshing dashboard in ms
const REFRESH_MS = 15000;

// Helper to compute simple P&L and stats from trades and portfolio
function calculateMetrics({ portfolio, trades }) {
  let totalCost = 0,
    totalMarket = 0,
    openPositions = [],
    returns = [],
    pnl = 0,
    roi = 0,
    tradesCount = (trades && trades.length) || 0;

  const assetMap = {};
  if (Array.isArray(portfolio)) {
    portfolio.forEach((entry) => {
      assetMap[entry.asset] = entry;
      totalCost += (entry.cost_basis ?? 0) * (entry.quantity ?? 0);
    });
  }
  if (Array.isArray(trades)) {
    trades.forEach((t) => {
      // PaperTrade model. For open position, find the latest buy for each asset
      if (!openPositions.some((p) => p.asset === t.asset)) {
        openPositions.push({
          asset: t.asset,
          side: t.side,
          qty: t.qty,
          price: t.price,
          timestamp: t.timestamp,
        });
      }
      // For P&L timeline
      returns.push({
        name: t.timestamp && t.timestamp.slice(0, 19).replace("T", " "),
        pnl: t.qty && t.price ? t.qty * t.price : 0,
      });
    });
    pnl = returns.reduce((sum, r) => sum + r.pnl, 0);
    roi = totalCost ? ((pnl / totalCost) * 100).toFixed(2) : 0;
  }
  return {
    totalCost,
    pnl,
    roi,
    tradesCount,
    openPositions,
    returns,
  };
}

// PUBLIC_INTERFACE
export default function Dashboard() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Snapshot data
  const [portfolio, setPortfolio] = useState([]);
  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);

  // Single fetch for all metrics; re-run on interval
  const fetchAllStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch primary: portfolio, trades, strategies
      const [portfolioResp, tradesResp, strategiesResp] = await Promise.all([
        apiFetch("/portfolio", { token }),
        apiFetch("/trades", { token }),
        apiFetch("/strategies", { token }),
      ]);
      setPortfolio(Array.isArray(portfolioResp) ? portfolioResp : []);
      setTrades(Array.isArray(tradesResp) ? tradesResp : []);
      setStrategies(Array.isArray(strategiesResp) ? strategiesResp : []);
    } catch (e) {
      setError(
        e?.message ||
          "Could not load dashboard stats. Check your connection or login."
      );
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchAllStats();
    // Periodic refresh
    const interval = setInterval(fetchAllStats, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchAllStats]);

  // Metrics for cards & charts
  const { totalCost, pnl, roi, tradesCount, openPositions, returns } =
    calculateMetrics({ portfolio, trades });

  if (loading)
    return (
      <section className="dashboard">
        <h2>Welcome, {user?.full_name || user?.email || "User"}</h2>
        <div>Loading realtime stats...</div>
      </section>
    );
  if (error)
    return (
      <section className="dashboard">
        <h2>Dashboard</h2>
        <div className="error">{error}</div>
      </section>
    );

  return (
    <section className="dashboard">
      <h2>{`Welcome, ${user?.full_name || user?.email || "User"}`}</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ fontWeight: 600 }}>Account Value</div>
          <div style={{ fontSize: "1.25rem" }}>
            $
            {(
              (portfolio
                ? portfolio.reduce(
                    (sum, e) =>
                      sum + (e.quantity ?? 0) * (e.cost_basis ?? 0),
                    0
                  )
                : 0
              ).toLocaleString() || "0"
            )}
          </div>
          <div className="stat-desc">Portfolio Cost Basis</div>
        </div>
        <div className="stat-card">
          <div style={{ fontWeight: 600 }}>Realized P&amp;L</div>
          <div
            style={{
              fontSize: "1.25rem",
              color:
                Number(pnl) > 0
                  ? "#10b981"
                  : Number(pnl) < 0
                  ? "#ef4444"
                  : "inherit",
            }}
          >
            ${pnl ? pnl.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}
          </div>
          <div className="stat-desc">Since inception</div>
        </div>
        <div className="stat-card">
          <div style={{ fontWeight: 600 }}>ROI</div>
          <div style={{ fontSize: "1.25rem" }}>{roi}%</div>
          <div className="stat-desc">Return on Investment</div>
        </div>
        <div className="stat-card">
          <div style={{ fontWeight: 600 }}>Total Trades</div>
          <div style={{ fontSize: "1.25rem" }}>{tradesCount}</div>
          <div className="stat-desc">All opened & closed</div>
        </div>
      </div>

      <div style={{ margin: "1.8rem 0" }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
          Equity Curve / P&amp;L Timeline
        </div>
        <div style={{ width: "100%", minHeight: 220, background: "none" }}>
          <ResponsiveContainer width="100%" minHeight={160} height={220}>
            <AreaChart data={returns} margin={{ left: 0, right: 0, top: 6, bottom: 6 }}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="90%" stopColor="#10b981" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={false} />
              <YAxis />
              <Tooltip />
              <Area
                animationDuration={400}
                type="monotone"
                dataKey="pnl"
                stroke="#10b981"
                fill="url(#colorPnl)"
                strokeWidth={2}
                dot={false}
              />
              <CartesianGrid opacity={0.07} vertical={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 16, margin: "1rem 0 0.5rem" }}>
          Open Positions
        </div>
        <div className="stats-grid" style={{ flexWrap: "wrap" }}>
          {openPositions.length === 0 && (
            <div style={{ color: "#888" }}>No open positions. All trades closed.</div>
          )}
          {openPositions.map((pos) => (
            <div key={pos.asset + pos.timestamp} className="stat-card">
              <div style={{ fontWeight: 600 }}>{pos.asset}</div>
              <div>
                {pos.qty} {pos.asset} @ ${pos.price} ({pos.side})
              </div>
              <div className="stat-desc">
                Opened: {new Date(pos.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 16, margin: "2rem 0 0.5rem" }}>
          Strategies
        </div>
        <div className="stats-grid" style={{ flexWrap: "wrap" }}>
          {strategies.length === 0 && (
            <div style={{ color: "#888" }}>No strategies found. Build one in the Builder.</div>
          )}
          {strategies.map((s) => (
            <div key={s.id} className="stat-card">
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="stat-desc" style={{ color: "#888", fontSize: "1em" }}>
                Created: {new Date(s.created_at).toLocaleDateString()}
              </div>
              <div>
                <span style={{ color: "#10b981", fontWeight: 500 }}>#{s.id}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {s.description ? s.description : "No description."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

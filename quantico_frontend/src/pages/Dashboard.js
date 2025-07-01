import React, { useEffect, useState, useCallback, useRef } from "react";
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

// Real-time polling interval (ms)
const REFRESH_MS = 8000;

// PUBLIC_INTERFACE
/**
 * Dashboard page with real-time P&L, portfolio, open positions,
 * key statistics, and a visually engaging timeline of account events.
 * Polls backend every REFRESH_MS and auto-refreshes the timeline.
 */
export default function Dashboard() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Key state: Portfolio, trades, strategies, and timeline events
  const [portfolio, setPortfolio] = useState([]);
  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState(null);

  // Allow for proper cleanup of intervals
  const activeInterval = useRef(null);
  const timelineInterval = useRef(null);

  // Fetch metrics: portfolio, trades, strategies
  const fetchAllStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

  // Fetch timeline/history/events from backend
  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      // Try possible endpoints for timeline/history/events. Prefer /trades + /strategies + /portfolio synthesis if no history endpoint.
      let eventLog = [];
      // Backend may have /event/history or similar; if not, synthesize
      try {
        // Attempt known variants (customize if backend has e.g. /timeline or /history or /events)
        eventLog = await apiFetch("/event/history", { token });
      } catch {
        // Synthesize: combine trades, strategies, and portfolio events, sorted by timestamp/created_at
        let tradeEvents = [];
        let strategyEvents = [];
        let portfolioEvents = [];

        try {
          const tradesData = await apiFetch("/trades", { token });
          tradeEvents =
            Array.isArray(tradesData)
              ? tradesData.map((t) => ({
                  type: "trade",
                  time: t.timestamp,
                  title: `Trade: ${t.side} ${t.qty} ${t.asset}`,
                  details: `@ $${t.price} (strategy ${t.strategy_id ?? ""})`,
                }))
              : [];
        } catch {}
        try {
          const strategiesData = await apiFetch("/strategies", { token });
          strategyEvents =
            Array.isArray(strategiesData)
              ? strategiesData.map((s) => ({
                  type: "strategy",
                  time: s.created_at || s.updated_at,
                  title: `Strategy: ${s.name}`,
                  details:
                    "Strategy updated" +
                    (s.description ? ` – ${s.description}` : ""),
                }))
              : [];
        } catch {}
        // No explicit portfolio event API? Add last update + open/close asset actions
        try {
          const portfolioData = await apiFetch("/portfolio", { token });
          portfolioEvents =
            Array.isArray(portfolioData)
              ? portfolioData.map((p) => ({
                  type: "portfolio",
                  time: p.updated_at || p.created_at || null,
                  title: `Portfolio: ${p.asset}`,
                  details: `Holding ${p.quantity} @ avg $${p.cost_basis}`,
                }))
              : [];
        } catch {}
        eventLog = [...tradeEvents, ...strategyEvents, ...portfolioEvents].filter(
          (e) => e.time
        );
        // Sort descending
        eventLog.sort((a, b) =>
          b.time && a.time
            ? new Date(b.time) - new Date(a.time)
            : 0
        );
      }
      setTimeline(eventLog.slice(0, 24));
    } catch (e) {
      setTimelineError(
        e?.message || "Could not load timeline/event history from backend"
      );
      setTimeline([]);
    }
    setTimelineLoading(false);
  }, [token]);

  // Setup polling for dashboard stats
  useEffect(() => {
    fetchAllStats();
    activeInterval.current = setInterval(fetchAllStats, REFRESH_MS);
    return () => {
      if (activeInterval.current) clearInterval(activeInterval.current);
    };
  }, [fetchAllStats]);

  // Setup polling for timeline (shorter refresh interval)
  useEffect(() => {
    fetchTimeline();
    timelineInterval.current = setInterval(fetchTimeline, Math.max(REFRESH_MS, 10000));
    return () => {
      if (timelineInterval.current) clearInterval(timelineInterval.current);
    };
  }, [fetchTimeline]);

  // Compute dashboard stats from data
  const {
    totalCost,
    pnl,
    roi,
    tradesCount,
    openPositions,
    returns,
  } = calculateMetrics({ portfolio, trades });

  if (loading)
    return (
      <section className="dashboard">
        <h2>Welcome, {user?.full_name || user?.email || "User"}</h2>
        <div>Loading real-time stats...</div>
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
            {(portfolio
              ? portfolio.reduce(
                  (sum, e) =>
                    sum + (e.quantity ?? 0) * (e.cost_basis ?? 0),
                  0
                )
              : 0
            ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
          Strategy Snapshots
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

      {/* Timeline, with auto-refresh and clear loading/error handling */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 17, margin: "2.1rem 0 1rem", letterSpacing: ".01em" }}>
          Recent Account Activity & Events
        </div>
        <Timeline
          timeline={timeline}
          loading={timelineLoading}
          error={timelineError}
        />
      </div>

      <style>{`
        .timeline {
          margin: 1rem 0 2rem 0;
          padding: 0;
          list-style: none;
          max-height: 340px;
          overflow-y: auto;
        }
        .timeline-event {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-left: 3px solid var(--border-color, #e0e7ef);
          padding: 0.8em 0 0.8em 18px;
          position: relative;
        }
        .timeline-event:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 1px;
          top: 0;
          bottom: -0.8em;
          width: 3px;
          background: var(--border-color, #e0e7ef);
        }
        .timeline-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          margin-left: -27px;
          margin-top: 5px;
          background: #10b981;
          border: 2px solid var(--border-color, #e0e7ef);
          box-shadow: 0 1px 3px rgba(16,185,129,0.07);
        }
        .timeline-event-content {
          flex: 1;
          min-width: 0;
        }
        .timeline-title {
          font-weight: 600;
          margin-bottom: 2px;
          color: var(--text-primary);
        }
        .timeline-details {
          font-size: 0.98em;
          color: #888;
        }
        .timeline-time {
          font-size: 0.96em;
          color: #45a68b;
          margin-top: 3px;
        }
        @media (max-width: 650px) {
          .timeline { max-height: 205px; }
        }
      `}</style>
    </section>
  );
}

// --- Timeline component for events/activity ---
function Timeline({ timeline, loading, error }) {
  if (loading)
    return (
      <div style={{ color: "#888", padding: "1.2rem 1rem" }}>
        Loading recent activity…
      </div>
    );
  if (error)
    return (
      <div className="error" style={{ margin: "1rem 0" }}>
        {error}
      </div>
    );
  if (!timeline || timeline.length === 0)
    return (
      <div style={{ color: "#888", padding: "1.2rem 1rem" }}>
        No recent activity or events found. Your actions will appear here.
      </div>
    );
  return (
    <ul className="timeline">
      {timeline.map((e, i) => (
        <li key={i} className="timeline-event">
          <div className="timeline-dot" style={{background:getDotColor(e.type)}} />
          <div className="timeline-event-content">
            <div className="timeline-title">{e.title || "Event"}</div>
            {e.details && (
              <div className="timeline-details">{e.details}</div>
            )}
            <div className="timeline-time">
              {e.time ? formatEventTime(e.time) : ""}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Utility: Color by event type
function getDotColor(type) {
  if (type === "trade") return "#b97aea";
  if (type === "strategy") return "#3182ce";
  if (type === "portfolio") return "#10b981";
  return "#8888bf";
}

// Utility: Calculate metrics from fetched trades/portfolio for stats
function calculateMetrics({ portfolio, trades }) {
  let totalCost = 0,
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
    // PNL and open/closed logic
    trades.forEach((t) => {
      // Only keep the latest position per asset as "open" (for demo, not true mark-to-market)
      if (!openPositions.some((p) => p.asset === t.asset)) {
        openPositions.push({
          asset: t.asset,
          side: t.side,
          qty: t.qty,
          price: t.price,
          timestamp: t.timestamp,
        });
      }
      // For timeline plotting
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

// Utility: Prettify UTC (timestamp or ISO date)
function formatEventTime(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    // Show only relative recent time for today, otherwise date + time
    const now = new Date();
    if (
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate()
    ) {
      // HH:mm:ss
      return dt.toLocaleTimeString();
    } else {
      // MMM dd, HH:mm
      return (
        dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        ", " +
        dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    }
  } catch {
    return String(d);
  }
}

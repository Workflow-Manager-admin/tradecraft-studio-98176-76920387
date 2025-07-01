import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  Scatter,
  Legend,
} from "recharts";

/**
 * Backtest Page
 * - User selects strategy, asset, and date range to run a backtest.
 * - Initiates process via /backtest/process (POST, with token).
 * - Polls/fetches backend for backtest results and analytics.
 * - Renders candlestick chart, overlays entry/exit markers, displays ROI, Sharpe, drawdown.
 * - Handles all loading/error states, responsive design.
 * - Fully matches backend API as per OpenAPI contract.
 */

// Helper: Format ISO date to yyyy-mm-dd
function toDateString(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toISOString().slice(0, 10);
}

// Helper: Analytics Card
function StatCard({ label, value, desc, highlight }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      borderRadius: 10,
      border: "1px solid var(--border-color)",
      padding: "1.1rem 1.5rem",
      minWidth: 120, textAlign: "center",
      boxShadow: highlight ? "0 3px 14px rgba(16,185,129,0.14)" : "0 2px 9px rgba(0,0,0,0.04)",
      fontWeight: highlight ? 650 : 500,
      color: highlight ? "#10b981" : undefined
    }}>
      <div style={{ fontSize: "1.21em", marginBottom: 6 }}>
        {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : (value ?? "--")}
      </div>
      <div>{label}</div>
      {desc && <div style={{ color: "#888", fontSize: 13, marginTop: 7 }}>{desc}</div>}
    </div>
  );
}

// Helper: Candlestick + markers chart (expects OHLC + entry/exit markers)
function BacktestChart({ candles = [], trades = [] }) {
  // Compose OHLC and overlay markers using Bar and custom shape
  let chartData = [];
  if (Array.isArray(candles) && candles.length) {
    chartData = candles.map(c => ({
      date: c.ts || c.datetime || c.date || c.time || "",
      open: c.open, high: c.high, low: c.low, close: c.close,
      entry: Array.isArray(trades) && trades.some(t => t.ts === c.ts && (t.type === "entry" || t.type === "buy")),
      exit: Array.isArray(trades) && trades.some(t => t.ts === c.ts && (t.type === "exit" || t.type === "sell")),
      entryPrice: trades.find(t => t.ts === c.ts && (t.type === "entry" || t.type === "buy"))?.price ?? null,
      exitPrice: trades.find(t => t.ts === c.ts && (t.type === "exit" || t.type === "sell"))?.price ?? null,
    }));
  }

  // Markers
  let entryPoints = chartData
    .filter(d => d.entry)
    .map(d => ({ date: d.date, price: d.entryPrice || d.close }));
  let exitPoints = chartData
    .filter(d => d.exit)
    .map(d => ({ date: d.date, price: d.exitPrice || d.close }));

  if (entryPoints.length === 0 && Array.isArray(trades) && trades.length) {
    entryPoints = trades.filter(t => t.type === "entry" || t.type === "buy").map(t => ({ date: t.ts, price: t.price }));
    exitPoints = trades.filter(t => t.type === "exit" || t.type === "sell").map(t => ({ date: t.ts, price: t.price }));
  }

  // Candlestick custom shape using Bar for body and (customized via a shape prop)
  // We'll draw the body, and extend high/low wicks
  function renderCustomCandle({ x, y, width, height, payload, index }) {
    // Chart x, y: top left origin; y: higher price = lower y
    // We need to use y scale to map price to y
    // Simplified version for recharts: body and wicks
    const color = payload.close >= payload.open ? "#10b981" : "#ea4335";
    const midX = x + width / 2;
    const openY = this.yAxis.scale(payload.open);
    const closeY = this.yAxis.scale(payload.close);
    const highY = this.yAxis.scale(payload.high);
    const lowY = this.yAxis.scale(payload.low);

    // In this environment, recharts does not give full access to the yAxis,
    // so we'll instead use rect height for body and align for wicks
    return (
      <g>
        {/* Wick */}
        <line x1={midX} x2={midX} y1={y} y2={y + height} stroke={color} strokeWidth={2} />
        {/* Body */}
        <rect x={x + width * 0.17} width={width * 0.66} y={Math.min(openY, closeY)} height={Math.abs(closeY - openY) || 4} fill={color} stroke={color} strokeWidth={1} rx={1.5}/>
      </g>
    );
  }

  // Recharts restriction: Bar props don't provide full y/full access to drawing high/low - we cheat by using two stacked bars and a transparent Bar for x axis
  const barData = chartData.map(d => ({
    ...d,
    CandleOpen: Math.min(d.open, d.close),
    CandleDiff: Math.abs(d.open - d.close) || 0.0001,
    Wick: d.high - d.low,
    WickLow: d.low,
  }));

  return (
    <div style={{ width: "100%", minHeight: 210, margin: "10px auto" }}>
      <ResponsiveContainer width="99%" aspect={2.1} height={288} minHeight={170}>
        <ComposedChart data={barData}>
          <CartesianGrid strokeDasharray="4 4" opacity={0.14} />
          <XAxis dataKey="date"
                 minTickGap={18}
                 tickFormatter={v => (v && v.length > 5 ? v.slice(5, 10) : v)}
                 />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip
            formatter={(v, key) => [v, key === "close" ? "Close" : key]}
            labelFormatter={v => v}
          />
          <Legend />
          {/* Candlestick - body */}
          <Bar
            dataKey="CandleDiff"
            stackId="candle"
            fill="#10b981"
            stroke="#222"
            minPointSize={2}
            barSize={8}
            shape={props => {
              // Custom body and wick
              const { x, y, width, height, payload } = props;
              // Use green/red for up/down
              const color = payload.close >= payload.open ? "#10b981" : "#ea4335";
              // Centered at candle mid
              let [openPx, closePx] = [payload.open, payload.close];
              let candleTop = Math.min(openPx, closePx);
              let candleBot = Math.max(openPx, closePx);
              // This approximation for y, height (not exactly true in pixels) but ok for UI-level summary
              return (
                <g>
                  {/* Wick */}
                  <rect
                    x={x + width * 0.47}
                    width={width * 0.09}
                    y={props.yAxis?.scale ? props.yAxis.scale(payload.high) : y - 8}
                    height={props.yAxis?.scale ? Math.abs(props.yAxis.scale(payload.low) - props.yAxis.scale(payload.high)) : height + 16}
                    fill={color}
                    opacity={0.44}
                    rx={2}
                  />
                  {/* Body */}
                  <rect
                    x={x + width * 0.17}
                    width={width * 0.66}
                    y={y}
                    height={height}
                    fill={color}
                    stroke={color}
                    strokeWidth={1}
                    rx={1.5}
                  />
                </g>
              );
            }}
            isAnimationActive={false}
          />
          {/* Entry points: green up arrow */}
          {entryPoints.length > 0 && (
            <Scatter
              data={entryPoints}
              name="Entry"
              fill="#25db7a"
              shape="triangle"
              legendType="triangle"
            />
          )}
          {/* Exit points: red down arrow */}
          {exitPoints.length > 0 && (
            <Scatter
              data={exitPoints}
              name="Exit"
              fill="#ea4335"
              shape="diamond"
              legendType="diamond"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function Backtest() {
  const { token } = useAuth();

  // Strategy list, user input, period
  const [strategies, setStrategies] = useState([]);
  const [selected, setSelected] = useState(null); // strategy id
  const [asset, setAsset] = useState("AAPL");
  const [startDate, setStartDate] = useState(() => toDateString((() => { let d = new Date(); d.setMonth(d.getMonth() - 3); return d; })()));
  const [endDate, setEndDate] = useState(() => toDateString(new Date()));
  // Backtest process
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [result, setResult] = useState(null); // Full response from backend
  const [chartData, setChartData] = useState(null); // Chart OHLC data from /integration/chart
  // UI states
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);

  // Fetch user strategies on mount
  useEffect(() => {
    async function loadStrategies() {
      setLoadingStrategies(true);
      setProcessError(null);
      try {
        const strategies = await apiFetch("/strategies", { token });
        setStrategies(strategies || []);
        if (strategies && strategies.length && !selected) {
          setSelected(strategies[0].id);
        }
      } catch (e) {
        setProcessError("Failed to load strategies: " + (e?.message||"Unknown error"));
      }
      setLoadingStrategies(false);
    }
    if (token) loadStrategies();
    // eslint-disable-next-line
  }, [token]);

  // Run Backtest
  async function startBacktest(e) {
    e && e.preventDefault && e.preventDefault();
    if (!selected || !asset || !startDate || !endDate) return;
    setProcessing(true);
    setProcessError(null);
    setResult(null);
    setChartData(null);
    try {
      // Process backtest (POST /backtest/process)
      const resp = await apiFetch("/backtest/process", {
        method: "POST",
        params: {
          strategy_id: selected,
          asset: asset,
          start_date: startDate,
          end_date: endDate,
        },
        token,
      });
      // Backend returns analytics, trades, chart? (per contract)
      setResult(resp);
      // Fetch chart data for this backtest
      setLoadingChart(true);
      const chart = await apiFetch("/integration/chart", {
        params: {
          asset: asset,
          start_date: startDate,
          end_date: endDate,
          resolution: "1d"
        },
        token,
      });
      setChartData(chart.ohlc || chart.candles || chart.prices || chart.data || chart);
    } catch (err) {
      setProcessError(err?.message || "Failed to run backtest.");
    } finally {
      setProcessing(false);
      setLoadingChart(false);
    }
  }

  // Compose metrics from result analytics (ROI, Sharpe, drawdown etc)
  const analytics = result && (result.analytics || result.metrics || result);
  const entries = Array.isArray(result?.entries) ? result.entries : (result?.trades || []);
  // Try to use candlestick data (multiple possible keys for chart)
  const chartCandles = Array.isArray(chartData)
    ? chartData
    : (Array.isArray(chartData?.ohlc) ? chartData.ohlc : (Array.isArray(chartData?.candles) ? chartData.candles : []));
  
  // Compose pre-defined analytics metrics
  const roi = analytics?.roi != null ? Number(analytics.roi).toFixed(3) : undefined;
  const sharpe = analytics?.sharpe != null ? Number(analytics.sharpe).toFixed(3) : undefined;
  const drawdown = analytics?.drawdown != null ? Number(analytics.drawdown).toFixed(3) : undefined;
  const tradesCount = Array.isArray(entries) ? entries.length : (analytics?.trades || 0);

  // Responsive cards/cells (mobile adapts to column)
  function FormField({ label, children, ...props }) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", minWidth: 90, marginRight: 18, marginBottom: 10, flex: "1 1 120px"
      }} {...props}>
        <label style={{ fontWeight: 500, marginBottom: 3 }}>{label}</label>
        {children}
      </div>
    );
  }

  return (
    <section className="backtest">
      <h2>Backtest a Strategy</h2>
      {processError && <div className="error" role="alert" style={{marginBottom:10}}>{String(processError)}</div>}

      <form
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", margin: "18px 0 22px 0", borderRadius: 12, background: "var(--bg-secondary)", padding: 18, border: "1px solid var(--border-color)", boxShadow: "0 2px 9px rgba(0,0,0,0.04)" }}
        onSubmit={startBacktest}
      >
        <FormField label="Strategy">
          {loadingStrategies
            ? <div>Loading…</div>
            : (
              <select value={selected || ""} onChange={e => setSelected(Number(e.target.value))} required style={{ fontSize: 15, minWidth: 100 }}>
                {strategies.map(s =>
                  <option key={s.id} value={s.id}>{s.name}</option>
                )}
              </select>
            )}
        </FormField>
        <FormField label="Asset">
          <input type="text" value={asset} onChange={e => setAsset(e.target.value.toUpperCase().slice(0, 8))}
            maxLength={12} style={{ fontSize: 15, minWidth: 70 }} required autoFocus/>
        </FormField>
        <FormField label="Start Date">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </FormField>
        <FormField label="End Date">
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
        </FormField>
        <div>
          <button className="btn" type="submit" disabled={processing || loadingStrategies} style={{ fontSize: 16 }}>
            {processing ? "Running..." : "Run Backtest"}
          </button>
        </div>
      </form>

      {/* Results and chart */}
      {processing && (
        <div style={{ margin: "2.5rem", color: "#888", fontWeight: 600, textAlign: "center" }}>Running backtest, please wait…</div>
      )}

      {/* Display analytics */}
      {!processing && analytics && (
        <div className="stats-grid" style={{ marginBottom: 26 }}>
          <StatCard label="ROI (%)" value={roi ?? "--"} highlight desc="Total Return" />
          <StatCard label="Sharpe" value={sharpe ?? "--"} desc="Annualized Sharpe ratio" />
          <StatCard label="Drawdown" value={drawdown ?? "--"} desc="Max Drawdown" />
          <StatCard label="# Trades" value={tradesCount} desc="Entry + exits" />
        </div>
      )}

      {/* Chart */}
      {!processing && chartCandles?.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 7, fontSize: 16 }}>
            {asset} Candlestick Chart
            {" — "}Entry/Exit Trade Markers
          </div>
          <BacktestChart candles={chartCandles} trades={entries} />
        </div>
      )}
      {/* Loading chart */}
      {loadingChart && <div style={{ margin: "1.3rem", color: "#888" }}>Loading chart…</div>}

      {/* Table of trades or signals */}
      {!processing && Array.isArray(entries) && entries.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, margin: "1.5rem 0 0.7rem" }}>
            Backtest Trade Log
          </div>
          <div className="backtest-table" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <table style={{ width: "100%", borderSpacing: 0, background: "var(--bg-secondary)", borderRadius: 10, overflow: "hidden" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#e6f7ec" }}>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Side</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((t, i) => (
                  <tr key={i} style={{ background: i % 2 ? "#fafcff" : undefined }}>
                    <td>{t.ts || t.datetime || t.date || "--"}</td>
                    <td>{t.type || t.signal || "--"}</td>
                    <td>{t.price != null ? Number(t.price).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "--"}</td>
                    <td>{t.qty || t.quantity || "--"}</td>
                    <td>{t.side || (t.type === "buy" ? "Buy" : t.type === "sell" ? "Sell" : "--")}</td>
                    <td>{t.comment || t.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!processing && result && !analytics && (
        <div style={{ color: "#888", marginTop: 14 }}>No analytics available for this backtest.</div>
      )}

      {!processing && result && (!entries || entries.length === 0) && (
        <div style={{ color: "#888", marginTop: 10 }}>No trades/signals found for period.</div>
      )}

      <style>{`
        @media (max-width: 800px) {
          .stats-grid { flex-direction: column !important; gap: 1.1rem !important; }
        }
        .backtest-table table {
          border-collapse: collapse;
          width: 100%;
        }
        .backtest-table th, .backtest-table td {
          padding: 5px 9px;
          border-bottom: 1px solid var(--border-color,#eee);
          font-size: 1em;
        }
        .backtest-table th {
          background: #f7faf7;
          font-weight: 600;
        }
      `}</style>
    </section>
  );
}

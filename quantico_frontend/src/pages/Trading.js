import React, { useEffect, useState, useRef, useCallback } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

// Auto-refresh interval (ms)
const REFRESH_MS = 8000;

// Helpers for strongly-typed (OpenAPI) trade sides
const SIDE_OPTIONS = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
];

// PUBLIC_INTERFACE
/**
 * The Paper Trading page.
 * - Fetches and auto-refreshes user portfolio (GET /portfolio), open positions (GET /portfolio), and trade logs (GET /trades).
 * - Allows submitting paper buy/sell trades (POST /trades), real backend mutation.
 * - Shows a unified error/loading state for all critical flows.
 * - All display/content/fields per OpenAPI contract; no speculative fields.
 */
export default function Trading() {
  const { token, user } = useAuth();
  const isMounted = useRef(true);

  // SECTION: State
  const [portfolio, setPortfolio] = useState([]); // holdings
  const [trades, setTrades] = useState([]); // trade logs
  const [positions, setPositions] = useState([]); // open positions (calculate from trades/portfolio if needed)
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Trade form
  const [form, setForm] = useState({
    asset: "",
    side: "buy",
    qty: "",
    price: "",
    strategy_id: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // Refresh intervals
  const refreshTimer = useRef(null);

  // SECTION: Fetch Data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [portfolioResp, tradesResp] = await Promise.all([
        apiFetch("/portfolio", { token }),
        apiFetch("/trades", { token }),
      ]);
      if (!isMounted.current) return;
      setPortfolio(Array.isArray(portfolioResp) ? portfolioResp : []);
      setTrades(Array.isArray(tradesResp) ? tradesResp.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      ) : []);
      // Calculate open positions
      setPositions(getOpenPositions(portfolioResp, tradesResp));
    } catch (err) {
      setError(err?.message || "Could not load trading/portfolio data.");
    }
    setLoading(false);
  }, [token]);

  // Initial and interval fetch
  useEffect(() => {
    isMounted.current = true;
    fetchAll();
    // Auto-refresh
    refreshTimer.current = setInterval(fetchAll, REFRESH_MS);
    return () => {
      isMounted.current = false;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [fetchAll]);

  // SECTION: Trade form handlers
  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setFormError(null);
    setFormSuccess(null);
  }

  async function onSubmitTrade(e) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    // Validate all form fields exist, qty/price > 0, asset non-empty
    if (
      !form.asset ||
      !form.side ||
      !form.qty ||
      !form.price ||
      isNaN(Number(form.qty)) ||
      isNaN(Number(form.price)) ||
      Number(form.qty) <= 0 ||
      Number(form.price) <= 0
    ) {
      setFormError("Fill out all fields. Quantity and price must be > 0.");
      setFormLoading(false);
      return;
    }

    try {
      // OpenAPI spec: POST /trades with PaperTrade payload
      const tradePayload = {
        asset: form.asset.trim().toUpperCase(),
        side: form.side,
        qty: Number(form.qty),
        price: Number(form.price),
        timestamp: new Date().toISOString(),
      };
      if (form.strategy_id) {
        tradePayload.strategy_id = Number(form.strategy_id);
      }
      const resp = await apiFetch("/trades", {
        method: "POST",
        data: tradePayload,
        token,
      });
      setFormSuccess("Trade executed successfully!");
      setForm({
        asset: "",
        side: "buy",
        qty: "",
        price: "",
        strategy_id: "",
      });
      // Immediately refresh trades/portfolio for feedback
      fetchAll();
    } catch (err) {
      setFormError(
        err?.message || "Trade could not be executed. Check values and try again."
      );
    } finally {
      setFormLoading(false);
    }
  }

  // UI
  return (
    <section className="trading">
      <h2>Paper Trading</h2>
      <div style={{ margin: "1rem 0 1.6rem" }}>
        <p>
          View your real-time paper portfolio. Simulate a buy/sell trade below.
          {" "}All actions affect only your demo balance.
        </p>
      </div>

      {error && (
        <div className="error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* SECTION: Portfolio Positions Table */}
      <div>
        <h3 style={{ margin: "1.3rem 0 0.2rem" }}>Portfolio Holdings</h3>
        {
          loading ? <div>Loading positions...</div> :
            <div className="trading-table" style={{ display: "flex", flexWrap: "wrap", gap: "1em" }}>
              {portfolio && portfolio.length > 0 ? portfolio.map((p) => (
                <div key={p.id || p.asset} className="trading-position-card" style={{
                  minWidth: 220, background: "var(--bg-secondary)", borderRadius: 9, padding: 16, border: "1px solid var(--border-color)", boxShadow: "0 1px 6px rgba(30,41,59,0.05)", marginBottom: 6
                }}>
                  <div style={{ fontWeight: 600, fontSize: "1.07em" }}>{p.asset}</div>
                  <div>
                    <span>Qty: <b>{p.quantity}</b></span>
                  </div>
                  <div>
                    <span>Avg. Cost: ${Number(p.cost_basis).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )) : (
                <div style={{ color: "#888" }}>No holdings found.<br />Place a trade to add a position.</div>
              )}
            </div>
        }
      </div>

      {/* SECTION: Trade Form */}
      <form
        className="trading-form"
        style={{
          margin: "2rem 0 1.5rem",
          padding: 20,
          background: "var(--bg-secondary)",
          borderRadius: 11,
          border: "1px solid var(--border-color,#e9ecef)",
          maxWidth: 440,
        }}
        onSubmit={onSubmitTrade}
        aria-labelledby="trade-form-title"
      >
        <h3 id="trade-form-title" style={{ marginBottom: 12 }}>Simulate Buy/Sell</h3>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 100px" }}>
            Asset
            <input
              type="text"
              name="asset"
              value={form.asset}
              onChange={handleFormChange}
              maxLength={16}
              placeholder="e.g. AAPL"
              required
              autoComplete="on"
              disabled={formLoading}
              style={{ width: "100%", minWidth: 60 }}
            />
          </label>
          <label style={{ flex: "1 1 93px" }}>
            Side
            <select
              name="side"
              value={form.side}
              onChange={handleFormChange}
              required
              disabled={formLoading}
              style={{ width: "100%", minWidth: 70 }}
            >
              {SIDE_OPTIONS.map(s =>
                <option value={s.value} key={s.value}>{s.label}</option>
              )}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ flex: "1 1 70px" }}>
            Quantity
            <input
              type="number"
              name="qty"
              value={form.qty}
              onChange={handleFormChange}
              min={0}
              step={0.0001}
              placeholder="e.g. 20"
              required
              disabled={formLoading}
              style={{ width: "100%", minWidth: 50 }}
            />
          </label>
          <label style={{ flex: "1 1 100px" }}>
            Price
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleFormChange}
              min={0}
              step={0.0001}
              placeholder="e.g. 180.01"
              required
              disabled={formLoading}
              style={{ width: "100%", minWidth: 50 }}
            />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ flex: "1 1 90px" }}>
            Strategy ID <span style={{ fontWeight: 400, color: "#aaa", fontSize: 13 }}>(optional)</span>
            <input
              type="number"
              name="strategy_id"
              value={form.strategy_id}
              onChange={handleFormChange}
              min={1}
              placeholder="(Optional)"
              disabled={formLoading}
              style={{ width: "100%", minWidth: 40 }}
            />
          </label>
        </div>
        <button
          className="btn"
          style={{ fontSize: 17, marginTop: 15, width: 120 }}
          type="submit"
          disabled={formLoading}
        >
          {formLoading ? "Placing..." : "Place Trade"}
        </button>
        {formError && <div className="error" style={{ marginTop: 6 }} role="alert" aria-live="assertive">{formError}</div>}
        {formSuccess && <div style={{ marginTop: 6, color: "#10b981", fontWeight: 600 }}>{formSuccess}</div>}
      </form>

      {/* SECTION: Trade Log */}
      <div>
        <h3 style={{ marginTop: "2.2rem", marginBottom: ".7rem" }}>Trade Log</h3>
        {loading ? <div>Loading trades...</div> :
          <div className="trading-table" style={{ display: "flex", flexWrap: "wrap", gap: "1em" }}>
            {trades && trades.length > 0 ? trades.map((t) => (
              <div key={t.id} className="trading-position-card"
                style={{
                  minWidth: 225, background: "#f3f3f8", borderRadius: 11, padding: 16, border: "1px solid var(--border-color,#e9ecef)", boxShadow: "0 1px 7px rgba(190,190,210,0.07)"
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.side === "buy" ? "Bought" : "Sold"} {t.qty} <span style={{ color: "#2763db" }}>{t.asset}</span></div>
                <div>At price: <b>${Number(t.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}</b></div>
                {t.strategy_id && <div>Strategy #{t.strategy_id}</div>}
                <div style={{ color: "#888", fontSize: ".97em" }}>
                  {formatTime(t.timestamp)}
                </div>
              </div>
            )) : (
              <div style={{ color: "#888" }}>
                No trades found. Simulate a trade above.
              </div>
            )}
          </div>
        }
      </div>

      <style>{`
        .trading-table {
          margin-top: 0.1rem;
          margin-bottom: 0.5rem;
        }
        .trading-position-card {
          transition: box-shadow 0.15s, border 0.15s;
        }
        .trading-position-card:hover {
          box-shadow: 0 3px 18px rgba(30,41,59,0.15);
          border: 1px solid #85f2e1;
          transform: translateY(-1px);
        }
        .trading-form input, .trading-form select {
          margin-top: 2.5px;
          padding: 7px 8px;
        }
      `}</style>
    </section>
  );
}

/**
 * Returns open positions based on portfolio entries. (In this backend, just return portfolio assets with qty > 0)
 * Could be expanded with live price/PnL if provided by backend.
 */
function getOpenPositions(portfolioResp, tradesResp) {
  if (!Array.isArray(portfolioResp)) return [];
  return portfolioResp.filter(e => e.quantity > 0);
}

// Utility: Format '2024-03-20T14:46:02' nicely
function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      // Show time only
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return String(ts);
  }
}

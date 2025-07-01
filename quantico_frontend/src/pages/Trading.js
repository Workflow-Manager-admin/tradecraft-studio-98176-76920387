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

// Initial demo virtual capital
const INITIAL_VIRTUAL_CAPITAL = 100000;

// PUBLIC_INTERFACE
/**
 * The Paper Trading page with live price simulation, virtual capital,
 * and trade log featuring profit/loss per trade. Data is live and backend-synced.
 */
export default function Trading() {
  const { token, user } = useAuth();
  const isMounted = useRef(true);

  // SECTION: State
  const [portfolio, setPortfolio] = useState([]);
  const [trades, setTrades] = useState([]);
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // For market prices (live pricing for current asset; simple demo gets only price for simulation)
  const [marketPrice, setMarketPrice] = useState(null);
  const [priceAsset, setPriceAsset] = useState(""); // asset requested for price

  // Virtual Capital
  const [virtualCapital, setVirtualCapital] = useState(INITIAL_VIRTUAL_CAPITAL);

  // Trade form state
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

  // Refresh interval
  const refreshTimer = useRef(null);

  // --- Fetch all trading/portfolio/trade log
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
      const sortedTrades = Array.isArray(tradesResp) ? tradesResp.sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      ) : [];
      setTrades(sortedTrades);

      setPositions(getOpenPositions(portfolioResp, tradesResp));
    } catch (err) {
      setError(err?.message || "Could not load trading/portfolio data.");
    }
    setLoading(false);
  }, [token]);

  // On mount and poll
  useEffect(() => {
    isMounted.current = true;
    fetchAll();
    refreshTimer.current = setInterval(fetchAll, REFRESH_MS);

    return () => {
      isMounted.current = false;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [fetchAll]);

  // Update virtual capital as trades change
  useEffect(() => {
    // Simulate capital computation from trades: start with 100,000. Subtract buying cost, add sell revenue.
    let capital = INITIAL_VIRTUAL_CAPITAL;
    // Sorted oldest -> newest for correct buy-sell netting
    const sortedTrades = Array.isArray(trades) ? [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
    for (let t of sortedTrades) {
      if (!t.qty || !t.price) continue;
      if (t.side === "buy") {
        capital -= (Number(t.qty) * Number(t.price));
      } else if (t.side === "sell") {
        capital += (Number(t.qty) * Number(t.price));
      }
    }
    setVirtualCapital(Number(capital.toFixed(2)));
  }, [trades]);

  // --- Market price fetch for the current asset in the trade form
  useEffect(() => {
    // Fetch current market price for form.asset when it changes
    async function fetchPrice() {
      if (!form.asset) {
        setMarketPrice(null);
        return;
      }
      setPriceAsset(form.asset);
      try {
        // Use endpoint: /integration/chart?asset=ASSET&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&resolution=1d
        // We'll use only today's price for quote simulation.
        const asset = form.asset.toUpperCase().slice(0, 10);
        const today = (new Date()).toISOString().slice(0, 10); // YYYY-MM-DD
        const resp = await apiFetch("/integration/chart", {
          params: {
            asset,
            start_date: today,
            end_date: today,
            resolution: "1d"
          },
          token,
        });
        // Try to find latest close/price in candles/ohlc/prices
        let price = null;
        if (resp && Array.isArray(resp.ohlc) && resp.ohlc.length > 0) {
          price = resp.ohlc[resp.ohlc.length-1].close;
        } else if (resp && Array.isArray(resp.candles) && resp.candles.length > 0) {
          price = resp.candles[resp.candles.length-1].close;
        } else if (resp && Array.isArray(resp.prices) && resp.prices.length > 0) {
          price = resp.prices[resp.prices.length-1].close || resp.prices[resp.prices.length-1].price;
        } else if (Array.isArray(resp) && resp.length > 0) {
          price = resp[resp.length-1].close || resp[resp.length-1].price;
        }
        setMarketPrice(isFinite(price) ? Number(price) : null);
      } catch {
        setMarketPrice(null);
      }
    }
    fetchPrice();
  // eslint-disable-next-line
  }, [form.asset, token]);

  // Auto-fill price field on asset change if marketPrice available and price is empty or mismatched asset
  useEffect(() => {
    if (
      form.asset &&
      marketPrice &&
      (form.price === "" || String(priceAsset).toUpperCase() !== form.asset.toUpperCase())
    ) {
      setForm(f => ({ ...f, price: marketPrice }));
    }
    // eslint-disable-next-line
  }, [marketPrice]);

  // SECTION: Trade form handlers
  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setFormError(null);
    setFormSuccess(null);
    // If asset changed, clear price to allow latest marketPrice autofill.
    if (name === "asset") {
      setMarketPrice(null);
      setForm(f => ({ ...f, price: "" }));
    }
  }

  async function onSubmitTrade(e) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

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

    // Compose id: ensure always present in tradePayload as required by backend
    let id = undefined;
    if (form.strategy_id) {
      id = Number(form.strategy_id);
    } else if (trades && Array.isArray(trades) && trades.length > 0) {
      id = Math.max(...trades.map(t => typeof t.id === "number" ? t.id : 0), 0) + 1;
    } else {
      id = 1;
    }
    if (!id || !Number.isFinite(id)) {
      setFormError("No valid 'id' available for this trade. (Contextual id missing; trade not sent.)");
      setFormLoading(false);
      return;
    }

    try {
      // Always use market price if available
      const tradePayload = {
        id,
        asset: form.asset.trim().toUpperCase(),
        side: form.side,
        qty: Number(form.qty),
        price:
          isFinite(Number(marketPrice))
            ? Number(marketPrice)
            : Number(form.price), // fallback to whatever user has input
        timestamp: new Date().toISOString(),
      };
      if (form.strategy_id) {
        tradePayload.strategy_id = Number(form.strategy_id);
      }
      await apiFetch("/trades", {
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
      setMarketPrice(null);
      fetchAll();
    } catch (err) {
      setFormError(
        err?.message || "Trade could not be executed. Check values and try again."
      );
    } finally {
      setFormLoading(false);
    }
  }

  // Compute profit/loss for each trade (realized: per-close buy-sell pairs for an asset)
  // Only use trades belonging to the same asset for PnL, assume FIFO.
  function computeTradePnL(tradesList) {
    // Map asset to positions
    const pnls = [];
    const assetMap = {};
    for (const trade of tradesList) {
      if (!trade || !trade.side || !trade.price || !trade.qty) {
        pnls.push(null);
        continue;
      }
      const asset = String(trade.asset).toUpperCase();
      if (!assetMap[asset]) assetMap[asset] = [];
      if (trade.side === "buy") {
        assetMap[asset].push({ ...trade, remain: Number(trade.qty) });
        pnls.push(null); // buy doesn't realize pnl yet
      } else if (trade.side === "sell") {
        // Realize PnL on sold qty; match to earlier buys FIFO
        let remainToSell = Number(trade.qty);
        let pnl = 0;
        let buys = assetMap[asset];
        if (!Array.isArray(buys) || buys.length === 0) {
          pnls.push(null);
          continue; // No buys to match against
        }
        while (remainToSell > 0 && buys.length > 0) {
          const buy = buys[0];
          const matchQty = Math.min(buy.remain, remainToSell);
          pnl += matchQty * (Number(trade.price) - Number(buy.price));
          buy.remain -= matchQty;
          remainToSell -= matchQty;
          if (buy.remain <= 0) buys.shift();
        }
        pnls.push(Number(pnl.toFixed(2)));
      } else {
        pnls.push(null);
      }
    }
    return pnls;
  }

  // For legacy UI blocks: display trade log, include new columns (timestamp, action, asset, profit/loss)
  const tradePnLs = computeTradePnL(trades);

  // UI
  return (
    <section className="trading">
      <h2>Paper Trading</h2>
      <div style={{ margin: "1rem 0 1.6rem" }}>
        <p>
          Simulate trades using current market prices. Your virtual capital and trade log update in real time.
        </p>
      </div>

      {/* Virtual Capital Tracker */}
      <div style={{
        background: "#f5fafb",
        borderRadius: 9,
        border: "1.5px solid var(--border-color,#e0e7ef)",
        padding: "11px 17px",
        width: "max-content",
        fontWeight: 600,
        fontSize: "1.15em",
        marginBottom: "1.2rem",
        color: "#3182ce"
      }}>
        Virtual Capital: <span style={{ color: "#10b981", fontWeight: 700 }}>${virtualCapital.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
      </div>

      {error && (
        <div className="error" role="alert" aria-live="assertive">
          {typeof error === "string"
            ? error
            : error && error.message
              ? String(error.message)
              : error && typeof error === "object"
                ? JSON.stringify(error, null, 2)
                : String(error)}
        </div>
      )}

      {/* Portfolio Section */}
      <div>
        <h3 style={{ margin: "1.3rem 0 0.2rem" }}>Portfolio Holdings</h3>
        {
          loading ? <div>Loading positions...</div> :
            <div className="trading-table" style={{ display: "flex", flexWrap: "wrap", gap: "1em" }}>
              {portfolio && portfolio.length > 0 ? portfolio.map((p) => (
                <div key={String(p.id ?? p.asset)} className="trading-position-card" style={{
                  minWidth: 220, background: "var(--bg-secondary)", borderRadius: 9, padding: 16, border: "1px solid var(--border-color)", boxShadow: "0 1px 6px rgba(30,41,59,0.05)", marginBottom: 6
                }}>
                  <div style={{ fontWeight: 600, fontSize: "1.07em" }}>
                    {typeof p.asset === "string" ? p.asset : String(p.asset ?? "")}
                  </div>
                  <div>
                    <span>Qty: <b>{typeof p.quantity === "number" || typeof p.quantity === "string" ? p.quantity : "--"}</b></span>
                  </div>
                  <div>
                    <span>
                      Avg. Cost: $
                      {isFinite(Number(p.cost_basis))
                        ? Number(p.cost_basis).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "--"}
                    </span>
                  </div>
                </div>
              )) : (
                <div style={{ color: "#888" }}>No holdings found.<br />Place a trade to add a position.</div>
              )}
            </div>
        }
      </div>

      {/* Trade Form Section */}
      <form
        className="trading-form"
        style={{
          margin: "2rem 0 1.5rem",
          padding: 20,
          background: "var(--bg-secondary)",
          borderRadius: 11,
          border: "1px solid var(--border-color,#e9ecef)",
          maxWidth: 490,
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
              style={{ width: "100%", minWidth: 60, textTransform: "uppercase" }}
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
              disabled={formLoading || !!marketPrice}
              style={{ width: "100%", minWidth: 50 }}
              readOnly={!!marketPrice}
            />
            {/* Price fetch display */}
            {form.asset && marketPrice &&
              <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600, marginLeft: 7 }}>
                (Live market: ${Number(marketPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })})
              </span>
            }
            {form.asset && !marketPrice &&
              <span style={{ fontSize: 12, color: "#888", marginLeft: 7 }}>
                (No market price found)
              </span>
            }
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
        {formError && (
          <div className="error" style={{ marginTop: 6 }} role="alert" aria-live="assertive">
            {typeof formError === "string"
              ? formError
              : formError && formError.message
                ? String(formError.message)
                : formError && typeof formError === "object"
                  ? JSON.stringify(formError, null, 2)
                  : String(formError)}
          </div>
        )}
        {formSuccess && (
          <div style={{ marginTop: 6, color: "#10b981", fontWeight: 600 }}>
            {typeof formSuccess === "string"
              ? formSuccess
              : formSuccess && formSuccess.message
                ? String(formSuccess.message)
                : formSuccess && typeof formSuccess === "object"
                  ? JSON.stringify(formSuccess, null, 2)
                  : String(formSuccess)}
          </div>
        )}
      </form>

      {/* Trade Log Section */}
      <div>
        <h3 style={{ marginTop: "2.2rem", marginBottom: ".7rem" }}>Trade Log</h3>
        {loading ? <div>Loading trades...</div> :
          trades && trades.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: 10, background: "var(--bg-secondary)", marginBottom: 10 }}>
                <thead>
                  <tr style={{ background: "#e6f7ec", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Timestamp</th>
                    <th style={{ padding: "8px 10px" }}>Action</th>
                    <th style={{ padding: "8px 10px" }}>Asset</th>
                    <th style={{ padding: "8px 10px" }}>Qty</th>
                    <th style={{ padding: "8px 10px" }}>Price</th>
                    <th style={{ padding: "8px 10px" }}>Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, idx) => (
                    <tr key={String(t.id ?? t.asset ?? idx)} style={{ background: idx % 2 ? "#fafcff" : undefined }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{formatTime(t.timestamp)}</td>
                      <td style={{ padding: "6px 10px" }}>
                        {typeof t.side === "string"
                          ? (t.side === "buy" ? "Buy" : t.side === "sell" ? "Sell" : t.side)
                          : t.side}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{t.asset?.toUpperCase() ?? "--"}</td>
                      <td style={{ padding: "6px 10px" }}>{t.qty}</td>
                      <td style={{ padding: "6px 10px" }}>
                        {isFinite(Number(t.price))
                          ? `$${Number(t.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                          : "--"}
                      </td>
                      <td style={{
                        padding: "6px 10px",
                        color:
                          tradePnLs[idx] > 0
                            ? "#10b981"
                            : tradePnLs[idx] < 0
                              ? "#ef4444"
                              : "#666"
                      }}>
                        {tradePnLs[idx] == null
                          ? "--"
                          : tradePnLs[idx] > 0
                            ? `+$${tradePnLs[idx].toLocaleString(undefined, {maximumFractionDigits:2})}`
                            : tradePnLs[idx] < 0
                              ? `-$${Math.abs(tradePnLs[idx]).toLocaleString(undefined, {maximumFractionDigits:2})}`
                              : "$0.00"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "#888" }}>
              No trades found. Simulate a trade above.
            </div>
          )
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
        .trading-log-table th, .trading-log-table td {
          border-bottom: 1px solid var(--border-color,#e5ecef);
        }
        .trading-log-table th { font-weight: 650; }
      `}</style>
    </section>
  );
}

/**
 * Returns open positions based on portfolio entries. In this backend, just return portfolio assets with qty > 0.
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

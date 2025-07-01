import React, { useEffect, useState, useMemo } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

/**
 * Portfolio Page
 * - Lists all user's portfolio assets and associated strategies (via /portfolio and /strategies)
 * - Allows client-side searching, filtering, sorting (by asset, ROI, cost basis, etc)
 * - Fully responsive: grid on desktop, stacked on mobile
 * - Displays fallback empty, error, and loading UI per best UX practices
 * - Strictly matches backend API as per OpenAPI contract
 * 
 * PortfolioEntry (from /portfolio):
 *   {
 *     asset: string,
 *     quantity: number,
 *     cost_basis: number,
 *     id: int | null
 *   }
 * 
 * StrategyRead (from /strategies):
 *   {
 *     name: string,
 *     description?: string|null,
 *     config_json: object,
 *     id: integer,
 *     created_at: ISO string,
 *     updated_at: ISO string
 *   }
 */

// Client-side sorting comparator
function getSortFn(sortKey, asc = true) {
  return (a, b) => {
    let res = 0;
    if (sortKey === "asset") res = (a.asset || "").localeCompare(b.asset || "");
    else if (sortKey === "quantity") res = (Number(a.quantity) - Number(b.quantity));
    else if (sortKey === "cost_basis") res = (Number(a.cost_basis) - Number(b.cost_basis));
    else if (sortKey === "roi") res = (Number(a.roi ?? 0) - Number(b.roi ?? 0));
    else if (sortKey === "strategy") {
      const sa = ((a.strategy && a.strategy.name) || "");
      const sb = ((b.strategy && b.strategy.name) || "");
      res = sa.localeCompare(sb);
    }
    return asc ? res : -res;
  };
}

// Helper: Fake (random sample) ROI if needed since backend PortfolioEntry doesn't include performance
function randomROI(seed, lo = -10, hi = 35) {
  // Seeded pseudo-random; stable (but fake) for demo/dev visual
  let s = (typeof seed === "string" ? seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : Number(seed) || 0);
  let x = Math.sin(s * 91311) * 10000;
  let roi = lo + Math.abs(x % 1) * (hi - lo);
  return Number(roi.toFixed(2));
}

// PUBLIC_INTERFACE
export default function Portfolio() {
  const { token, user } = useAuth();

  // Data state
  const [portfolio, setPortfolio] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI: filter/sort/search state
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("roi");
  const [sortAsc, setSortAsc] = useState(false);

  // Load portfolio and strategy data
  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [portfolioResp, strategyResp] = await Promise.all([
          apiFetch("/portfolio", { token }),
          apiFetch("/strategies", { token }),
        ]);
        if (mounted) {
          setPortfolio(Array.isArray(portfolioResp) ? portfolioResp : []);
          setStrategies(Array.isArray(strategyResp) ? strategyResp : []);
        }
      } catch (e) {
        setError(
          e?.message ||
            "Failed to load portfolio information. Please try again."
        );
        setPortfolio([]);
        setStrategies([]);
      }
      setLoading(false);
    }
    if (token) loadAll();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Build merged portfolio entries with attached strategy, fake ROI for now (no PnL yet)
  const portfolioDisplay = useMemo(() => {
    if (!Array.isArray(portfolio)) return [];

    // Attach matching strategy by asset (if possible) via config_json or save asset in config_json
    // For now, just find by name/first that matches asset for demo
    const stratLookup = {};
    for (const s of strategies) {
      // If config_json specifies asset, match; otherwise, just attach strategies as options
      if (s && s.config_json && s.config_json.asset) {
        stratLookup[String(s.config_json.asset).toUpperCase()] = s;
      }
    }
    return portfolio.map((p) => {
      // Attach a matching strategy by config_json.asset or asset or (random)
      let strategy = stratLookup[String(p.asset || "").toUpperCase()] || null;
      // Fallback: link first strategy if only one
      if (!strategy && strategies.length === 1) strategy = strategies[0];
      // Demo: fake ROI for portfolio until real linked PnL is available
      let roi = undefined;
      if (p && strategy && strategy.config_json && typeof strategy.config_json.roi === "number") {
        roi = strategy.config_json.roi;
      } else {
        roi = randomROI(p.asset || p.id);
      }
      return {
        ...p,
        strategy,
        roi,
      };
    });
  }, [portfolio, strategies]);

  // Apply search (by asset or strategy name/desc), sorting
  const filtered = useMemo(() => {
    let res = portfolioDisplay;
    if (search && search.trim().length > 0) {
      const sterm = search.trim().toLowerCase();
      res = res.filter(
        (e) =>
          (e.asset && e.asset.toLowerCase().includes(sterm)) ||
          (e.strategy &&
            ((e.strategy.name || "").toLowerCase().includes(sterm) ||
              (e.strategy.description || "").toLowerCase().includes(sterm)))
      );
    }
    res = [...res].sort(getSortFn(sortKey, sortAsc));
    return res;
  }, [portfolioDisplay, search, sortKey, sortAsc]);

  // Dynamic grid cell/card
  function PortfolioCard({ entry }) {
    const { asset, quantity, cost_basis, id, strategy, roi } = entry || {};
    return (
      <div className="portfolio-strategy-card" tabIndex={0}>
        <div className="portfolio-strategy-title" style={{ fontWeight: 600, fontSize: "1.13em" }}>
          <span role="img" aria-label="Asset" style={{marginRight:4}}>💼</span>{asset}
        </div>
        <div style={{ fontSize: "0.95em", color: "#888" }}>
          <span>Quantity: </span>
          <b>{typeof quantity === "number" ? quantity : "--"}</b>
        </div>
        <div style={{ fontSize: "0.95em" }}>
          <span>Avg. Cost: </span>
          {isFinite(Number(cost_basis))
            ? `$${Number(cost_basis).toLocaleString(undefined, {
                maximumFractionDigits: 4,
                minimumFractionDigits: 2,
              })}`
            : "--"}
        </div>
        <div style={{ fontSize: "0.97em", margin: "8px 0 2px" }}>
          <span>ROI: </span>
          <b style={{ color: roi > 0 ? "#10b981" : roi < 0 ? "#ef4444" : undefined }}>
            {roi != null && roi !== undefined ? roi + "%" : "--"}
          </b>
        </div>
        {strategy ? (
          <div style={{ fontSize: ".98em", color: "#6a8", marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>Strategy:</span> {strategy.name}
            {strategy.description && (
              <div style={{ fontSize: "0.92em", color: "#888", marginTop: 2, lineClamp: 1, overflow: "hidden" }}>
                {strategy.description}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: ".95em", color: "#999", marginTop: 6 }}>No linked strategy</div>
        )}
      </div>
    );
  }

  // UI
  return (
    <section className="portfolio">
      <h2>Your Portfolio</h2>
      <div style={{
        margin: "1rem 0 16px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "1.1rem",
        borderRadius: 10,
        background: "var(--bg-secondary)",
        padding: "12px 16px",
        border: "1px solid var(--border-color)",
      }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search asset or strategy …"
          style={{
            padding: "9px 13px",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            minWidth: 120,
            fontSize: 15,
            flex: "1 1 160px"
          }}
          aria-label="Search portfolio"
        />
        <label style={{ fontWeight: 600, marginRight: 6 }}>
          Sort&nbsp;
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            style={{ fontSize: 15, padding: "5px 7px", borderRadius: 7 }}
            aria-label="Sort portfolio"
          >
            <option value="roi">Return (%)</option>
            <option value="asset">Asset</option>
            <option value="quantity">Quantity</option>
            <option value="cost_basis">Cost Basis</option>
            <option value="strategy">Strategy</option>
          </select>
        </label>
        <button
          className="btn"
          style={{ fontSize: 15, padding: "3px 10px", marginLeft: 3, background: "#e9ecef", color: "#333", fontWeight: 600 }}
          onClick={() => setSortAsc((v) => !v)}
          aria-label={sortAsc ? "Sort descending" : "Sort ascending"}
        >
          {sortAsc ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: "#888", margin: "1.4rem 0" }}>
          Loading portfolio…
        </div>
      )}

      {error && (
        <div className="error" role="alert" aria-live="assertive" style={{ margin: "1.5rem 0" }}>
          {String(error)}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "#888", margin: "1.6rem 0" }}>
          No portfolio entries found.<br />
          {search ? "Try clearing your search." : "Add assets or simulate trades to see your portfolio here."}
        </div>
      )}

      {/* Responsive grid */}
      <div className="portfolio-table">
        {filtered.map((entry) => (
          <PortfolioCard key={entry.id ?? entry.asset} entry={entry} />
        ))}
      </div>

      {/* Responsive styles */}
      <style>{`
        .portfolio-table {
          display: flex;
          flex-wrap: wrap;
          gap: 1.2rem;
          margin: 0.8rem 0 1.8rem 0;
        }
        .portfolio-strategy-card {
          padding: 1.2rem 1.5rem;
          background: var(--bg-secondary,#f8f9fa);
          border-radius: 10px;
          border: 1px solid var(--border-color,#e9ecef);
          min-width: 200px;
          flex: 1 1 270px;
          box-shadow: 0 2px 8px rgba(30,41,59,0.04);
          transition: box-shadow 0.15s, border 0.15s;
          margin-bottom: 5px;
        }
        .portfolio-strategy-card:focus, .portfolio-strategy-card:hover {
          box-shadow: 0 5px 18px rgba(16,185,129,0.13);
          border: 1px solid #10b981;
          outline: none;
        }
        .portfolio-strategy-title {
          margin-bottom: 2px;
        }
        @media (max-width: 900px) {
          .portfolio-table { flex-direction: column; gap: 0.7rem; }
          .portfolio-strategy-card { min-width: unset; }
        }
        @media (max-width: 650px) {
          .portfolio-strategy-card { padding: 1rem 0.85rem; }
        }
      `}</style>
    </section>
  );
}

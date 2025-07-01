import React, { useEffect, useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

/**
 * AI Assistant Page
 * - Panel 1: Recommended Trading Rules (based on user trading history/strategies/trades)
 * - Panel 2: Strategy Optimizer (suggests improvements for higher ROI)
 * - Panel 3: Natural Language Input ("Show me low-risk BTC strategy for 30-day swing")
 * All backend calls per openapi.json. Handles loading, error, empty, and render states.
 */

// Helper: Reusable loading spinner
function Spinner({ size = 23, label = "Loading..." }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "#10b981",
        fontWeight: 500,
        fontSize: ".98em",
        verticalAlign: "middle"
      }}
      aria-busy="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        style={{ animation: "spin 1.3s linear infinite" }}
      >
        <circle
          cx="20"
          cy="20"
          r="15"
          stroke="#10b981"
          strokeWidth="4"
          fill="none"
          strokeDasharray="80"
          strokeDashoffset="38"
        />
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </svg>{" "}
      {label}
    </span>
  );
}

// Helper: Render strategy list or rules
function RulesPanel({ title, rules, loading, error, onRefresh }) {
  return (
    <div
      className="ai-card"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 11,
        padding: "1.1rem 1.2rem",
        marginBottom: "1.3rem",
        boxShadow: "0 1px 5px rgba(16,185,129,0.05)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
        {onRefresh && (
          <button
            style={{
              background: "#e4f9f1",
              border: "1px solid #10b981",
              borderRadius: 6,
              padding: "2px 12px",
              color: "#10b981",
              fontWeight: 600,
              fontSize: 13,
              marginLeft: 10,
              cursor: "pointer",
            }}
            onClick={onRefresh}
            aria-label="Refresh"
            disabled={loading}
          >
            &#x21bb; Refresh
          </button>
        )}
      </div>
      <div style={{ minHeight: 28, marginTop: 6 }}>
        {loading ? (
          <Spinner size={16} label="Loading..." />
        ) : error ? (
          <div className="error" style={{ color: "#ef4444", margin: "0.6em 0" }}>
            {String(error)}
          </div>
        ) : !rules || rules.length === 0 ? (
          <div style={{ color: "#888" }}>No recommendations available.</div>
        ) : (
          <ul style={{ marginLeft: 15 }}>
            {rules.map((r, i) => (
              <li key={i} style={{ marginBottom: 5 }}>
                <span role="img" aria-label="Rule" style={{ marginRight: 7 }}>
                  📋
                </span>
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Helper: Optimizer Result Card
function OptimizerCard({ result, loading, error, onOptimize }) {
  return (
    <div
      className="ai-card"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 11,
        padding: "1.1rem 1.2rem",
        marginBottom: "1.3rem",
        boxShadow: "0 1px 5px rgba(30,41,59,0.07)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          Strategy Optimizer{" "}
          <span role="img" aria-label="Rocket">
            🚀
          </span>
        </div>
        {onOptimize && (
          <button
            style={{
              background: "#eae4fa",
              border: "1px solid #7c3aed",
              borderRadius: 6,
              padding: "2px 12px",
              color: "#7c3aed",
              fontWeight: 600,
              fontSize: 13,
              marginLeft: 10,
              cursor: "pointer",
            }}
            onClick={onOptimize}
            aria-label="Re-optimize"
            disabled={loading}
          >
            ⚡ Optimize
          </button>
        )}
      </div>
      <div style={{ minHeight: 28, marginTop: 6 }}>
        {loading ? (
          <Spinner size={17} label="Analyzing..." />
        ) : error ? (
          <div className="error" style={{ color: "#ef4444", margin: "0.6em 0" }}>
            {String(error)}
          </div>
        ) : result ? (
          <div>
            <div className="ai-answer">
              <strong>AI Suggestion:</strong>{" "}
              <span style={{ color: "#7c3aed" }}>{result}</span>
            </div>
          </div>
        ) : (
          <div style={{ color: "#888" }}>No suggestions available. Optimize to get started.</div>
        )}
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function AI() {
  const { token } = useAuth();

  // Panel 1: Recommended trading rules
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);

  // Panel 2: Strategy optimizer
  const [optResult, setOptResult] = useState("");
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState(null);

  // Panel 3: Natural language input
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlResponse, setNlResponse] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState(null);

  // Get recommended rules on load (request with suitable prompt)
  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line
  }, [token]);

  async function fetchRules() {
    setRulesLoading(true);
    setRulesError(null);
    setRules([]);
    try {
      // Compose prompt (can include "Based on my trading history, recommend new trading rules")
      const resp = await apiFetch("/ai/assist", {
        method: "POST",
        data: { prompt: "Based on my history, recommend 3 new trading rules or strategies I have not tried before. Output concise actionable rules only." },
        token,
      });
      // Allow splitting into bullet-points if backend returns a single string
      let output = "";
      if (resp && typeof resp.result === "string") {
        output = resp.result;
      }
      // Heuristic: split by "\n" or number/bullet
      let recommendedRules =
        output
          .split(/\n+/)
          .map(l => l.replace(/^[0-9\-\.]*\s*/, "").trim())
          .filter(Boolean)
          .slice(0, 6);
      // If no splitting possible, treat all as one
      if (!recommendedRules.length && output) recommendedRules = [output];
      setRules(recommendedRules);
    } catch (err) {
      setRulesError(
        err?.message ||
        "AI Assistant could not provide recommendations."
      );
    }
    setRulesLoading(false);
  }

  // Fetch/trigger optimizer suggestion (strategy optimizer)
  async function fetchOptimizer() {
    setOptLoading(true);
    setOptError(null);
    setOptResult("");
    try {
      // Compose optimizer prompt: request AI to review and suggest ROI-improving tweaks to current strategies
      const resp = await apiFetch("/ai/assist", {
        method: "POST",
        data: { prompt: "Analyze my trading strategies and suggest specific tweaks to maximize ROI. Focus on concrete changes and explain why." },
        token,
      });
      const res = resp && typeof resp.result === "string" ? resp.result.trim() : "";
      setOptResult(res);
    } catch (err) {
      setOptError(
        err?.message ||
        "AI Strategy Optimizer could not produce a suggestion."
      );
    }
    setOptLoading(false);
  }

  // Panel 3: Handle NL prompt submit ("Show me low-risk BTC strategy for 30-day swing" etc)
  async function onAskNL(e) {
    e && e.preventDefault && e.preventDefault();
    if (!nlPrompt) return;
    setNlLoading(true);
    setNlError(null);
    setNlResponse("");
    try {
      // Use ai/assist endpoint for custom/any prompt
      const resp = await apiFetch("/ai/assist", {
        method: "POST",
        data: { prompt: nlPrompt },
        token,
      });
      const result = resp && typeof resp.result === "string" ? resp.result.trim() : "";
      setNlResponse(result);
    } catch (err) {
      setNlError(
        err?.message ||
        "AI Assistant could not respond. Try again with a different request."
      );
    }
    setNlLoading(false);
  }

  // Render main page, split into three panels/blocks
  return (
    <section className="ai-assistant">
      <h2>AI Assistant <span role="img" aria-label="Robot">🤖</span></h2>

      {/* Panel 1: Recommended Rules */}
      <RulesPanel
        title="Recommended Trading Rules For You"
        rules={rules}
        loading={rulesLoading}
        error={rulesError}
        onRefresh={fetchRules}
      />

      {/* Panel 2: Strategy Optimizer */}
      <OptimizerCard
        result={optResult}
        loading={optLoading}
        error={optError}
        onOptimize={fetchOptimizer}
      />

      {/* Panel 3: NL Input */}
      <div
        className="ai-card"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 11,
          padding: "1.18rem 1.25rem",
          marginBottom: "1.2rem",
          boxShadow: "0 1px 5px rgba(30,41,59,0.07)",
        }}
      >
        <form onSubmit={onAskNL} className="ai-form" style={{ alignItems: "center" }}>
          <input
            type="text"
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            placeholder='Ask for a strategy e.g. "Show me low-risk BTC strategy for 30-day swing"...'
            required
            style={{
              flex: "1 1 250px",
              minWidth: 120,
              fontSize: 16,
              borderRadius: 7,
              border: "1px solid var(--border-color)",
              padding: "0.7rem 0.9rem",
              marginRight: 10,
              background: "#fff"
            }}
          />
          <button className="btn" type="submit" disabled={nlLoading || !nlPrompt.trim()} style={{ minWidth: 85 }}>
            {nlLoading ? <Spinner size={18} label="..." /> : "Ask"}
          </button>
        </form>
        <div style={{ minHeight: 22, marginTop: 16 }}>
          {nlLoading ? (
            <Spinner size={16} label="AI thinking..." />
          ) : nlError ? (
            <div className="error" style={{ color: "#ef4444", margin: "0.6em 0" }}>
              {String(nlError)}
            </div>
          ) : nlResponse ? (
            <div className="ai-answer">
              <strong>AI:</strong>{" "}
              <span style={{ color: "#0e7490" }}>{nlResponse}</span>
            </div>
          ) : (
            <span style={{ color: "#888" }}>Enter a specific strategy or advice request in natural language and AI will respond.</span>
          )}
        </div>
      </div>

      <style>{`
        .ai-assistant {
          max-width: 760px;
          margin: 2.5rem auto;
          padding: 1.2rem 1rem;
          background: var(--bg-secondary,#f7fafc);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          box-shadow: 0 4px 16px rgba(30,41,59,0.07);
        }
        .ai-card { margin-bottom: 1.3rem; }
        .ai-form {
          display: flex;
          flex-direction: row;
          gap: 1rem;
        }
        .ai-form input[type="text"] {
          flex: 1;
          font-size: 16px;
        }
        .ai-answer {
          margin-top: .8em;
          font-size: 1.07em;
        }
        .error { color: #ef4444; font-weight: bold; }
        @media (max-width:700px){
          .ai-assistant { max-width: 99vw; }
          .ai-form { flex-direction: column; gap: 0.7rem; }
        }
      `}</style>
    </section>
  );
}

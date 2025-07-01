import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <section className="landing">
      <h1>Quantico: Visual Strategy Lab for Stocks & Crypto</h1>
      <p>
        Build, simulate, and optimize algorithmic trading strategies.<br />
        Modern, responsive dashboard. AI-powered.<br />
        Backtest, trade, track portfolios, integrate with top brokers.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 320, margin: '2rem auto 0 auto' }}>
        <Link to="/register" className="btn btn-large" style={{ width: '100%' }}>
          Create Account / Get Started
        </Link>
        <span style={{ textAlign: 'center', fontWeight: 500 }}>— or —</span>
        <Link to="/login" className="btn" style={{ width: '100%', background: "var(--bg-secondary)", color: "var(--button-bg)" }}>
          Sign in to existing account
        </Link>
      </div>
      <div style={{ marginTop: "2.6rem", fontSize: "0.957em", color: "#888" }}>
        (Registration and login are distinct. You must register first, then log in.)
      </div>
    </section>
  );
}

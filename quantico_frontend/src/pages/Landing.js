import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <section className="landing">
      <h1>Quantico: Visual Strategy Lab for Stocks & Crypto</h1>
      <p>
        Build, simulate, and optimize algorithmic trading strategies.<br/>
        Modern, responsive dashboard. AI-powered.<br/>
        Backtest, trade, track portfolios, integrate with top brokers.
      </p>
      <Link to="/register" className="btn btn-large">Get Started</Link>
      <div style={{ marginTop: "1rem" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </section>
  );
}

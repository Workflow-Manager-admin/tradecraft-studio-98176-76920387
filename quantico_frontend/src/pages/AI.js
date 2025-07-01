import React, { useState } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";

// PUBLIC_INTERFACE
export default function AI() {
  const { token } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onAsk(e) {
    e.preventDefault();
    setLoading(true); setAnswer(null);
    try {
      const resp = await apiFetch("/ai/ask", {
        method: "POST",
        data: { question },
        token
      });
      setAnswer(resp.answer);
    } catch {
      setAnswer("AI Assistant could not respond.");
    }
    setLoading(false);
  }
  return (
    <section className="ai-assistant">
      <h2>AI Assistant</h2>
      <form onSubmit={onAsk} className="ai-form">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a trading or strategy question..."
          required
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="ai-answer">
          <strong>AI:</strong> {answer}
        </div>
      )}
    </section>
  );
}

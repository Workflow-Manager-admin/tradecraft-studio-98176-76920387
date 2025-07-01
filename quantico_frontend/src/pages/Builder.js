import React, { useState, useEffect, useRef } from "react";
import apiFetch from "../api";
import { useAuth } from "../context";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  Legend,
} from "recharts";

// Supported indicators for building strategies
const INDICATORS = [
  {
    type: "RSI",
    label: "RSI (Relative Strength Index)",
    params: [{ name: "period", label: "Period", default: 14, type: "number" }],
  },
  {
    type: "EMA",
    label: "EMA (Exponential Moving Average)",
    params: [{ name: "period", label: "Period", default: 20, type: "number" }],
  },
  {
    type: "SMA",
    label: "SMA (Simple Moving Average)",
    params: [{ name: "period", label: "Period", default: 50, type: "number" }],
  },
  {
    type: "MACD",
    label: "MACD (Moving Average Convergence Divergence)",
    params: [
      { name: "fast_period", label: "Fast Period", default: 12, type: "number" },
      { name: "slow_period", label: "Slow Period", default: 26, type: "number" },
      { name: "signal_period", label: "Signal Period", default: 9, type: "number" },
    ],
  },
];

// ------ Drag-and-drop builder logic -----
function useDragAndDrop(onDrop) {
  const dragDataRef = useRef(null);
  function onDragStart(e, item) {
    dragDataRef.current = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(item));
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDropHandler(e) {
    e.preventDefault();
    let item;
    try {
      item = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      item = dragDataRef.current;
    }
    if (item && onDrop) onDrop(item);
  }
  return { onDragStart, onDragOver, onDrop: onDropHandler };
}

function IndicatorBlock({ type, label, params, values, onChange, onRemove }) {
  return (
    <div className="builder-block">
      <span className="drag-handle" title="Drag to reorder">☰</span>
      <strong>{label}</strong>
      <div>
        {params.map((p) => (
          <label key={p.name} style={{ marginRight: 12 }}>
            {p.label}:
            <input
              type={p.type}
              value={values[p.name]}
              min={1}
              style={{ width: 50, marginLeft: 4 }}
              onChange={e => onChange(p.name, e.target.value)}
            />
          </label>
        ))}
        <button
          onClick={onRemove}
          style={{
            marginLeft: 8,
            background: "#ea4335",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            padding: "2px 9px",
          }}
          aria-label="Remove indicator"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function Builder() {
  const { token } = useAuth();
  const [strategies, setStrategies] = useState([]);
  const [selected, setSelected] = useState(null); // strategy id being edited
  const [editing, setEditing] = useState(false); // whether in edit/new mode
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Editable fields
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  // Strategy blocks: array of { type, params {period, etc} }
  const [blocks, setBlocks] = useState([]);
  // For chart: sample data (price, indicator values)
  const [preview, setPreview] = useState(null);
  const [previewLoad, setPreviewLoad] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Asset/period selection for preview
  const [previewAsset, setPreviewAsset] = useState("AAPL");
  const [previewRange, setPreviewRange] = useState({ start: "2024-01-01", end: "2024-05-20" });

  // Fetch user's strategies
  useEffect(() => {
    setLoading(true);
    async function load() {
      try {
        const data = await apiFetch("/strategies", { token });
        setStrategies(data || []);
      } catch (e) {
        setError("Failed to load strategies.");
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  // ----- CRUD Operations -----
  const handleEdit = async (sid) => {
    setEditing(true);
    setSelected(sid);
    setError(null);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoad(false);

    // Fetch strategy details
    try {
      setLoading(true);
      const s = await apiFetch(`/strategies/${sid}`, { token });
      setName(s.name || "");
      setDesc(s.description || "");
      // parse config_json as blocks
      const conf = Array.isArray(s.config_json?.blocks) ? s.config_json.blocks : [];
      setBlocks(conf.map((block) => ({
        type: block.type,
        params: { ...block.params },
      })));
    } catch {
      setError("Could not load strategy details.");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setSelected(null);
    setEditing(true);
    setName("");
    setDesc("");
    setBlocks([]);
    setError(null);
    setPreview(null);
    setPreviewError(null);
  };

  const handleDelete = async (sid) => {
    if (!window.confirm("Delete this strategy? This cannot be undone.")) return;
    try {
      setLoading(true);
      await apiFetch(`/strategies/${sid}`, { method: "DELETE", token });
      setStrategies(strategies.filter(s => s.id !== sid));
      setEditing(false);
      setSelected(null);
    } catch {
      setError("Failed to delete strategy.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!name || blocks.length === 0) {
      setError("Name and at least one indicator are required.");
      return;
    }
    const strategyData = {
      name,
      description: desc,
      config_json: {
        blocks,
      },
    };
    try {
      setLoading(true);
      let resp;
      if (selected) {
        resp = await apiFetch(`/strategies/${selected}`, {
          method: "PUT",
          data: strategyData,
          token,
        });
      } else {
        resp = await apiFetch(`/strategies`, {
          method: "POST",
          data: strategyData,
          token,
        });
      }
      // Update list and exit edit mode
      const strategiesUpdated = selected
        ? strategies.map((s) => (s.id === resp.id ? resp : s))
        : [resp, ...strategies];
      setStrategies(strategiesUpdated);
      setEditing(false);
      setSelected(null);
    } catch (e) {
      setError(
        e?.message ||
          "Failed to save strategy. Please check inputs or try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ------ Drag and drop builder logic ------
  const { onDragStart, onDragOver, onDrop } = useDragAndDrop((item) => {
    // Add new indicator block at end
    if (item && item.type) {
      setBlocks([
        ...blocks,
        {
          type: item.type,
          params: INDICATORS.find((i) => i.type === item.type).params.reduce(
            (acc, p) => ({ ...acc, [p.name]: p.default }),
            {}
          ),
        },
      ]);
    }
  });

  // Reorder via drag
  const [draggedIndex, setDraggedIndex] = useState(null);

  const onBlockDragStart = (ix) => (e) => {
    setDraggedIndex(ix);
  };
  const onBlockDragOver = (ix) => (e) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === ix) return;
    // Move block
    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(ix, 0, removed);
    setBlocks(newBlocks);
    setDraggedIndex(ix);
  };
  const onBlockDrop = () => {
    setDraggedIndex(null);
  };

  // Modify indicator params
  function updateBlockParam(ix, pname, val) {
    let newBlocks = [...blocks];
    newBlocks[ix] = {
      ...newBlocks[ix],
      params: { ...newBlocks[ix].params, [pname]: Number(val) || 1 },
    };
    setBlocks(newBlocks);
  }
  function removeBlock(ix) {
    setBlocks(blocks.filter((_, j) => j !== ix));
  }

  // ---- Preview/validation logic ----
  async function updatePreview() {
    setPreviewLoad(true);
    setPreviewError(null);
    setPreview(null);
    try {
      // See if there are any blocks; if not, skip
      if (!blocks.length) {
        setPreview(null);
        setPreviewLoad(false);
        return;
      }

      // Fetch historic price/ohlc series from backend (for current asset/range)
      const priceData = await apiFetch("/integration/chart", {
        params: {
          asset: previewAsset,
          start_date: previewRange.start,
          end_date: previewRange.end,
          resolution: "1d",
        },
      });

      // Simulate preview: attach block(s) as config, ask backend for synthetic indicator sample (here: just local signal visualization for demo)
      // (Ideally: Would hit a /indicator/preview endpoint - if not present, show overlay, else plot block values on price chart.)
      // We'll just highlight chart and overlay fake signals for UI preview
      setPreview({
        price: priceData && priceData.prices ? priceData.prices : priceData,
        // signals, indicators can be added here if backend supports /indicator/preview
        signals: [],
      });
    } catch (e) {
      setPreviewError(
        e?.message ||
          "Could not fetch sample data/preview for this strategy's blocks."
      );
    } finally {
      setPreviewLoad(false);
    }
  }

  // When builder changes or preview asset/range changes, refresh preview
  useEffect(() => {
    updatePreview();
    // eslint-disable-next-line
  }, [blocks, previewAsset, previewRange.start, previewRange.end]);

  // -------- UI Rendering ---------
  return (
    <section className="builder">
      <h2>Strategy Builder</h2>
      {error && <div className="error">{error}</div>}

      {!editing && (
        <>
          <div>
            <button
              className="btn"
              onClick={handleNew}
              style={{ marginBottom: 15 }}
              disabled={loading}
            >
              + Create New Strategy
            </button>
          </div>
          <div className="builder-list">
            {strategies.map((s) => (
              <div key={s.id} className="builder-strategy-card">
                <div className="builder-strategy-title">{s.name}</div>
                <div style={{ color: "#888", fontSize: ".97em" }}>
                  {s.description || "No description."}
                </div>
                <div style={{ fontSize: "0.88em" }}>
                  {s.config_json?.blocks?.length
                    ? `${s.config_json.blocks.length} indicator block(s)`
                    : "No indicator blocks"}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn"
                    onClick={() => handleEdit(s.id)}
                    style={{ marginRight: 6, fontSize: 14, padding: "2px 10px" }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn"
                    style={{
                      background: "#ea4335",
                      color: "#fff",
                      fontSize: 14,
                      padding: "2px 10px",
                    }}
                    onClick={() => handleDelete(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ padding: 30 }}>Loading strategies…</div>
            )}
            {strategies.length === 0 && !loading && (
              <div style={{ color: "#888" }}>
                No strategies yet. Click <b>Create New Strategy</b> to start.
              </div>
            )}
          </div>
        </>
      )}

      {/* EDITOR PANEL */}
      {editing && (
        <div className="builder-edit-card" style={{
          marginTop: 25,
          padding: 18,
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          background: "var(--bg-secondary)"
        }}>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <label>
              Name:
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ marginLeft: 8, maxWidth: 260 }}
                required
                autoFocus
                maxLength={48}
              />
            </label>
            <label>
              Description:
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ marginLeft: 8, maxWidth: 320 }}
                maxLength={120}
                placeholder="(optional)"
              />
            </label>

            <div style={{ margin: "18px 0 6px", fontWeight: 600 }}>Strategy Indicator Blocks:</div>

            {/* Drag-and-drop blocks */}
            <div
              className="builder-block-chain"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 11,
                marginBottom: 8,
                minHeight: 80,
              }}
            >
              {blocks.length === 0 && (
                <div style={{ color: "#888", fontStyle: "italic" }}>Add indicator blocks below.</div>
              )}
              {blocks.map((block, ix) => {
                const indicatorDef = INDICATORS.find((i) => i.type === block.type);
                return (
                  <div
                    key={ix}
                    className="builder-block-wrapper"
                    style={{ background: "#f2f2f8", borderRadius: 7, padding: 10 }}
                    draggable
                    onDragStart={onBlockDragStart(ix)}
                    onDragOver={onBlockDragOver(ix)}
                    onDrop={onBlockDrop}
                  >
                    <IndicatorBlock
                      type={block.type}
                      label={indicatorDef ? indicatorDef.label : block.type}
                      params={indicatorDef ? indicatorDef.params : []}
                      values={block.params}
                      onChange={(pname, val) =>
                        updateBlockParam(ix, pname, val)
                      }
                      onRemove={() => removeBlock(ix)}
                    />
                  </div>
                );
              })}
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Add Indicator Block:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {INDICATORS.map((indicator) => (
                  <div
                    key={indicator.type}
                    draggable
                    onDragStart={e => onDragStart(e, indicator)}
                    style={{
                      cursor: "grab",
                      background: "#dbeafe",
                      padding: "5px 14px",
                      borderRadius: 6,
                      fontSize: 15,
                      fontWeight: 500,
                      userSelect: "none",
                      border: "1px solid #aac",
                    }}
                    title={"Drag or click to add " + indicator.label}
                    tabIndex={0}
                    onClick={() => onDrop(indicator)}
                  >
                    {indicator.type}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ margin: "18px 0 0" }}>
              <strong>Preview (with chart):</strong>
              <div style={{ margin: "8px 0" }}>
                <label>
                  Asset:&nbsp;
                  <input
                    type="text"
                    value={previewAsset}
                    onChange={e => setPreviewAsset(e.target.value)}
                    style={{ width: 60 }}
                  />
                </label>
                <label style={{ marginLeft: 18 }}>
                  Date Range:&nbsp;
                  <input
                    style={{ width: 108 }}
                    type="date"
                    value={previewRange.start}
                    onChange={e =>
                      setPreviewRange({ ...previewRange, start: e.target.value })
                    }
                  />
                  &nbsp;to&nbsp;
                  <input
                    style={{ width: 108 }}
                    type="date"
                    value={previewRange.end}
                    onChange={e =>
                      setPreviewRange({ ...previewRange, end: e.target.value })
                    }
                  />
                </label>
                <button
                  className="btn"
                  style={{ fontSize: 13, marginLeft: 14, padding: "3px 11px" }}
                  type="button"
                  onClick={updatePreview}
                  disabled={previewLoad}
                >
                  Refresh Chart
                </button>
              </div>
              {previewLoad ? (
                <div>Loading preview…</div>
              ) : previewError ? (
                <div className="error">{previewError}</div>
              ) : preview && preview.price && Array.isArray(preview.price) ? (
                <div style={{ width: "100%", minHeight: 180, maxWidth: 600 }}>
                  <PreviewChart data={preview.price} blocks={blocks} />
                </div>
              ) : (
                <div style={{ color: "#aaa", fontStyle: "italic", margin: "7px 0" }}>
                  No preview available (add blocks and adjust asset/range).
                </div>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <button className="btn" type="submit" disabled={loading}>
                {selected ? "Save Changes" : "Create Strategy"}
              </button>
              <button
                className="btn"
                style={{
                  background: "#ddd",
                  color: "#222",
                  marginLeft: 13,
                  fontWeight: 500,
                }}
                type="button"
                onClick={() => { setEditing(false); setSelected(null); }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .builder-block {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .builder-block .drag-handle {
          cursor: grab;
          font-size: 1.3em;
          margin-right: 8px;
          color: #888;
        }
        .builder-edit-card label {
          font-weight: 500;
          margin-right: 10px;
        }
        .builder-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1.3rem;
        }
        .builder-strategy-card {
          min-width: 220px;
          padding: 1.2rem;
          border-radius: 10px;
          border: 1px solid var(--border-color,#e9ecef);
          background: var(--bg-secondary,#f8f9fa);
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          margin-bottom: 6px;
        }
        @media (max-width:650px){
          .builder-list{flex-direction:column;}
        }
      `}</style>
    </section>
  );
}

// Chart preview (price and indicators)
function PreviewChart({ data, blocks }) {
  // We'll display price as area/line and overlay indicator dummy lines
  // (If backend data provides indicator time series, render them; otherwise just show price)
  const availableIndicators = blocks.map((b) => b.type);

  // Process input data: expect [{ts, close, open, high, low, ...}]
  const series = Array.isArray(data)
    ? data.map((d, i) => ({
        date: d.ts || d.datetime || d.date || i,
        Price: d.close || d.price || d.Close || 0,
        ...d,
      }))
    : [];

  // Demo overlay: randomly generated sample indicator lines if not present
  const addFake = (key, amp = 1) =>
    series.length > 0
      ? series.map((row, i) => ({
          ...row,
          [key]:
            row.Price +
            Math.sin(i / 6 + key.length) *
              amp *
              ((row.Price || 0) * 0.05 + Math.random() * 0.012 * amp),
        }))
      : [];

  let chartSeries = series;
  if (
    chartSeries.length > 0 &&
    availableIndicators.length > 0 &&
    !chartSeries[0][availableIndicators[0]]
  ) {
    // Add a fake indicator for demonstration
    chartSeries = addFake(availableIndicators[0]);
  }

  return (
    <ResponsiveContainer width="99%" aspect={2.1} minHeight={140} height={220}>
      <LineChart data={chartSeries}>
        <CartesianGrid strokeDasharray="4 4" opacity={0.15} />
        <XAxis dataKey="date" tickFormatter={v => (typeof v === "string" ? v.slice(5,10) : v)} minTickGap={15} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area
          type="monotone"
          dataKey="Price"
          stroke="#8884d8"
          fill="#e3e8fe"
          fillOpacity={0.18}
          name="Price"
        />
        <Line
          type="monotone"
          dataKey={availableIndicators[0] || "demo"}
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name={availableIndicators[0]}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

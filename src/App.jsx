import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const TARGET_WEIGHT = 180;
const SPLITS = ["Chest", "Back", "Quads", "Hamstrings", "Shoulders"];

const C = {
bg:       "#080808",
surface:  "#111111",
elevated: "#1a1a1a",
border:   "#222222",
red:      "#c0392b",
redDim:   "#7a2318",
redGlow:  "#c0392b22",
text:     "#f0f0f0",
muted:    "#666666",
dim:      "#3a3a3a",
white:    "#ffffff",
};

const todayKey = () =>
new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

const MacroDot = (props) => {
const { cx, cy, payload } = props;
if (cx == null || cy == null) return null;
const color = payload.macrosOnTrack === true ? C.red : payload.macrosOnTrack === false ? C.dim : C.muted;
return <circle cx={cx} cy={cy} r={4} fill={color} stroke={C.bg} strokeWidth={1.5} />;
};

const ActiveDot = (props) => {
const { cx, cy, payload } = props;
if (cx == null || cy == null) return null;
const color = payload.macrosOnTrack === true ? C.red : payload.macrosOnTrack === false ? C.dim : C.muted;
return <circle cx={cx} cy={cy} r={6} fill={C.white} stroke={color} strokeWidth={2} />;
};

const Picker = ({ label, value, onChange, options }) => (

  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: "'Times New Roman', serif", fontStyle: "italic" }}>{label}</span>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button key={String(opt.value)} onClick={() => onChange(opt.value)} style={{
            background: active ? C.red : "transparent", color: active ? C.white : C.muted,
            border: `1px solid ${active ? C.red : C.border}`, borderRadius: 4,
            padding: "8px 16px", fontSize: 13, fontWeight: active ? 600 : 400,
            cursor: "pointer", transition: "all 0.2s", fontFamily: "'Times New Roman', serif",
            letterSpacing: "0.04em", boxShadow: active ? `0 0 12px ${C.redGlow}` : "none",
          }}>{opt.label}</button>
        );
      })}
    </div>
  </div>
);

const StatCard = ({ label, value, sub, accent }) => (

  <div style={{
    background: C.surface, border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent ? C.red : C.border}`,
    borderRadius: 6, padding: "18px 16px",
  }}>
    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "'Times New Roman', serif", fontStyle: "italic", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: accent ? C.red : C.text, fontFamily: "'Times New Roman', serif", lineHeight: 1 }}>{value ?? "—"}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontFamily: "'Times New Roman', serif" }}>{sub}</div>}
  </div>
);

const ChartTip = ({ active, payload, label }) => {
if (!active || !payload?.length) return null;
const d = payload[0]?.payload;
return (
<div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px" }}>
<div style={{ fontSize: 10, color: C.muted, fontFamily: "‘Times New Roman’, serif", marginBottom: 4 }}>{label}</div>
<div style={{ fontSize: 18, fontWeight: 700, color: C.red, fontFamily: "‘Times New Roman’, serif" }}>{payload[0].value} lbs</div>
{d?.macrosOnTrack !== null && d?.macrosOnTrack !== undefined && (
<div style={{ fontSize: 11, marginTop: 4, fontFamily: "‘Times New Roman’, serif", color: d.macrosOnTrack ? C.red : C.muted }}>
Macros: {d.macrosOnTrack ? "Hit" : "Missed"}
</div>
)}
</div>
);
};

const Divider = () => <div style={{ height: 1, background: C.border, margin: "4px 0" }} />;

const Tab = ({ id, label, view, setView }) => (
<button onClick={() => setView(id)} style={{
background: "transparent", border: "none",
borderBottom: `2px solid ${view === id ? C.red : "transparent"}`,
color: view === id ? C.white : C.muted,
padding: "12px 24px", fontSize: 11, fontWeight: view === id ? 700 : 400,
cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.18em",
fontFamily: "‘Times New Roman’, serif", transition: "all 0.2s",
}}>{label}</button>
);

export default function App() {
const [entries, setEntries] = useState(() => {
try { return JSON.parse(localStorage.getItem("kyle-tracker-v3") || "[]"); }
catch { return []; }
});
const [view,        setView]        = useState("log");
const [saved,       setSaved]       = useState(false);
const [importMsg,   setImportMsg]   = useState("");
const [form, setForm] = useState({
weight: "", macrosOnTrack: null, trained: null,
muscleGroup: "", energy: null, sleep: null, hunger: null, gymPerf: null,
});

useEffect(() => {
try { localStorage.setItem("kyle-tracker-v3", JSON.stringify(entries)); }
catch {}
}, [entries]);

const today      = todayKey();
const todayEntry = entries.find(e => e.date === today);

const handleSave = () => {
if (!form.weight) return;
const entry = { date: today, ts: Date.now(), weight: parseFloat(form.weight), …form };
const newEntries = […entries.filter(e => e.date !== today), entry].sort((a, b) => a.ts - b.ts);
setEntries(newEntries);
setSaved(true);
setTimeout(() => setSaved(false), 2200);
};

const handleExport = () => {
if (!entries.length) return;
const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
const url  = URL.createObjectURL(blob);
const a    = document.createElement("a");
a.href     = url;
a.download = "kyle-tracker-backup.json";
a.click();
URL.revokeObjectURL(url);
};

const handleImport = (e) => {
const file = e.target.files?.[0];
if (!file) return;
const reader = new FileReader();
reader.onload = ev => {
try {
const data = JSON.parse(ev.target.result);
if (Array.isArray(data)) {
const sorted = data.sort((a, b) => a.ts - b.ts);
setEntries(sorted);
localStorage.setItem("kyle-tracker-v3", JSON.stringify(sorted));
setImportMsg("Restored");
setTimeout(() => setImportMsg(""), 2500);
}
} catch {
setImportMsg("Invalid file");
setTimeout(() => setImportMsg(""), 2500);
}
};
reader.readAsText(file);
e.target.value = "";
};

const last7           = entries.slice(-7);
const avgWeight       = last7.length ? (last7.reduce((s, e) => s + e.weight, 0) / last7.length).toFixed(1) : null;
const macroPool       = entries.filter(e => e.macrosOnTrack !== null);
const macroCompliance = macroPool.length ? Math.round((macroPool.filter(e => e.macrosOnTrack).length / macroPool.length) * 100) : null;
const streak          = (() => { let s = 0; for (const e of […entries].reverse()) { if (e.macrosOnTrack) s++; else break; } return s; })();
const toTarget        = avgWeight ? Math.max(0, parseFloat(avgWeight) - TARGET_WEIGHT).toFixed(1) : null;
const chartEntries    = entries.slice(-7);
const chartWeights    = chartEntries.map(e => e.weight);
const chartMin        = chartWeights.length ? Math.floor(Math.min(…chartWeights, TARGET_WEIGHT) - 3) : 170;
const chartMax        = chartWeights.length ? Math.ceil(Math.max(…chartWeights) + 3) : 195;

const inp = {
background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 4,
color: C.text, fontSize: 16, padding: "14px 16px", width: "100%",
fontFamily: "‘Times New Roman’, serif", outline: "none",
boxSizing: "border-box", letterSpacing: "0.04em", transition: "border-color 0.2s",
};

const backupBtnStyle = {
flex: 1, background: "transparent", border: `1px solid ${C.border}`,
borderRadius: 4, padding: "12px", fontSize: 11, color: C.muted,
fontFamily: "‘Times New Roman’, serif", letterSpacing: "0.15em",
textTransform: "uppercase", textAlign: "center", cursor: "pointer",
transition: "all 0.2s", display: "block",
};

return (
<div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "‘Times New Roman’, serif", paddingBottom: 80 }}>

```
  {/* HEADER */}
  <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 24px 0" }}>
      <div>
        <div style={{ fontSize: 9, color: C.red, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 6 }}>Post-Show Rebuild</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>Kyle Boone</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Target</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.red, lineHeight: 1 }}>{TARGET_WEIGHT}</div>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>lbs</div>
      </div>
    </div>
    <div style={{ height: 1, background: `linear-gradient(90deg, ${C.red}, transparent)`, margin: "16px 24px 0" }} />
    <div style={{ display: "flex", paddingLeft: 12 }}>
      <Tab id="log"   label="Log"   view={view} setView={setView} />
      <Tab id="stats" label="Stats" view={view} setView={setView} />
    </div>
  </div>

  <div style={{ padding: "28px 20px 0" }}>

    {/* ── LOG TAB ── */}
    {view === "log" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.02em" }}>{today}</div>
          {todayEntry && (
            <div style={{ fontSize: 11, color: C.red, letterSpacing: "0.1em", fontStyle: "italic" }}>
              Logged — {todayEntry.weight} lbs
            </div>
          )}
        </div>
        <Divider />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.18em", fontStyle: "italic" }}>Morning Weight (lbs)</span>
          <input type="number" step="0.1" placeholder="181.4" value={form.weight}
            onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={inp} />
          {form.weight && avgWeight && (
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.04em" }}>
              7-day avg: <span style={{ color: C.text }}>{avgWeight} lbs</span>{"  ·  "}
              {parseFloat(form.weight) <= TARGET_WEIGHT
                ? <span style={{ color: C.red }}>At target</span>
                : <span style={{ color: C.red }}>{(parseFloat(form.weight) - TARGET_WEIGHT).toFixed(1)} lbs above target</span>}
            </div>
          )}
        </div>
        <Picker label="Macros on track" value={form.macrosOnTrack}
          onChange={v => setForm(f => ({ ...f, macrosOnTrack: v }))}
          options={[{ value: true, label: "On Track" }, { value: false, label: "Off Track" }]} />
        <Picker label="Training" value={form.trained}
          onChange={v => setForm(f => ({ ...f, trained: v, muscleGroup: v ? f.muscleGroup : "" }))}
          options={[{ value: true, label: "Trained" }, { value: false, label: "Rest Day" }]} />
        {form.trained && (
          <Picker label="Muscle Group" value={form.muscleGroup}
            onChange={v => setForm(f => ({ ...f, muscleGroup: v }))}
            options={SPLITS.map(s => ({ value: s, label: s }))} />
        )}
        {form.trained && (
          <Picker label="Gym Performance" value={form.gymPerf}
            onChange={v => setForm(f => ({ ...f, gymPerf: v }))}
            options={[
              { value: "bad",     label: "Bad"     },
              { value: "average", label: "Average" },
              { value: "good",    label: "Good"    },
              { value: "great",   label: "Great"   },
            ]} />
        )}
        <Picker label="Energy Level" value={form.energy}
          onChange={v => setForm(f => ({ ...f, energy: v }))}
          options={[1,2,3,4,5].map(n => ({ value: n, label: String(n) }))} />
        <Picker label="Sleep Quality" value={form.sleep}
          onChange={v => setForm(f => ({ ...f, sleep: v }))}
          options={[1,2,3,4,5].map(n => ({ value: n, label: String(n) }))} />
        <Picker label="Hunger" value={form.hunger}
          onChange={v => setForm(f => ({ ...f, hunger: v }))}
          options={[
            { value: "low",      label: "Low"      },
            { value: "normal",   label: "Normal"   },
            { value: "high",     label: "High"     },
            { value: "ravenous", label: "Ravenous" },
          ]} />
        <Divider />
        <button onClick={handleSave} disabled={!form.weight} style={{
          background: form.weight ? C.red : "transparent",
          color:      form.weight ? C.white : C.dim,
          border:     `1px solid ${form.weight ? C.red : C.border}`,
          borderRadius: 4, padding: "18px", fontSize: 13, fontWeight: 700,
          cursor: form.weight ? "pointer" : "not-allowed",
          fontFamily: "'Times New Roman', serif", letterSpacing: "0.2em",
          textTransform: "uppercase", transition: "all 0.2s",
          boxShadow: form.weight ? `0 4px 24px ${C.redGlow}` : "none",
        }}>{saved ? "Saved" : "Log Today"}</button>
      </div>
    )}

    {/* ── STATS TAB ── */}
    {view === "stats" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {entries.length === 0 ? (
          <div style={{ color: C.muted, textAlign: "center", padding: "80px 0", fontSize: 14, fontStyle: "italic", letterSpacing: "0.06em" }}>
            No data yet. Begin logging.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <StatCard label="7-Day Average"    value={avgWeight ? `${avgWeight}` : "—"} sub="lbs" accent={true} />
              <StatCard label="To Target"        value={toTarget !== null ? `${toTarget}` : "—"} sub="lbs remaining" />
              <StatCard label="Macro Compliance" value={macroCompliance !== null ? `${macroCompliance}%` : "—"} accent={macroCompliance !== null && macroCompliance >= 80} />
              <StatCard label="Current Streak"   value={streak} sub="days on track" accent={streak >= 3} />
            </div>

            {/* Chart */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "20px 8px 12px" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em", fontStyle: "italic", marginBottom: 16, paddingLeft: 12 }}>
                Weight Trend — Last 7 Days
              </div>
              <div style={{ display: "flex", gap: 16, paddingLeft: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />
                  <span style={{ fontSize: 10, color: C.muted, fontFamily: "'Times New Roman', serif", fontStyle: "italic" }}>Macros hit</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.dim }} />
                  <span style={{ fontSize: 10, color: C.muted, fontFamily: "'Times New Roman', serif", fontStyle: "italic" }}>Macros missed</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={chartEntries.map(e => ({ date: e.date, weight: e.weight, macrosOnTrack: e.macrosOnTrack }))}
                  margin={{ top: 4, right: 12, left: -16, bottom: 0 }}
                >
                  <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9, fontFamily: "'Times New Roman', serif" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[chartMin, chartMax]} tick={{ fill: C.muted, fontSize: 9, fontFamily: "'Times New Roman', serif" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <ReferenceLine y={TARGET_WEIGHT} stroke={C.redDim} strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="weight" stroke={C.redDim} strokeWidth={1.5}
                    dot={<MacroDot />} activeDot={<ActiveDot />} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 10, color: C.redDim, textAlign: "right", paddingRight: 14, fontStyle: "italic" }}>
                — {TARGET_WEIGHT} lb target
              </div>
            </div>

            {/* All logged days */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em",
                fontStyle: "italic", padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>Logged Days</span>
                <span style={{ color: C.dim }}>{entries.length}</span>
              </div>
              {[...entries].reverse().map((e, i, arr) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 3 }}>{e.date}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                      {e.weight} lbs
                      {e.muscleGroup && <span style={{ color: C.muted, fontWeight: 400 }}> · {e.muscleGroup}</span>}
                      {e.trained === false && <span style={{ color: C.muted, fontWeight: 400 }}> · Rest</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    {e.macrosOnTrack !== null && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.macrosOnTrack ? C.red : C.dim, flexShrink: 0 }} />
                    )}
                    {e.gymPerf && (
                      <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{e.gymPerf}</span>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      {e.energy && <span style={{ fontSize: 10, color: C.muted }}>E{e.energy}</span>}
                      {e.sleep  && <span style={{ fontSize: 10, color: C.muted }}>S{e.sleep}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )}

    {/* ── BACKUP ROW — always visible ── */}
    <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
      <button onClick={handleExport} style={{
        ...backupBtnStyle,
        opacity: entries.length ? 1 : 0.4,
        cursor: entries.length ? "pointer" : "not-allowed",
      }}>Export Backup</button>

      <label style={backupBtnStyle}>
        {importMsg || "Import Backup"}
        <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
      </label>
    </div>

  </div>

  <style>{`
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    input::placeholder { color: #444; }
    input:focus { border-color: #c0392b !important; }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    body { margin: 0; background: #080808; }
  `}</style>
</div>
```

);
}

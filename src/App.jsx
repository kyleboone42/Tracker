import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const OWNER = "Kyle Boone";
const PHASE = "Post-Show Rebuild";

const SPLITS = ["Chest", "Back", "Quads", "Hamstrings", "Shoulders"];
const HUNGER = ["low", "normal", "high", "ravenous"];
const GYM_PERF = ["bad", "average", "good", "great"];

const STORAGE_KEY = "tracker-entries-v4";
const LEGACY_KEY = "kyle-tracker-v3";
const TARGET_KEY = "kyle-target-weight";
const EXPORT_KEY = "tracker-last-export";

const FONT = "'Times New Roman', Times, serif";

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

/* ── Dates (all local time, keyed as YYYY-MM-DD) ── */

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const isoToDate = (iso) => new Date(iso + "T12:00:00");
const addDays = (iso, n) => { const d = isoToDate(iso); d.setDate(d.getDate() + n); return toISO(d); };
const daysBetween = (a, b) => Math.round((isoToDate(b) - isoToDate(a)) / 86400000);
const fmtShort = (iso) => isoToDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtLong = (iso) => isoToDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ── Entry normalization (also migrates v3 entries keyed "Mar 28") ── */

const asBool = (v) => (v === true || v === false ? v : null);
const asRating = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
const asChoice = (v, list) => (list.includes(v) ? v : null);

const normalizeEntry = (e) => {
  if (!e || typeof e !== "object") return null;
  const date = typeof e.date === "string" && ISO_RE.test(e.date)
    ? e.date
    : Number.isFinite(e.ts) ? toISO(new Date(e.ts)) : null;
  const weight = parseFloat(e.weight);
  if (!date || !Number.isFinite(weight) || weight <= 0) return null;
  const trained = asBool(e.trained);
  return {
    date,
    weight,
    macrosOnTrack:   asBool(e.macrosOnTrack),
    caloriesOnTrack: asBool(e.caloriesOnTrack),
    trained,
    muscleGroup: trained && SPLITS.includes(e.muscleGroup) ? e.muscleGroup : "",
    gymPerf:     trained ? asChoice(e.gymPerf, GYM_PERF) : null,
    energy: asRating(e.energy),
    sleep:  asRating(e.sleep),
    hunger: asChoice(e.hunger, HUNGER),
  };
};

// Dedupe by date (later wins) and sort chronologically.
const cleanEntries = (list) => {
  const byDate = new Map();
  for (const raw of list) { const e = normalizeEntry(raw); if (e) byDate.set(e.date, e); }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

const loadEntries = () => {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return cleanEntries(JSON.parse(current));
    // Legacy data is left in place untouched as a fallback.
    const legacy = localStorage.getItem(LEGACY_KEY);
    return legacy ? cleanEntries(JSON.parse(legacy)) : [];
  } catch { return []; }
};

const readStored = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

const EMPTY_FORM = {
  weight: "", macrosOnTrack: null, caloriesOnTrack: null, trained: null,
  muscleGroup: "", energy: null, sleep: null, hunger: null, gymPerf: null,
};

const entryToForm = (e) => ({ ...EMPTY_FORM, ...e, weight: String(e.weight) });

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── Components ── */

const dotColor = (payload) =>
  payload.macrosOnTrack === true ? C.red : payload.macrosOnTrack === false ? C.dim : C.muted;

const MacroDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={dotColor(payload)} stroke={C.bg} strokeWidth={1.5} />;
};

const ActiveDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={6} fill={C.white} stroke={dotColor(payload)} strokeWidth={2} />;
};

const Label = ({ children }) => (
  <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.18em", fontStyle: "italic" }}>{children}</span>
);

const Picker = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <Label>{label}</Label>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button key={String(opt.value)} onClick={() => onChange(active ? null : opt.value)} style={{
            background: active ? C.red : "transparent", color: active ? C.white : C.muted,
            border: `1px solid ${active ? C.red : C.border}`, borderRadius: 4,
            padding: "8px 16px", fontSize: 13, fontWeight: active ? 600 : 400,
            cursor: "pointer", transition: "all 0.2s", fontFamily: FONT,
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
    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em", fontStyle: "italic", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: accent ? C.red : C.text, lineHeight: 1 }}>{value ?? "—"}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{sub}</div>}
  </div>
);

const ChartTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 14px", fontFamily: FONT }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{fmtLong(d.date)}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>{d.weight} lbs</div>
      {d.macrosOnTrack !== null && (
        <div style={{ fontSize: 11, marginTop: 4, color: d.macrosOnTrack ? C.red : C.muted }}>
          Macros: {d.macrosOnTrack ? "Hit" : "Missed"}
        </div>
      )}
      {d.caloriesOnTrack !== null && (
        <div style={{ fontSize: 11, marginTop: 2, color: d.caloriesOnTrack ? C.red : C.muted }}>
          Calories: {d.caloriesOnTrack ? "Hit" : "Missed"}
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
    fontFamily: FONT, transition: "all 0.2s",
  }}>{label}</button>
);

const ghostBtn = {
  flex: 1, background: "transparent", border: `1px solid ${C.border}`,
  borderRadius: 4, padding: "12px", fontSize: 11, color: C.muted,
  fontFamily: FONT, letterSpacing: "0.15em", textTransform: "uppercase",
  textAlign: "center", transition: "all 0.2s",
};

/* ── App ── */

export default function App() {
  const [entries, setEntries] = useState(loadEntries);
  const [targetWeight, setTargetWeight] = useState(() => {
    const v = parseFloat(readStored(TARGET_KEY, "180"));
    return Number.isFinite(v) && v > 0 ? v : 180;
  });
  const [lastExport, setLastExport] = useState(() => readStored(EXPORT_KEY, null));
  const [targetInput,   setTargetInput]   = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [view,      setView]      = useState("log");
  const [saved,     setSaved]     = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [logDate,   setLogDate]   = useState(todayISO);
  const [form,      setForm]      = useState(EMPTY_FORM);

  const today = todayISO();
  const existingEntry = entries.find(e => e.date === logDate);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }, [entries]);

  useEffect(() => {
    try { localStorage.setItem(TARGET_KEY, String(targetWeight)); } catch {}
  }, [targetWeight]);

  // Ask the browser not to evict our data under storage pressure.
  useEffect(() => { navigator.storage?.persist?.().catch(() => {}); }, []);

  // Load the selected day into the form (or clear it) whenever the date changes.
  useEffect(() => {
    const e = entries.find(x => x.date === logDate);
    setForm(e ? entryToForm(e) : EMPTY_FORM);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate]);

  const weightNum = parseFloat(form.weight);
  const weightValid = Number.isFinite(weightNum) && weightNum > 0;

  const handleSave = () => {
    const entry = normalizeEntry({ ...form, date: logDate });
    if (!entry) return;
    setEntries(prev => cleanEntries([...prev.filter(e => e.date !== logDate), entry]));
    setForm(entryToForm(entry));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleDelete = (date) => {
    if (!window.confirm(`Delete entry for ${fmtLong(date)}?`)) return;
    setEntries(prev => prev.filter(e => e.date !== date));
    if (date === logDate) setForm(EMPTY_FORM);
  };

  const handleEdit = (date) => {
    setLogDate(date);
    setView("log");
    window.scrollTo({ top: 0 });
  };

  const handleTargetSave = () => {
    const val = parseFloat(targetInput);
    if (Number.isFinite(val) && val > 0) setTargetWeight(val);
    setEditingTarget(false);
    setTargetInput("");
  };

  const flash = (msg) => { setImportMsg(msg); setTimeout(() => setImportMsg(""), 2500); };

  const handleExport = () => {
    if (!entries.length) return;
    const payload = { version: 4, exportedAt: new Date().toISOString(), targetWeight, entries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `tracker-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExport(today);
    try { localStorage.setItem(EXPORT_KEY, today); } catch {}
  };

  const handleImport = (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let data;
      try { data = JSON.parse(e.target.result); } catch { flash("Invalid file"); return; }
      // Accept both the old bare-array format and the v4 object format.
      const list = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : null;
      const incoming = list ? cleanEntries(list) : [];
      if (!incoming.length) { flash("No valid entries"); return; }
      const overlap = incoming.filter(x => entries.some(y => y.date === x.date)).length;
      const msg = `Import ${incoming.length} entries?` +
        (overlap ? ` ${overlap} existing day${overlap === 1 ? "" : "s"} will be overwritten.` : "") +
        " Other existing entries are kept.";
      if (!window.confirm(msg)) return;
      setEntries(prev => cleanEntries([...prev, ...incoming]));
      const t = parseFloat(data?.targetWeight);
      if (Number.isFinite(t) && t > 0) setTargetWeight(t);
      flash(`Imported ${incoming.length}`);
    };
    reader.readAsText(file);
  };

  /* ── Stats ── */

  const byDate = Object.fromEntries(entries.map(e => [e.date, e]));
  const latest = entries.length ? entries[entries.length - 1].date : null;

  // Rolling window: the 7 calendar days ending on the most recent log.
  const windowStart = latest ? addDays(latest, -6) : null;
  const last7 = latest ? entries.filter(e => e.date >= windowStart) : [];
  const mean = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;

  const avgWeightNum = mean(last7.map(e => e.weight));
  const avgWeight    = avgWeightNum !== null ? avgWeightNum.toFixed(1) : null;
  const staleDays    = latest ? daysBetween(latest, today) : 0;

  const pct = (pool, key) => pool.length ? Math.round(pool.filter(e => e[key]).length / pool.length * 100) : null;
  const macroCompliance = pct(entries.filter(e => e.macrosOnTrack !== null), "macrosOnTrack");
  const calCompliance   = pct(entries.filter(e => e.caloriesOnTrack !== null), "caloriesOnTrack");

  // Consecutive calendar days with macros hit, ending today — or yesterday if today's macros aren't answered yet.
  const streak = (() => {
    let d = byDate[today]?.macrosOnTrack != null ? today : addDays(today, -1);
    let s = 0;
    while (byDate[d]?.macrosOnTrack === true) { s++; d = addDays(d, -1); }
    return s;
  })();

  const diff     = avgWeightNum !== null ? avgWeightNum - targetWeight : null;
  const toTarget = diff !== null ? Math.abs(diff).toFixed(1) : null;
  const toTargetSub = diff === null ? "" : Math.abs(diff) < 0.05 ? "at target" : diff > 0 ? "lbs to lose" : "lbs to gain";

  const allWeights = entries.map(e => e.weight);
  const chartMin = allWeights.length ? Math.floor(Math.min(...allWeights, targetWeight) - 3) : targetWeight - 15;
  const chartMax = allWeights.length ? Math.ceil(Math.max(...allWeights, targetWeight) + 3) : targetWeight + 15;

  // Recovery snapshot over the same 7-day window.
  const avgEnergy = mean(last7.map(e => e.energy).filter(v => v !== null));
  const avgSleep  = mean(last7.map(e => e.sleep).filter(v => v !== null));
  const trainingDays = last7.filter(e => e.trained === true).length;
  const hungerMode = (() => {
    const counts = {};
    for (const e of last7) if (e.hunger) counts[e.hunger] = (counts[e.hunger] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? capitalize(top[0]) : null;
  })();

  const daysSinceExport = lastExport && ISO_RE.test(lastExport) ? daysBetween(lastExport, today) : null;
  const backupOverdue = entries.length > 0 && (daysSinceExport === null || daysSinceExport > 7);
  const backupNote = daysSinceExport === null ? "Never backed up"
    : daysSinceExport === 0 ? "Backed up today"
    : `Last backup ${daysSinceExport} day${daysSinceExport === 1 ? "" : "s"} ago`;

  const inp = {
    background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 4,
    color: C.text, fontSize: 16, padding: "14px 16px", width: "100%",
    fontFamily: FONT, outline: "none",
    boxSizing: "border-box", letterSpacing: "0.04em", transition: "border-color 0.2s",
  };

  const dateInp = {
    background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 4,
    color: C.text, fontSize: 16, padding: "12px 14px",
    fontFamily: FONT, outline: "none",
    colorScheme: "dark", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT, paddingBottom: 80 }}>

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 24px 0" }}>
          <div>
            <div style={{ fontSize: 9, color: C.red, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 6 }}>{PHASE}</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>{OWNER}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Target</div>
            {editingTarget ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="number" step="0.1" inputMode="decimal" placeholder={String(targetWeight)}
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleTargetSave(); if (e.key === "Escape") { setEditingTarget(false); setTargetInput(""); } }}
                  autoFocus
                  style={{ width: 72, background: C.elevated, border: `1px solid ${C.red}`, borderRadius: 4, color: C.text, fontSize: 16, padding: "4px 8px", fontFamily: FONT, outline: "none", textAlign: "right" }}
                />
                <button onClick={handleTargetSave} style={{ background: C.red, border: "none", borderRadius: 4, color: C.white, fontSize: 11, padding: "4px 8px", cursor: "pointer", fontFamily: FONT }}>Set</button>
              </div>
            ) : (
              <div onClick={() => { setEditingTarget(true); setTargetInput(String(targetWeight)); }} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.red, lineHeight: 1 }}>{targetWeight}</div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginTop: 2 }}>lbs · tap to edit</div>
              </div>
            )}
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

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Label>Date</Label>
              <input type="date" value={logDate} max={today}
                onChange={e => { if (ISO_RE.test(e.target.value)) setLogDate(e.target.value); }} style={dateInp} />
              {existingEntry && (
                <div style={{ fontSize: 11, color: C.red, fontStyle: "italic", letterSpacing: "0.06em", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Editing logged day — saving will update it.</span>
                  <span onClick={() => handleDelete(logDate)} style={{ cursor: "pointer", textDecoration: "underline" }}>Delete</span>
                </div>
              )}
            </div>

            <Divider />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Label>Morning Weight (lbs)</Label>
              <input type="number" step="0.1" inputMode="decimal" placeholder="181.4" value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={inp} />
              {weightValid && (
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.04em" }}>
                  {avgWeight && <>7-day avg: <span style={{ color: C.text }}>{avgWeight} lbs</span>{"  ·  "}</>}
                  <span style={{ color: C.red }}>
                    {Math.abs(weightNum - targetWeight) < 0.05 ? "At target"
                      : `${Math.abs(weightNum - targetWeight).toFixed(1)} lbs ${weightNum > targetWeight ? "above" : "below"} target`}
                  </span>
                </div>
              )}
            </div>

            <Picker label="Macros on track" value={form.macrosOnTrack}
              onChange={v => setForm(f => ({ ...f, macrosOnTrack: v }))}
              options={[{ value: true, label: "On Track" }, { value: false, label: "Off Track" }]} />

            <Picker label="Calories on track" value={form.caloriesOnTrack}
              onChange={v => setForm(f => ({ ...f, caloriesOnTrack: v }))}
              options={[{ value: true, label: "On Track" }, { value: false, label: "Off Track" }]} />

            <Picker label="Training" value={form.trained}
              onChange={v => setForm(f => ({ ...f, trained: v, ...(v ? {} : { muscleGroup: "", gymPerf: null }) }))}
              options={[{ value: true, label: "Trained" }, { value: false, label: "Rest Day" }]} />

            {form.trained && (
              <Picker label="Muscle Group" value={form.muscleGroup}
                onChange={v => setForm(f => ({ ...f, muscleGroup: v ?? "" }))}
                options={SPLITS.map(s => ({ value: s, label: s }))} />
            )}

            {form.trained && (
              <Picker label="Gym Performance" value={form.gymPerf}
                onChange={v => setForm(f => ({ ...f, gymPerf: v }))}
                options={GYM_PERF.map(g => ({ value: g, label: capitalize(g) }))} />
            )}

            <Picker label="Energy Level" value={form.energy}
              onChange={v => setForm(f => ({ ...f, energy: v }))}
              options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))} />

            <Picker label="Sleep Quality" value={form.sleep}
              onChange={v => setForm(f => ({ ...f, sleep: v }))}
              options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))} />

            <Picker label="Hunger" value={form.hunger}
              onChange={v => setForm(f => ({ ...f, hunger: v }))}
              options={HUNGER.map(h => ({ value: h, label: capitalize(h) }))} />

            <Divider />

            <button onClick={handleSave} disabled={!weightValid} style={{
              background: weightValid ? C.red : "transparent",
              color:      weightValid ? C.white : C.dim,
              border:     `1px solid ${weightValid ? C.red : C.border}`,
              borderRadius: 4, padding: "18px", fontSize: 13, fontWeight: 700,
              cursor: weightValid ? "pointer" : "not-allowed",
              fontFamily: FONT, letterSpacing: "0.2em",
              textTransform: "uppercase", transition: "all 0.2s",
              boxShadow: weightValid ? `0 4px 24px ${C.redGlow}` : "none",
            }}>{saved ? "Saved" : existingEntry ? "Update Day" : "Log Day"}</button>
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
                {staleDays > 7 && (
                  <div style={{ fontSize: 11, color: C.red, fontStyle: "italic", letterSpacing: "0.06em" }}>
                    Last log was {staleDays} days ago — averages reflect the week ending {fmtShort(latest)}.
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <StatCard label="7-Day Average"    value={avgWeight} sub={`lbs · ${last7.length} day${last7.length === 1 ? "" : "s"} logged`} accent={true} />
                  <StatCard label="To Target"        value={toTarget} sub={toTargetSub} />
                  <StatCard label="Macro Compliance" value={macroCompliance !== null ? `${macroCompliance}%` : null} accent={macroCompliance !== null && macroCompliance >= 80} />
                  <StatCard label="Cal Compliance"   value={calCompliance !== null ? `${calCompliance}%` : null} accent={calCompliance !== null && calCompliance >= 80} />
                </div>

                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${streak >= 3 ? C.red : C.border}`,
                  borderRadius: 6, padding: "14px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em", fontStyle: "italic" }}>Macro Streak</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: streak >= 3 ? C.red : C.text }}>
                    {streak} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>consecutive day{streak === 1 ? "" : "s"}</span>
                  </div>
                </div>

                {/* Chart */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "20px 8px 12px" }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em", fontStyle: "italic", marginBottom: 16, paddingLeft: 12 }}>
                    Weight Trend
                  </div>
                  <div style={{ display: "flex", gap: 16, paddingLeft: 12, marginBottom: 12 }}>
                    {[[C.red, "Macros hit"], [C.dim, "Macros missed"]].map(([color, text]) => (
                      <div key={text} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                        <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>{text}</span>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={entries.map(e => ({ ...e, label: fmtShort(e.date) }))} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9, fontFamily: FONT }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[chartMin, chartMax]} tick={{ fill: C.muted, fontSize: 9, fontFamily: FONT }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={targetWeight} stroke={C.redDim} strokeDasharray="4 4" strokeWidth={1} />
                      <Line type="monotone" dataKey="weight" stroke={C.redDim} strokeWidth={1.5}
                        dot={<MacroDot />} activeDot={<ActiveDot />} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 10, color: C.redDim, textAlign: "right", paddingRight: 14, fontStyle: "italic" }}>
                    — {targetWeight} lb target
                  </div>
                </div>

                {/* Recovery snapshot */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <StatCard label="Avg Energy"    value={avgEnergy !== null ? avgEnergy.toFixed(1) : null} sub="of 5 · last 7 days" />
                  <StatCard label="Avg Sleep"     value={avgSleep !== null ? avgSleep.toFixed(1) : null} sub="of 5 · last 7 days" />
                  <StatCard label="Training Days" value={trainingDays} sub="last 7 days" />
                  <StatCard label="Typical Hunger" value={hungerMode} sub="last 7 days" />
                </div>

                {/* All logged days */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.2em",
                    fontStyle: "italic", padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>Logged Days · tap to edit</span>
                    <span style={{ color: C.dim }}>{entries.length}</span>
                  </div>
                  {[...entries].reverse().map((e, i, arr) => (
                    <div key={e.date} onClick={() => handleEdit(e.date)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      padding: "12px 20px", cursor: "pointer",
                      borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginBottom: 3 }}>{fmtLong(e.date)}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                          {e.weight} lbs
                          {e.muscleGroup && <span style={{ color: C.muted, fontWeight: 400 }}> · {e.muscleGroup}</span>}
                          {e.trained === false && <span style={{ color: C.muted, fontWeight: 400 }}> · Rest</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {[["macrosOnTrack", "M"], ["caloriesOnTrack", "C"]].map(([key, letter]) => e[key] !== null && (
                          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: e[key] ? C.red : C.dim }} />
                            <span style={{ fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>{letter}</span>
                          </div>
                        ))}
                        {e.gymPerf && (
                          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{e.gymPerf}</span>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          {e.energy && <span style={{ fontSize: 10, color: C.muted }}>E{e.energy}</span>}
                          {e.sleep  && <span style={{ fontSize: 10, color: C.muted }}>S{e.sleep}</span>}
                          {e.hunger && <span style={{ fontSize: 10, color: C.muted }}>H:{e.hunger[0].toUpperCase()}</span>}
                        </div>
                        <button
                          aria-label={`Delete ${fmtLong(e.date)}`}
                          onClick={ev => { ev.stopPropagation(); handleDelete(e.date); }}
                          style={{ background: "transparent", border: "none", color: C.dim, fontSize: 16, cursor: "pointer", padding: "0 0 0 4px", fontFamily: FONT }}
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* BACKUP */}
        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <button onClick={handleExport} disabled={!entries.length} style={{
            ...ghostBtn,
            cursor: entries.length ? "pointer" : "not-allowed",
            opacity: entries.length ? 1 : 0.4,
          }}>Export Backup</button>
          <label style={{ ...ghostBtn, cursor: "pointer", display: "block" }}>
            {importMsg || "Import Backup"}
            <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImport} />
          </label>
        </div>
        {entries.length > 0 && (
          <div style={{ fontSize: 10, color: backupOverdue ? C.red : C.muted, textAlign: "center", marginTop: 10, fontStyle: "italic", letterSpacing: "0.06em" }}>
            {backupNote}{backupOverdue ? " — data lives only in this browser" : ""}
          </div>
        )}

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
  );
}

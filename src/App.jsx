import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured, setRememberMe } from "./supabaseClient";
import {
  LayoutGrid, Wallet, Target, CheckSquare, Flame, Package,
  Plus, Trash2, ChevronRight, TrendingUp, TrendingDown, Coffee,
  UtensilsCrossed, ShoppingCart, Car, Home as HomeIcon, Zap,
  HeartPulse, ShoppingBag, Trash, GraduationCap, MoreHorizontal, Check,
  X, Calendar, Sun, Moon, Brain, Briefcase, Activity, LogOut, Users, ShieldCheck, Pencil, PiggyBank, Tag
} from "lucide-react";

// recharts (~200KB+ del bundle) se carga de forma perezosa vía import() dinámico
// en useRecharts(), en vez de un import estático, para que quede en su propio
// chunk y solo se descargue cuando el usuario visita Resumen o Hábitos.
let rechartsPromise = null;
function useRecharts() {
  const [mod, setMod] = useState(null);
  useEffect(() => {
    if (!rechartsPromise) rechartsPromise = import("recharts");
    let cancelled = false;
    rechartsPromise.then(m => { if (!cancelled) setMod(m); });
    return () => { cancelled = true; };
  }, []);
  return mod;
}
function ChartLoading({ height }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: 0 }}>Cargando gráfico…</p>
    </div>
  );
}

/* ---------------------------------------------------------
   PROGO — panel de negocio para comunidades de e-commerce
   by JC CREW · "Organiza. Ejecuta. Progresa."

   Tokens (validated: node scripts/validate_palette.js — see dataviz skill)
   dark   ink:      #0E1318      light  ink:      #F5F1E8
          card:     #161C23             card:     #FFFFFF
          elevated: #1E2630             elevated: #F0EBE0
          border:   #242D36             border:   #E4DDCB
          paper:    #F3EEE3             paper:    #14110D
          muted:    #8B93A0             muted:    #726F68
          gold:     #B5842C            gold:     #A66A1B
          teal:     #1E9E82            teal:     #0E8C6E
          coral:    #CC6248            coral:    #B03F29
          violet:   #7B6DD8            violet:   #5C46B8
--------------------------------------------------------- */

const FONT_IMPORT_ID = "progo-fonts";
if (typeof document !== "undefined" && !document.getElementById(FONT_IMPORT_ID)) {
  const link = document.createElement("link");
  link.id = FONT_IMPORT_ID;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Poppins:wght@800&display=swap";
  document.head.appendChild(link);
}

const DARK_THEME = {
  ink: "#0E1318",
  card: "#161C23",
  elevated: "#1E2630",
  border: "#242D36",
  paper: "#F3EEE3",
  muted: "#8B93A0",
  gold: "#B5842C",
  teal: "#1E9E82",
  coral: "#CC6248",
  violet: "#7B6DD8",
  onAccent: "#0E1318",
};

const LIGHT_THEME = {
  ink: "#F5F1E8",
  card: "#FFFFFF",
  elevated: "#F0EBE0",
  border: "#E4DDCB",
  paper: "#14110D",
  muted: "#726F68",
  gold: "#A66A1B",
  teal: "#0E8C6E",
  coral: "#B03F29",
  violet: "#5C46B8",
  onAccent: "#FFFFFF",
};

let COLORS = { ...DARK_THEME };

const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'JetBrains Mono', monospace" };

function fmtCOP(n) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

function displayNameFromEmail(email) {
  if (!email) return "";
  const local = email.split("@")[0];
  return local.replace(/[._-]+/g, " ").split(" ").filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}


function AppleToggle({ checked, onChange }) {
  return (
    <button onClick={onChange} role="switch" aria-checked={checked} style={{
      width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", padding: 3,
      background: checked ? COLORS.teal : COLORS.border, display: "flex", justifyContent: checked ? "flex-end" : "flex-start",
      transition: "background 0.15s ease",
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "transform 0.15s ease",
      }} />
    </button>
  );
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= breakpoint);
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= breakpoint); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

// 100dvh no es confiable dentro de una PWA instalada en iOS (el alto real
// termina desfasado del que reporta el navegador), así que medimos el alto
// visible directamente por JS en vez de depender de la unidad CSS.
function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window !== "undefined" ? (window.visualViewport?.height || window.innerHeight) : 0
  );
  useEffect(() => {
    function update() { setHeight(window.visualViewport?.height || window.innerHeight); }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  return height;
}

const MONTH_LABEL = "Julio 2026";
const CAL_YEAR = 2026;
const CAL_MONTH = 6; // 0-indexed = julio
const WEEKDAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // make Monday index 0
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, totalDays };
}

function dateStr(d) { return `${CAL_YEAR}-${String(CAL_MONTH + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

/* ---------------------------------------------------------
   Seed data
--------------------------------------------------------- */

const CATEGORY_META = {
  "Comidas por fuera": { icon: UtensilsCrossed, get color() { return COLORS.coral; } },
  "Supermercado": { icon: ShoppingCart, get color() { return COLORS.teal; } },
  "Transporte": { icon: Car, get color() { return COLORS.gold; } },
  "Hogar": { icon: HomeIcon, get color() { return COLORS.violet; } },
  "Servicios": { icon: Zap, get color() { return COLORS.gold; } },
  "Salud": { icon: HeartPulse, get color() { return COLORS.coral; } },
  "Compras": { icon: ShoppingBag, get color() { return COLORS.violet; } },
  "Entretenimiento": { icon: Trash, get color() { return COLORS.teal; } },
  "Educación": { icon: GraduationCap, get color() { return COLORS.gold; } },
  "Otros": { icon: MoreHorizontal, get color() { return COLORS.muted; } },
};

const CAT_LIST = Object.keys(CATEGORY_META);

// Metadatos de categoría: primero busca en las fijas, luego en las personalizadas del usuario (nombre + color libres)
function getCategoryMeta(name, customCategories) {
  if (CATEGORY_META[name]) return CATEGORY_META[name];
  const custom = customCategories?.find(c => c.name === name);
  if (custom) return { icon: Tag, color: custom.color };
  return { icon: MoreHorizontal, color: COLORS.muted };
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const STATUS_META = {
  "Ganador": { get color() { return COLORS.teal; }, get dim() { return COLORS.teal + "22"; } },
  "Perdedor": { get color() { return COLORS.coral; }, get dim() { return COLORS.coral + "22"; } },
  "En prueba": { get color() { return COLORS.gold; }, get dim() { return COLORS.gold + "22"; } },
};

/* ---------------------------------------------------------
   Small building blocks
--------------------------------------------------------- */

function ProgoMark({ size = 34, mode = "dark" }) {
  const gradId = `progoMarkGrad-${mode}`;
  const stops = mode === "dark"
    ? ["#0A2540", "#4FC3F7"] // logo azul
    : ["#FF6B00", "#FFD200"]; // logo naranja
  return (
    <svg width={size} height={size} viewBox="20 30 140 140" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="100%" stopColor={stops[1]} />
        </linearGradient>
      </defs>
      <rect x="20" y="30" width="140" height="140" rx="32" fill={`url(#${gradId})`} />
      <rect x="50" y="120" width="18" height="30" rx="6" fill="#FFFFFF" />
      <rect x="78" y="100" width="18" height="50" rx="6" fill="#FFFFFF" />
      <rect x="106" y="75" width="18" height="75" rx="6" fill="#FFFFFF" />
      <path d="M128 68 L150 46 M150 46 L150 60 M150 46 L136 46"
            stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Wordmark "PROGO" con las O's como anillos de color (azul en oscuro, naranja en
// claro) — misma tipografía y proporciones que los logos originales del Finder.
function ProgoWordmark({ height = 20, mode = "dark" }) {
  const gradId = `progoWordmarkGrad-${mode}`;
  const stops = mode === "dark"
    ? ["#0A2540", "#4FC3F7"] // O azul
    : ["#FF6B00", "#FFD200"]; // O naranja
  const width = height * (310 / 62);
  return (
    <svg width={width} height={height} viewBox="175 68 310 62" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="100%" stopColor={stops[1]} />
        </linearGradient>
      </defs>
      <text y="122" fontFamily="'Poppins','Century Gothic','Trebuchet MS',sans-serif" fontWeight="800" fontSize="64" fill={COLORS.paper}>
        <tspan x="185">P</tspan>
        <tspan x="260">R</tspan>
      </text>
      <circle cx="335" cy="99" r="16" fill="none" stroke={`url(#${gradId})`} strokeWidth="16" />
      <text y="122" x="380" fontFamily="'Poppins','Century Gothic','Trebuchet MS',sans-serif" fontWeight="800" fontSize="64" fill={COLORS.paper}>G</text>
      <circle cx="460" cy="99" r="16" fill="none" stroke={`url(#${gradId})`} strokeWidth="16" />
    </svg>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`,
      borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 160,
    }}>
      <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: 0 }}>{label}</p>
      <p style={{ ...fontDisplay, color: accent || COLORS.paper, fontSize: 26, fontWeight: 700, margin: "8px 0 4px" }}>{value}</p>
      {sub && <p style={{ ...fontMono, color: COLORS.muted, fontSize: 12, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, accent, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: accent + "22",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={22} color={accent} strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ ...fontDisplay, color: COLORS.paper, fontSize: 24, fontWeight: 700, margin: 0 }}>{title}</h1>
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5, margin: "2px 0 0" }}>{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function PrimaryButton({ children, onClick, accent = COLORS.gold }) {
  return (
    <button onClick={onClick} style={{
      ...fontBody, display: "flex", alignItems: "center", gap: 6,
      background: accent, color: COLORS.onAccent, fontWeight: 600, fontSize: 14,
      border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   RESUMEN
--------------------------------------------------------- */

function Resumen({ expenses, tasks, habits, products }) {
  const recharts = useRecharts();
  const totalGastos = expenses.reduce((a, e) => a + e.amount, 0);
  const tareasHechas = tasks.diario.filter(t => t.done).length;
  const ganadores = products.filter(p => p.status === "Ganador").length;
  const totalDaysInMonth = new Date(CAL_YEAR, CAL_MONTH + 1, 0).getDate();
  const streaks = habits.map(h => {
    let s = 0;
    for (let d = totalDaysInMonth; d >= 1; d--) { if (h.history[dateStr(d)]) s++; else break; }
    return { name: h.name, streak: s };
  });
  const bestStreak = streaks.reduce((best, s) => (!best || s.streak > best.streak) ? s : best, null);
  const chartData = useMemo(() => {
    const byDay = {};
    expenses.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
    return Object.entries(byDay).sort().map(([date, amount]) => ({
      date: date.slice(8, 10) + "/" + date.slice(5, 7), amount,
    }));
  }, [expenses]);

  return (
    <div>
      <SectionHeader icon={LayoutGrid} title="Resumen" subtitle="Tu negocio de un vistazo · julio 2026" accent={COLORS.gold} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard label="Gastos del mes" value={fmtCOP(totalGastos)} sub={`${expenses.length} registros`} accent={COLORS.coral} />
        <StatCard label="Tareas completadas" value={`${tareasHechas}/${tasks.diario.length}`} sub="Hoy" accent={COLORS.gold} />
        <StatCard label="Productos ganadores" value={ganadores} sub={`de ${products.length} testeados`} accent={COLORS.teal} />
        <StatCard label="Racha más larga" value={bestStreak ? `${bestStreak.streak} días` : "0 días"} sub={bestStreak ? bestStreak.name : "Sin hábitos aún"} accent={COLORS.violet} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px" }}>
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>Gastos por día</p>
        <div style={{ height: 220 }}>
          {!recharts ? <ChartLoading height={220} /> : (
            <recharts.ResponsiveContainer width="100%" height="100%">
              <recharts.BarChart data={chartData}>
                <recharts.CartesianGrid stroke={COLORS.border} vertical={false} />
                <recharts.XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <recharts.YAxis tick={{ fill: COLORS.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={70} tickFormatter={v => fmtCOP(v)} />
                <recharts.Tooltip
                  contentStyle={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.paper, fontFamily: "'Inter', sans-serif", fontSize: 13 }}
                  formatter={v => fmtCOP(v)}
                  labelStyle={{ color: COLORS.muted }}
                />
                <recharts.Bar dataKey="amount" fill={COLORS.gold} radius={[4, 4, 0, 0]} />
              </recharts.BarChart>
            </recharts.ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   GASTOS
--------------------------------------------------------- */

function Gastos({ expenses, setExpenses, monthlyIncome, updateMonthlyIncome, customCategories, addCustomCategory, insertExpenseRow, patchExpenseRow, deleteExpenseRow }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", color: "#4FA08F" });
  const [catError, setCatError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const catList = [...CAT_LIST, ...customCategories.map(c => c.name)];

  async function addCategory() {
    const name = catForm.name.trim();
    if (!name) { setCatError("El nombre es obligatorio."); return; }
    if (catList.some(c => c.toLowerCase() === name.toLowerCase())) { setCatError("Ya existe una categoría con ese nombre."); return; }
    setSavingCategory(true);
    const { error } = await addCustomCategory(name, catForm.color);
    setSavingCategory(false);
    if (error) { setCatError(error.message); return; }
    setCatForm({ name: "", color: "#4FA08F" });
    setCatError("");
    setAddingCategory(false);
  }

  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return map;
  }, [expenses]);

  const total = expenses.reduce((a, e) => a + e.amount, 0);

  const todayISO = isoDateLocal(new Date());
  const monthPrefix = todayISO.slice(0, 7);
  const monthTotal = expenses.filter(e => e.date.startsWith(monthPrefix)).reduce((a, e) => a + e.amount, 0);
  const spentPct = monthlyIncome ? (monthTotal / monthlyIncome) * 100 : 0;
  const remaining = (monthlyIncome || 0) - monthTotal;

  function startEditIncome() {
    setIncomeInput(monthlyIncome ? String(monthlyIncome) : "");
    setIncomeError("");
    setEditingIncome(true);
  }
  async function saveMonthlyIncome() {
    const value = Number(incomeInput);
    if (!value || value <= 0) { setIncomeError("El ingreso mensual debe ser mayor a 0."); return; }
    const { error } = await updateMonthlyIncome(value);
    if (error) { setIncomeError(error.message); return; }
    setEditingIncome(false);
  }

  if (selectedCategory) {
    return <CategoryCalendar category={selectedCategory} expenses={expenses} setExpenses={setExpenses} customCategories={customCategories} insertExpenseRow={insertExpenseRow} patchExpenseRow={patchExpenseRow} deleteExpenseRow={deleteExpenseRow} onBack={() => setSelectedCategory(null)} />;
  }

  return (
    <div>
      <SectionHeader
        icon={Wallet} title="Gastos" subtitle="Administra y controla tus gastos por categoría" accent={COLORS.coral}
      />

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: 0 }}>Ingreso mensual</p>
          {!editingIncome && (
            <button onClick={startEditIncome} style={{ ...fontBody, background: "none", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <Pencil size={13} /> {monthlyIncome ? "Editar" : "Configurar"}
            </button>
          )}
        </div>

        {editingIncome ? (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: incomeError ? 8 : 0 }}>
              <input type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveMonthlyIncome()}
                placeholder="Ej. 3000000" style={{ ...inputStyle(), marginBottom: 0, width: 180 }} autoFocus />
              <PrimaryButton onClick={saveMonthlyIncome} accent={COLORS.coral}><Check size={14} /> Guardar</PrimaryButton>
              <button onClick={() => setEditingIncome(false)} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>
            </div>
            {incomeError && <p style={{ ...fontBody, color: COLORS.coral, fontSize: 12.5, margin: 0 }}>{incomeError}</p>}
          </div>
        ) : monthlyIncome ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
              <span style={{ ...fontMono, fontSize: 13, color: COLORS.muted }}>Gastado este mes: <span style={{ color: COLORS.coral, fontWeight: 600 }}>{fmtCOP(monthTotal)}</span></span>
              <span style={{ ...fontMono, fontSize: 13, color: COLORS.muted }}>Disponible: <span style={{ color: remaining >= 0 ? COLORS.teal : COLORS.coral, fontWeight: 600 }}>{fmtCOP(remaining)}</span></span>
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: COLORS.elevated }}>
              <div style={{ flex: `${Math.min(spentPct, 100)} 0 0%`, background: spentPct > 100 ? COLORS.coral : COLORS.gold }} />
              {spentPct < 100 && <div style={{ flex: `${100 - spentPct} 0 0%` }} />}
            </div>
            {spentPct > 100 && (
              <p style={{ ...fontBody, color: COLORS.coral, fontSize: 11.5, margin: "8px 0 0" }}>Superaste tu ingreso mensual por {fmtCOP(monthTotal - monthlyIncome)}.</p>
            )}
          </>
        ) : (
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13 }}>Configura cuánto ganas al mes para ver tu saldo disponible frente a tus gastos.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: addingCategory ? 14 : 24 }}>
        {catList.map(cat => {
          const meta = getCategoryMeta(cat, customCategories);
          const Icon = meta.icon;
          const amount = byCategory[cat] || 0;
          const pct = total ? ((amount / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={cat} onClick={() => setSelectedCategory(cat)} style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12,
              padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: meta.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color={meta.color} />
                </div>
                <span style={{ ...fontBody, fontSize: 13, color: COLORS.paper, fontWeight: 500, flex: 1 }}>{cat}</span>
                <ChevronRight size={14} color={COLORS.muted} />
              </div>
              <p style={{ ...fontMono, fontSize: 17, fontWeight: 600, color: COLORS.paper, margin: 0 }}>{fmtCOP(amount)}</p>
              <p style={{ ...fontMono, fontSize: 11.5, color: COLORS.muted, margin: "2px 0 0" }}>{pct}% del total</p>
            </div>
          );
        })}
        <div onClick={() => setAddingCategory(true)} style={{
          background: "transparent", border: `1px dashed ${COLORS.border}`, borderRadius: 12,
          padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 84,
        }}>
          <Plus size={16} color={COLORS.muted} />
          <span style={{ ...fontBody, fontSize: 13, color: COLORS.muted, fontWeight: 500 }}>Nueva categoría</span>
        </div>
      </div>

      {addingCategory && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 24 }}>
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>Nueva categoría personalizada</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: catError ? 8 : 0 }}>
            <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
              onKeyDown={e => e.key === "Enter" && addCategory()}
              placeholder="Nombre (ej. Mascotas)" style={{ ...inputStyle(), marginBottom: 0, flex: 1, minWidth: 160 }} autoFocus />
            <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })}
              style={{ width: 44, height: 38, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 8, background: "none", cursor: "pointer" }} />
            <PrimaryButton onClick={addCategory} accent={COLORS.coral}>{savingCategory ? "Creando…" : <><Plus size={16} /> Crear</>}</PrimaryButton>
            <button onClick={() => { setAddingCategory(false); setCatError(""); }} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>
          </div>
          {catError && <p style={{ ...fontBody, color: COLORS.coral, fontSize: 12.5, margin: 0 }}>{catError}</p>}
        </div>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ ...fontBody, color: COLORS.paper, fontWeight: 600, fontSize: 15 }}>Gastos recientes</span>
          <span style={{ ...fontMono, color: COLORS.coral, fontWeight: 600, fontSize: 15 }}>{fmtCOP(total)}</span>
        </div>
        {expenses.slice(0, 10).map(e => {
          const meta = getCategoryMeta(e.category, customCategories);
          const Icon = meta.icon;
          return (
            <div key={e.id} onClick={() => setSelectedCategory(e.category)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={meta.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...fontBody, color: COLORS.paper, fontSize: 14, margin: 0 }}>{e.description}</p>
                <p style={{ ...fontMono, color: COLORS.muted, fontSize: 11.5, margin: "2px 0 0" }}>{e.date} · {e.category}</p>
              </div>
              <span style={{ ...fontMono, color: COLORS.coral, fontSize: 14, fontWeight: 600 }}>{fmtCOP(e.amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryCalendar({ category, expenses, setExpenses, customCategories, insertExpenseRow, patchExpenseRow, deleteExpenseRow, onBack }) {
  const meta = getCategoryMeta(category, customCategories);
  const Icon = meta.icon;
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ description: "", amount: "" });
  const [editingId, setEditingId] = useState(null);
  const isMobile = useIsMobile();

  const catExpenses = useMemo(() => expenses.filter(e => e.category === category), [expenses, category]);

  const byDate = useMemo(() => {
    const map = {};
    catExpenses.forEach(e => { map[e.date] = (map[e.date] || 0) + e.amount; });
    return map;
  }, [catExpenses]);

  const total = catExpenses.reduce((a, e) => a + e.amount, 0);
  const { cells, totalDays } = monthMatrix(CAL_YEAR, CAL_MONTH);
  const daysConGasto = Object.keys(byDate).length;
  const promedioDiario = total / totalDays;
  const mayorGasto = catExpenses.reduce((max, e) => (!max || e.amount > max.amount ? e : max), null);

  const dayExpenses = selectedDate ? catExpenses.filter(e => e.date === selectedDate) : [];
  const dayTotal = dayExpenses.reduce((a, e) => a + e.amount, 0);

  async function addExpense() {
    if (!selectedDate || !form.description || !form.amount) return;
    const amount = Number(form.amount);
    if (editingId) {
      setExpenses(prev => prev.map(e => e.id === editingId ? { ...e, date: selectedDate, description: form.description, amount } : e));
      patchExpenseRow(editingId, { date: selectedDate, description: form.description, amount });
      setEditingId(null);
    } else {
      const created = await insertExpenseRow({ date: selectedDate, category, description: form.description, amount });
      if (created) setExpenses(prev => [created, ...prev]);
    }
    setForm({ description: "", amount: "" });
  }
  function startEditExpense(e) {
    setEditingId(e.id);
    setSelectedDate(e.date);
    setForm({ description: e.description, amount: String(e.amount) });
  }
  function cancelEdit() { setEditingId(null); setForm({ description: "", amount: "" }); }
  function removeExpense(id) { setExpenses(prev => prev.filter(e => e.id !== id)); deleteExpenseRow(id); if (editingId === id) cancelEdit(); }

  return (
    <div>
      <button onClick={onBack} style={{
        ...fontBody, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
        color: COLORS.muted, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16,
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Volver a gastos
      </button>

      <SectionHeader icon={Icon} title={category} subtitle={`Registra y controla tus gastos en ${category.toLowerCase()}`} accent={meta.color}
        right={<span style={{ ...fontMono, color: COLORS.muted, fontSize: 13, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px" }}>{MONTH_LABEL}</span>}
      />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label={`Total en ${MONTH_LABEL.split(" ")[0].toLowerCase()}`} value={fmtCOP(total)} sub={`${catExpenses.length} registros`} accent={meta.color} />
        <StatCard label="Promedio diario" value={fmtCOP(promedioDiario)} sub={`Basado en ${totalDays} días`} accent={meta.color} />
        <StatCard label="Días con gastos" value={`${daysConGasto} días`} sub={`${((daysConGasto / totalDays) * 100).toFixed(1)}% del mes`} accent={meta.color} />
        <StatCard label="Mayor gasto" value={mayorGasto ? fmtCOP(mayorGasto.amount) : fmtCOP(0)} sub={mayorGasto ? mayorGasto.date : "—"} accent={meta.color} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, overflowX: "auto" }}>
          <div style={{ minWidth: 440 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
            {WEEKDAY_LABELS.map(w => (
              <span key={w} style={{ ...fontMono, textAlign: "center", color: COLORS.muted, fontSize: 11, letterSpacing: 0.5 }}>{w}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = dateStr(d);
              const amount = byDate[ds];
              const isSelected = ds === selectedDate;
              return (
                <div key={i} onClick={() => setSelectedDate(ds)} style={{
                  minHeight: 62, borderRadius: 9, padding: "6px 8px", cursor: "pointer",
                  background: isSelected ? meta.color + "22" : COLORS.elevated,
                  border: `1px solid ${isSelected ? meta.color : COLORS.border}`,
                }}>
                  <span style={{ ...fontMono, fontSize: 12, color: isSelected ? meta.color : COLORS.muted }}>{d}</span>
                  {amount ? (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon size={11} color={meta.color} />
                      <span style={{ ...fontMono, fontSize: 11.5, color: meta.color, fontWeight: 600 }}>{fmtCOP(amount)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20 }}>
            <p style={{ ...fontBody, color: COLORS.paper, fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>{editingId ? "Editar gasto" : "Agregar gasto"}</p>
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12 }}>Fecha</label>
            <input type="date" value={selectedDate || ""} onChange={e => setSelectedDate(e.target.value)} style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12 }}>Descripción</label>
            <input placeholder="Ej. Almuerzo con clientes" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12 }}>Monto</label>
            <input type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle()} />
            <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
              <PrimaryButton onClick={addExpense} accent={meta.color}>{editingId ? <><Check size={16} /> Guardar cambios</> : <><Plus size={16} /> Guardar gasto</>}</PrimaryButton>
              {editingId && <button onClick={cancelEdit} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>}
            </div>
          </div>

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ ...fontBody, color: COLORS.paper, fontWeight: 600, fontSize: 14 }}>
                {selectedDate ? `Gastos del ${selectedDate.slice(8, 10)}/${selectedDate.slice(5, 7)}` : "Selecciona un día"}
              </span>
              {selectedDate && <span style={{ ...fontMono, color: meta.color, fontSize: 13, fontWeight: 600 }}>{fmtCOP(dayTotal)}</span>}
            </div>
            {dayExpenses.length === 0 && (
              <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13 }}>
                {selectedDate ? "Sin gastos este día." : "Haz clic en una casilla del calendario."}
              </p>
            )}
            {dayExpenses.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...fontBody, color: COLORS.paper, fontSize: 13.5, margin: 0 }}>{e.description}</p>
                </div>
                <span style={{ ...fontMono, color: meta.color, fontSize: 13, fontWeight: 600 }}>{fmtCOP(e.amount)}</span>
                <button onClick={() => startEditExpense(e)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => removeExpense(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function inputStyle() {
  return {
    // fontSize 16 a propósito: por debajo de eso, Safari en iOS hace zoom
    // automático al enfocar el campo.
    ...fontBody, width: "100%", background: COLORS.elevated, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "9px 12px", color: COLORS.paper, fontSize: 16, marginBottom: 12,
    outline: "none", boxSizing: "border-box",
  };
}

/* ---------------------------------------------------------
   METAS
--------------------------------------------------------- */

// Mapea una fila de la tabla `goals` (snake_case) al shape que usa la UI (camelCase)
function rowToGoal(row) {
  return {
    id: row.id, title: row.title, done: row.done, progress: row.progress, target: row.target, money: row.money,
    goalType: row.goal_type || "standard", financialTarget: row.financial_target, financialStartDate: row.financial_start_date,
  };
}

// Lógica centralizada: ingresos aplicables a una meta financiera (desde su fecha inicial) y el % de avance resultante.
// Única fuente de verdad — usada en Metas para renderizar el progreso, nunca se guarda un valor duplicado.
function computeFinancialApplicable(incomes, goal) {
  return incomes
    .filter(i => !goal.financialStartDate || i.income_date >= goal.financialStartDate)
    .reduce((s, i) => s + Number(i.amount), 0);
}
function computeFinancialProgress(incomes, goal) {
  if (!goal.financialTarget) return 0;
  return Math.min(100, (computeFinancialApplicable(incomes, goal) / goal.financialTarget) * 100);
}

const TIMEFRAME_META = {
  diario: { label: "Diario", get color() { return COLORS.gold; } },
  semanal: { label: "Semanal", get color() { return COLORS.teal; } },
  mensual: { label: "Mensual", get color() { return COLORS.violet; } },
  trimestral: { label: "Trimestral", get color() { return COLORS.coral; } },
};

function Ring({ pct, color, size = 64 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.border} strokeWidth="6" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="6" fill="none"
        strokeDasharray={c} strokeDashoffset={c - (Math.min(pct, 1) * c)} strokeLinecap="round" />
    </svg>
  );
}

function Metas({ goals, setGoals, incomes, insertGoalRow, patchGoalRow, deleteGoalRow, financeLoading }) {
  const [tab, setTab] = useState("diario");
  const [form, setForm] = useState({ title: "", target: "", money: false, financial: false, financialStartDate: isoDateLocal(new Date()) });
  const [editingId, setEditingId] = useState(null);
  const meta = TIMEFRAME_META[tab];
  const list = goals[tab];
  const isDiario = tab === "diario";

  function toggleDaily(id) {
    const g = goals.diario.find(x => x.id === id);
    if (!g) return;
    const done = !g.done;
    setGoals(prev => ({ ...prev, diario: prev.diario.map(x => x.id === id ? { ...x, done } : x) }));
    patchGoalRow(id, { done });
  }
  function removeGoal(id) {
    setGoals(prev => ({ ...prev, [tab]: prev[tab].filter(g => g.id !== id) }));
    deleteGoalRow(id);
    if (editingId === id) cancelEdit();
  }
  function updateProgress(id, value) {
    const g = list.find(x => x.id === id);
    if (!g) return;
    const progress = Math.max(0, Math.min(g.target, value));
    setGoals(prev => ({ ...prev, [tab]: prev[tab].map(x => x.id === id ? { ...x, progress } : x) }));
    patchGoalRow(id, { progress });
  }
  function startEditGoal(g) {
    setEditingId(g.id);
    const isFinancial = g.goalType === "financial";
    setForm({
      title: g.title,
      target: isFinancial ? (g.financialTarget ? String(g.financialTarget) : "") : (g.target ? String(g.target) : ""),
      money: !!g.money,
      financial: isFinancial,
      financialStartDate: g.financialStartDate || isoDateLocal(new Date()),
    });
  }
  function cancelEdit() { setEditingId(null); setForm({ title: "", target: "", money: false, financial: false, financialStartDate: isoDateLocal(new Date()) }); }
  async function addGoal() {
    if (!form.title.trim()) return;
    if (isDiario) {
      if (editingId) {
        setGoals(prev => ({ ...prev, diario: prev.diario.map(g => g.id === editingId ? { ...g, title: form.title } : g) }));
        patchGoalRow(editingId, { title: form.title });
      } else {
        const created = await insertGoalRow("diario", { title: form.title, done: false });
        if (created) setGoals(prev => ({ ...prev, diario: [...prev.diario, created] }));
      }
    } else if (form.financial) {
      const target = Number(form.target);
      if (!target || target <= 0 || !form.financialStartDate) return;
      if (editingId) {
        setGoals(prev => ({ ...prev, [tab]: prev[tab].map(g => g.id === editingId ? { ...g, title: form.title, goalType: "financial", financialTarget: target, financialStartDate: form.financialStartDate, target: null, progress: null } : g) }));
        patchGoalRow(editingId, { goalType: "financial", title: form.title, financialTarget: target, financialStartDate: form.financialStartDate, target: null, progress: null });
      } else {
        const created = await insertGoalRow(tab, { title: form.title, goalType: "financial", financialTarget: target, financialStartDate: form.financialStartDate, money: true });
        if (created) setGoals(prev => ({ ...prev, [tab]: [...prev[tab], created] }));
      }
    } else {
      const target = Number(form.target);
      if (!target || target <= 0) return;
      if (editingId) {
        const g = list.find(x => x.id === editingId);
        const progress = Math.min(g?.goalType === "financial" ? 0 : (g?.progress || 0), target);
        setGoals(prev => ({ ...prev, [tab]: prev[tab].map(x => x.id === editingId ? { ...x, title: form.title, goalType: "standard", target, money: form.money, progress, financialTarget: null, financialStartDate: null } : x) }));
        patchGoalRow(editingId, { goalType: "standard", title: form.title, target, money: form.money, progress, financialTarget: null, financialStartDate: null });
      } else {
        const created = await insertGoalRow(tab, { title: form.title, progress: 0, target, money: form.money });
        if (created) setGoals(prev => ({ ...prev, [tab]: [...prev[tab], created] }));
      }
    }
    cancelEdit();
  }

  return (
    <div>
      <SectionHeader icon={Target} title="Metas" subtitle="Objetivos diarios, semanales, mensuales y trimestrales" accent={COLORS.violet} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {Object.entries(TIMEFRAME_META).map(([key, m]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            ...fontBody, fontSize: 13.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9,
            border: `1px solid ${tab === key ? m.color : COLORS.border}`,
            background: tab === key ? m.color + "22" : "transparent",
            color: tab === key ? m.color : COLORS.muted, cursor: "pointer",
          }}>{m.label}</button>
        ))}
      </div>

      {financeLoading ? (
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>Cargando metas…</p>
      ) : (
      <>
      <div style={{ display: "flex", gap: 8, marginBottom: !isDiario && form.financial ? 10 : 20, flexWrap: "wrap" }}>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          onKeyDown={e => e.key === "Enter" && addGoal()}
          placeholder={`Nueva meta ${meta.label.toLowerCase()}`} style={{ ...inputStyle(), marginBottom: 0, flex: 1, minWidth: 180 }} />
        {!isDiario && (
          <input type="number" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addGoal()}
            placeholder={form.financial || form.money ? "Monto meta" : "Cantidad meta"} style={{ ...inputStyle(), marginBottom: 0, width: 150 }} />
        )}
        {!isDiario && !form.financial && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 13, color: COLORS.muted, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={form.money} onChange={e => setForm({ ...form, money: e.target.checked })} />
            Es dinero
          </label>
        )}
        {!isDiario && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 13, color: COLORS.muted, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={form.financial} onChange={e => setForm({ ...form, financial: e.target.checked })} />
            Meta financiera
          </label>
        )}
        <PrimaryButton onClick={addGoal} accent={meta.color}>{editingId ? <><Check size={16} /> Guardar</> : <><Plus size={16} /> Agregar</>}</PrimaryButton>
        {editingId && <button onClick={cancelEdit} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>}
      </div>

      {!isDiario && form.financial && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <label style={{ ...fontBody, fontSize: 13, color: COLORS.muted, whiteSpace: "nowrap" }}>Ingresos aplicables desde</label>
          <input type="date" value={form.financialStartDate} onChange={e => setForm({ ...form, financialStartDate: e.target.value })} style={{ ...inputStyle(), marginBottom: 0, width: 160 }} />
        </div>
      )}

      {isDiario ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map(g => (
            <div key={g.id} style={{
              display: "flex", alignItems: "center", gap: 12, background: COLORS.card,
              border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 18px",
            }}>
              <div onClick={() => toggleDaily(g.id)} style={{
                width: 22, height: 22, borderRadius: 6, border: `2px solid ${g.done ? meta.color : COLORS.border}`,
                background: g.done ? meta.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer",
              }}>
                {g.done && <Check size={14} color={COLORS.onAccent} strokeWidth={3} />}
              </div>
              <span onClick={() => toggleDaily(g.id)} style={{ ...fontBody, flex: 1, cursor: "pointer", fontSize: 14.5, color: g.done ? COLORS.muted : COLORS.paper, textDecoration: g.done ? "line-through" : "none" }}>{g.title}</span>
              <button onClick={() => startEditGoal(g)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><Pencil size={14} /></button>
              <button onClick={() => removeGoal(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={15} /></button>
            </div>
          ))}
          {list.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>No hay metas diarias todavía.</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {list.map(g => {
            const isFinancial = g.goalType === "financial";
            const applicable = isFinancial ? computeFinancialApplicable(incomes, g) : 0;
            const pct = isFinancial ? computeFinancialProgress(incomes, g) / 100 : (g.target ? g.progress / g.target : 0);
            return (
              <div key={g.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                  <Ring pct={pct} color={meta.color} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ ...fontMono, fontSize: 12, fontWeight: 600, color: meta.color }}>{Math.round(pct * 100)}%</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <p style={{ ...fontBody, color: COLORS.paper, fontSize: 14.5, fontWeight: 500, margin: "0 0 6px" }}>{g.title}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEditGoal(g)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><Pencil size={14} /></button>
                      <button onClick={() => removeGoal(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={15} /></button>
                    </div>
                  </div>
                  {isFinancial ? (
                    <>
                      <p style={{ ...fontMono, color: COLORS.muted, fontSize: 12.5, margin: "0 0 2px" }}>{fmtCOP(applicable)} / {fmtCOP(g.financialTarget)}</p>
                      <p style={{ ...fontBody, color: COLORS.muted, fontSize: 11, margin: 0 }}>
                        {pct >= 1 ? "¡Meta alcanzada! · " : ""}Desde {g.financialStartDate}
                      </p>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="number" value={g.progress} onChange={e => updateProgress(g.id, Number(e.target.value))} style={{
                        ...fontMono, width: 120, background: COLORS.elevated, border: `1px solid ${COLORS.border}`,
                        borderRadius: 6, padding: "6px 8px", color: COLORS.paper, fontSize: 16, outline: "none",
                      }} />
                      <span style={{ ...fontMono, color: COLORS.muted, fontSize: 12.5 }}>/ {g.money ? fmtCOP(g.target) : g.target}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>No hay metas {meta.label.toLowerCase()}es todavía.</p>}
        </div>
      )}
      </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   INGRESOS Y SALDOS
--------------------------------------------------------- */

const MOVEMENT_KIND_META = {
  ingreso: { label: "Ingresos", dateField: "income_date", verb: "ingreso", get accent() { return COLORS.teal; } },
  egreso: { label: "Egresos", dateField: "expense_date", verb: "egreso", get accent() { return COLORS.coral; } },
};

function IngresosSaldos({ incomes, addIncome, editIncome, deleteIncome, egresos, addEgreso, editEgreso, deleteEgreso, financeLoading }) {
  const todayISO = isoDateLocal(new Date());
  const monthPrefix = todayISO.slice(0, 7);
  const [kind, setKind] = useState("ingreso");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ amount: "", concept: "", date: todayISO, category: "", note: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const meta = MOVEMENT_KIND_META[kind];
  const items = kind === "ingreso" ? incomes : egresos;
  const addFn = kind === "ingreso" ? addIncome : addEgreso;
  const editFn = kind === "ingreso" ? editIncome : editEgreso;
  const deleteFn = kind === "ingreso" ? deleteIncome : deleteEgreso;

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const totalEgresos = egresos.reduce((s, e) => s + Number(e.amount), 0);
  const saldoActual = totalIncome - totalEgresos;
  const monthIncome = incomes.filter(i => i.income_date.startsWith(monthPrefix)).reduce((s, i) => s + Number(i.amount), 0);
  const monthEgresos = egresos.filter(e => e.expense_date.startsWith(monthPrefix)).reduce((s, e) => s + Number(e.amount), 0);

  function switchKind(k) { setKind(k); setConfirmDeleteId(null); }

  function openNew() {
    setEditingId(null);
    setForm({ amount: "", concept: "", date: todayISO, category: "", note: "" });
    setError("");
    setModalOpen(true);
  }
  function openEdit(i) {
    setEditingId(i.id);
    setForm({ amount: String(i.amount), concept: i.concept, date: i[meta.dateField], category: i.category || "", note: i.note || "" });
    setError("");
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setError(""); }

  async function handleSubmit() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError("El monto debe ser mayor a 0."); return; }
    if (!form.concept.trim()) { setError("El concepto es obligatorio."); return; }
    if (!form.date) { setError("La fecha es obligatoria."); return; }
    setSaving(true);
    setError("");
    const payload = { amount, concept: form.concept.trim(), date: form.date, category: form.category.trim(), note: form.note.trim() };
    const { error: err } = editingId ? await editFn(editingId, payload) : await addFn(payload);
    setSaving(false);
    if (err) { setError(err.message || `No se pudo guardar el ${meta.verb}.`); return; }
    setNotice(editingId ? `${meta.label.slice(0, -1)} actualizado.` : `${meta.label.slice(0, -1)} registrado.`);
    setTimeout(() => setNotice(""), 3000);
    setModalOpen(false);
  }

  async function handleDelete(id) {
    const { error: err } = await deleteFn(id);
    if (err) { setError(err.message || `No se pudo eliminar el ${meta.verb}.`); }
    setConfirmDeleteId(null);
  }

  const sorted = [...items].sort((a, b) => b[meta.dateField].localeCompare(a[meta.dateField]) || b.id - a.id);

  return (
    <div>
      <SectionHeader icon={PiggyBank} title="Ingresos y saldos" subtitle="Control de tus ingresos, egresos y tu saldo" accent={COLORS.teal}
        right={<PrimaryButton onClick={openNew} accent={meta.accent}><Plus size={16} /> Registrar {meta.verb}</PrimaryButton>}
      />

      {financeLoading ? (
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>Cargando movimientos…</p>
      ) : (
      <>
      {notice && <p style={{ ...fontBody, color: COLORS.teal, fontSize: 13, margin: "0 0 14px" }}>{notice}</p>}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Ingresos totales" value={fmtCOP(totalIncome)} sub={`${incomes.length} registros`} accent={COLORS.teal} />
        <StatCard label="Egresos totales" value={fmtCOP(totalEgresos)} sub={`${egresos.length} registros`} accent={COLORS.coral} />
        <StatCard label="Saldo actual" value={fmtCOP(saldoActual)} sub="Ingresos - egresos" accent={COLORS.gold} />
        <StatCard label="Ingresos del mes" value={fmtCOP(monthIncome)} sub={monthPrefix} accent={COLORS.teal} />
        <StatCard label="Egresos del mes" value={fmtCOP(monthEgresos)} sub={monthPrefix} accent={COLORS.coral} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Object.entries(MOVEMENT_KIND_META).map(([key, m]) => (
          <button key={key} onClick={() => switchKind(key)} style={{
            ...fontBody, padding: "8px 16px", borderRadius: 9, border: `1px solid ${kind === key ? m.accent : COLORS.border}`,
            background: kind === key ? m.accent + "1c" : "transparent", color: kind === key ? m.accent : COLORS.muted,
            fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          }}>{m.label}</button>
        ))}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        {sorted.length === 0 ? (
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5, padding: 20 }}>No hay {meta.label.toLowerCase()} registrados todavía.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 24px 24px", gap: 16, padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                {["Concepto", "Fecha", "Categoría", "Monto", "", ""].map((h, i) => (
                  <span key={i} style={{ ...fontBody, color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</span>
                ))}
              </div>
              {sorted.map(row => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 24px 24px", gap: 16, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...fontBody, color: COLORS.paper, fontSize: 14, fontWeight: 500, margin: 0 }}>{row.concept}</p>
                    {row.note && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12, margin: "3px 0 0" }}>{row.note}</p>}
                  </div>
                  <span style={{ ...fontMono, color: COLORS.muted, fontSize: 13, whiteSpace: "nowrap" }}>{row[meta.dateField]}</span>
                  <span style={{ ...fontMono, color: COLORS.muted, fontSize: 13, whiteSpace: "nowrap" }}>{row.category || "—"}</span>
                  <span style={{ ...fontMono, color: meta.accent, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtCOP(row.amount)}</span>
                  {confirmDeleteId === row.id ? (
                    <div style={{ gridColumn: "5 / 7", display: "flex", gap: 6, alignItems: "center", justifySelf: "end" }}>
                      <span style={{ ...fontBody, fontSize: 12, color: COLORS.muted, whiteSpace: "nowrap" }}>¿Eliminar?</span>
                      <button onClick={() => handleDelete(row.id)} style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: COLORS.coral, background: "none", border: "none", cursor: "pointer" }}>Sí</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ ...fontBody, fontSize: 12, color: COLORS.muted, background: "none", border: "none", cursor: "pointer" }}>No</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => openEdit(row)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><Pencil size={13} /></button>
                      <button onClick={() => setConfirmDeleteId(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={14} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {modalOpen && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }}>
            <p style={{ ...fontDisplay, color: COLORS.paper, fontSize: 17, fontWeight: 700, margin: "0 0 16px" }}>{editingId ? `Editar ${meta.verb}` : `Registrar ${meta.verb}`}</p>

            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Monto</label>
            <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" style={inputStyle()} autoFocus />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Concepto</label>
            <input value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} placeholder={kind === "ingreso" ? "Ej. Venta tienda" : "Ej. Pago proveedor"} style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Fecha</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Categoría (opcional)</label>
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej. Dropshipping" style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Nota (opcional)</label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle(), minHeight: 60, resize: "vertical" }} />

            {error && <p style={{ ...fontBody, color: COLORS.coral, fontSize: 12.5, margin: "0 0 12px" }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton onClick={handleSubmit} accent={meta.accent}>
                {saving ? "Guardando…" : <><Check size={16} /> {editingId ? "Guardar cambios" : `Registrar ${meta.verb}`}</>}
              </PrimaryButton>
              <button onClick={closeModal} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   TAREAS
--------------------------------------------------------- */

const TASK_TIMEFRAME_META = {
  diario: { label: "Diario", subtitle: "completadas hoy", get color() { return COLORS.gold; } },
  semanal: { label: "Semanal", subtitle: "completadas esta semana", get color() { return COLORS.teal; } },
  mensual: { label: "Mensual", subtitle: "completadas este mes", get color() { return COLORS.violet; } },
};

function Tareas({ tasks, setTasks, insertTaskRow, patchTaskRow, deleteTaskRow }) {
  const [tab, setTab] = useState("diario");
  const [newTask, setNewTask] = useState("");
  const [editingId, setEditingId] = useState(null);
  const meta = TASK_TIMEFRAME_META[tab];
  const list = tasks[tab];
  const done = list.filter(t => t.done).length;

  function toggle(id) {
    const t = list.find(x => x.id === id);
    if (!t) return;
    const done = !t.done;
    setTasks(prev => ({ ...prev, [tab]: prev[tab].map(x => x.id === id ? { ...x, done } : x) }));
    patchTaskRow(id, { done });
  }
  function remove(id) {
    setTasks(prev => ({ ...prev, [tab]: prev[tab].filter(t => t.id !== id) }));
    deleteTaskRow(id);
    if (editingId === id) cancelEdit();
  }
  function startEdit(t) { setEditingId(t.id); setNewTask(t.title); }
  function cancelEdit() { setEditingId(null); setNewTask(""); }
  async function add() {
    if (!newTask.trim()) return;
    if (editingId) {
      setTasks(prev => ({ ...prev, [tab]: prev[tab].map(t => t.id === editingId ? { ...t, title: newTask } : t) }));
      patchTaskRow(editingId, { title: newTask });
    } else {
      const created = await insertTaskRow(tab, newTask);
      if (created) setTasks(prev => ({ ...prev, [tab]: [...prev[tab], created] }));
    }
    cancelEdit();
  }

  return (
    <div>
      <SectionHeader icon={CheckSquare} title="Tareas" subtitle={`${done} de ${list.length} ${meta.subtitle}`} accent={meta.color} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {Object.entries(TASK_TIMEFRAME_META).map(([key, m]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            ...fontBody, fontSize: 13.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9,
            border: `1px solid ${tab === key ? m.color : COLORS.border}`,
            background: tab === key ? m.color + "22" : "transparent",
            color: tab === key ? m.color : COLORS.muted, cursor: "pointer",
          }}>{m.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
          placeholder={`Nueva tarea ${meta.label.toLowerCase()}`} style={{ ...inputStyle(), marginBottom: 0, flex: 1 }} />
        <PrimaryButton onClick={add} accent={meta.color}>{editingId ? <><Check size={16} /> Guardar</> : <><Plus size={16} /> Agregar</>}</PrimaryButton>
        {editingId && <button onClick={cancelEdit} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <div onClick={() => toggle(t.id)} style={{
              width: 20, height: 20, borderRadius: 6, border: `2px solid ${t.done ? meta.color : COLORS.border}`,
              background: t.done ? meta.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
            }}>
              {t.done && <Check size={13} color={COLORS.onAccent} strokeWidth={3} />}
            </div>
            <span style={{ ...fontBody, flex: 1, fontSize: 14.5, color: t.done ? COLORS.muted : COLORS.paper, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
            <button onClick={() => startEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><Pencil size={14} /></button>
            <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={15} /></button>
          </div>
        ))}
        {list.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>No hay tareas {meta.label.toLowerCase()}s todavía.</p>}
      </div>

      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 32 }}>
          <div style={{ position: "relative", width: 96, height: 96 }}>
            <Ring pct={done / list.length} color={meta.color} size={96} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ ...fontMono, fontSize: 20, fontWeight: 700, color: meta.color }}>{Math.round((done / list.length) * 100)}%</span>
            </div>
          </div>
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13 }}>{done} de {list.length} completadas</p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   HÁBITOS
--------------------------------------------------------- */

const HABIT_TONE_KEYS = ["gold", "teal", "coral", "violet"];

function Habitos({ habits, setHabits, insertHabitRow, patchHabitRow, deleteHabitRow }) {
  const recharts = useRecharts();
  const [selectedDate, setSelectedDate] = useState(null);
  const [newHabit, setNewHabit] = useState({ name: "", toneKey: "gold" });
  const [editingId, setEditingId] = useState(null);
  const { cells, totalDays } = monthMatrix(CAL_YEAR, CAL_MONTH);
  const isMobile = useIsMobile();

  function toggleDate(habitId, ds) {
    const h = habits.find(x => x.id === habitId);
    if (!h) return;
    const newHistory = { ...h.history, [ds]: h.history[ds] ? 0 : 1 };
    setHabits(prev => prev.map(x => x.id === habitId ? { ...x, history: newHistory } : x));
    patchHabitRow(habitId, { history: newHistory });
  }
  function startEditHabit(h) { setEditingId(h.id); setNewHabit({ name: h.name, toneKey: h.toneKey }); }
  function cancelEdit() { setEditingId(null); setNewHabit({ name: "", toneKey: "gold" }); }
  async function addHabit() {
    if (!newHabit.name.trim()) return;
    if (editingId) {
      setHabits(prev => prev.map(h => h.id === editingId ? { ...h, name: newHabit.name.trim(), toneKey: newHabit.toneKey } : h));
      patchHabitRow(editingId, { name: newHabit.name.trim(), toneKey: newHabit.toneKey });
    } else {
      const created = await insertHabitRow(newHabit.name.trim(), newHabit.toneKey);
      if (created) setHabits(prev => [...prev, created]);
    }
    cancelEdit();
  }
  function removeHabit(id) { setHabits(prev => prev.filter(h => h.id !== id)); deleteHabitRow(id); if (editingId === id) cancelEdit(); }

  function streakUpTo(history, dayCount) {
    let s = 0;
    for (let d = dayCount; d >= 1; d--) { if (history[dateStr(d)]) s++; else break; }
    return s;
  }

  const dailyPct = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(d);
      const doneCount = habits.filter(h => h.history[ds]).length;
      arr.push({ day: String(d), pct: habits.length ? Math.round((doneCount / habits.length) * 100) : 0 });
    }
    return arr;
  }, [habits, totalDays]);

  const totalPossible = habits.length * totalDays;
  const totalDone = habits.reduce((acc, h) => acc + Object.values(h.history).filter(Boolean).length, 0);
  const eficacia = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;

  const bestHabit = habits.reduce((best, h) => {
    const count = Object.values(h.history).filter(Boolean).length;
    return (!best || count > best.count) ? { name: h.name, count, color: COLORS[h.toneKey] } : best;
  }, null);

  const diasPerfectos = dailyPct.filter(d => d.pct === 100).length;
  const selectedList = selectedDate ? habits.filter(h => h.history[selectedDate]) : [];

  return (
    <div>
      <SectionHeader icon={Flame} title="Hábitos" subtitle="Tu bitácora de constancia" accent={COLORS.teal} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Eficacia general" value={`${eficacia}%`} sub={`${totalDone} de ${totalPossible} días posibles`} accent={COLORS.teal} />
        <StatCard label="Hábito más constante" value={bestHabit?.name || "—"} sub={bestHabit ? `${bestHabit.count} días cumplidos` : ""} accent={COLORS.gold} />
        <StatCard label="Días perfectos" value={diasPerfectos} sub={`de ${totalDays} días, todos los hábitos`} accent={COLORS.violet} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>{editingId ? "Editar hábito" : "Agregar hábito"}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <input value={newHabit.name} onChange={e => setNewHabit({ ...newHabit, name: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addHabit()}
            placeholder="Ej. Meditar 10 min" style={{ ...inputStyle(), marginBottom: 0, flex: 1, minWidth: 160 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {HABIT_TONE_KEYS.map(k => (
              <div key={k} onClick={() => setNewHabit({ ...newHabit, toneKey: k })} style={{
                width: 34, height: 34, borderRadius: 8, cursor: "pointer", background: COLORS[k],
                outline: newHabit.toneKey === k ? `2px solid ${COLORS.paper}` : "none", outlineOffset: 2,
              }} />
            ))}
          </div>
          <PrimaryButton onClick={addHabit} accent={COLORS.teal}>{editingId ? <><Check size={16} /> Guardar</> : <><Plus size={16} /> Agregar</>}</PrimaryButton>
          {editingId && <button onClick={cancelEdit} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>}
        </div>

        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 14px" }}>Semana actual (1–7 de julio)</p>
        {habits.length === 0 ? (
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>No hay hábitos todavía. Agrega el primero arriba.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 500 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(7, 34px) 70px 24px 24px", gap: 8, alignItems: "center", marginBottom: 14 }}>
                <span></span>
                {DAY_LABELS.map((d, i) => <span key={i} style={{ ...fontMono, textAlign: "center", color: COLORS.muted, fontSize: 12 }}>{d}</span>)}
                <span style={{ ...fontMono, textAlign: "right", color: COLORS.muted, fontSize: 12 }}>racha</span>
                <span></span>
                <span></span>
              </div>
              {habits.map(h => {
                const hColor = COLORS[h.toneKey];
                return (
                <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr repeat(7, 34px) 70px 24px 24px", gap: 8, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
                  <span style={{ ...fontBody, color: COLORS.paper, fontSize: 14 }}>{h.name}</span>
                  {[1, 2, 3, 4, 5, 6, 7].map(d => {
                    const ds = dateStr(d);
                    const done = !!h.history[ds];
                    return (
                      <div key={d} onClick={() => toggleDate(h.id, ds)} style={{
                        width: 22, height: 22, margin: "0 auto", borderRadius: 5, cursor: "pointer",
                        background: done ? hColor : "transparent", border: `1.5px solid ${done ? hColor : COLORS.border}`,
                      }} />
                    );
                  })}
                  <span style={{ ...fontMono, textAlign: "right", color: hColor, fontSize: 13, fontWeight: 600 }}>{streakUpTo(h.history, 7)} días</span>
                  <button onClick={() => startEditHabit(h)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, justifySelf: "center" }}><Pencil size={13} /></button>
                  <button onClick={() => removeHabit(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, justifySelf: "center" }}><X size={14} /></button>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>Calendario de cumplimiento · {MONTH_LABEL}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
            {WEEKDAY_LABELS.map(w => (
              <span key={w} style={{ ...fontMono, textAlign: "center", color: COLORS.muted, fontSize: 11, letterSpacing: 0.5 }}>{w}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = dateStr(d);
              const doneCount = habits.filter(h => h.history[ds]).length;
              const pct = habits.length ? doneCount / habits.length : 0;
              const isSelected = ds === selectedDate;
              const alphaHex = Math.round(20 + pct * 60).toString(16).padStart(2, "0");
              return (
                <div key={i} onClick={() => setSelectedDate(ds)} style={{
                  minHeight: 46, borderRadius: 8, padding: "6px 0 0 8px", cursor: "pointer",
                  background: pct > 0 ? COLORS.teal + alphaHex : COLORS.elevated,
                  border: `1px solid ${isSelected ? COLORS.teal : COLORS.border}`,
                }}>
                  <span style={{ ...fontMono, fontSize: 12, color: pct > 0.5 ? COLORS.onAccent : COLORS.muted }}>{d}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
            <span style={{ ...fontBody, fontSize: 11.5, color: COLORS.muted }}>Menos</span>
            {[0.15, 0.35, 0.55, 0.75, 0.95].map((a, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: COLORS.teal + Math.round(a * 255).toString(16).padStart(2, "0") }} />
            ))}
            <span style={{ ...fontBody, fontSize: 11.5, color: COLORS.muted }}>Más</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
            <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>% de hábitos cumplidos por día</p>
            <div style={{ height: 160 }}>
              {!recharts ? <ChartLoading height={160} /> : (
                <recharts.ResponsiveContainer width="100%" height="100%">
                  <recharts.BarChart data={dailyPct}>
                    <recharts.CartesianGrid stroke={COLORS.border} vertical={false} />
                    <recharts.XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickLine={false} interval={2} />
                    <recharts.YAxis domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={32} />
                    <recharts.Tooltip
                      contentStyle={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.paper, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
                      formatter={v => `${v}%`}
                      labelFormatter={l => `Día ${l}`}
                      labelStyle={{ color: COLORS.muted }}
                    />
                    <recharts.Bar dataKey="pct" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
                  </recharts.BarChart>
                </recharts.ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
            <p style={{ ...fontBody, color: COLORS.paper, fontWeight: 600, fontSize: 14, margin: "0 0 10px" }}>
              {selectedDate ? `Hábitos del ${selectedDate.slice(8, 10)}/${selectedDate.slice(5, 7)}` : "Selecciona un día del calendario"}
            </p>
            {selectedDate && selectedList.length === 0 && (
              <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13 }}>Ningún hábito cumplido ese día.</p>
            )}
            {selectedList.map(h => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[h.toneKey] }} />
                <span style={{ ...fontBody, color: COLORS.paper, fontSize: 13.5 }}>{h.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PRODUCTOS TESTEADOS
--------------------------------------------------------- */

function Productos({ products, setProducts, insertProductRow, patchProductRow, deleteProductRow }) {
  const [form, setForm] = useState({ name: "", testDate: `${CAL_YEAR}-${String(CAL_MONTH + 1).padStart(2, "0")}-01`, investment: "", sales: "", notes: "" });
  const [editingId, setEditingId] = useState(null);

  function cycleStatus(id) {
    const order = ["En prueba", "Ganador", "Perdedor"];
    const p = products.find(x => x.id === id);
    if (!p) return;
    const status = order[(order.indexOf(p.status) + 1) % order.length];
    setProducts(prev => prev.map(x => x.id === id ? { ...x, status } : x));
    patchProductRow(id, { status });
  }
  function startEditProduct(p) {
    setEditingId(p.id);
    setForm({ name: p.name, testDate: p.testDate, investment: String(p.investment), sales: String(p.sales), notes: p.notes });
  }
  function cancelEdit() { setEditingId(null); setForm({ name: "", testDate: `${CAL_YEAR}-${String(CAL_MONTH + 1).padStart(2, "0")}-01`, investment: "", sales: "", notes: "" }); }
  async function addProduct() {
    if (!form.name.trim()) return;
    const investment = Number(form.investment) || 0;
    const sales = Number(form.sales) || 0;
    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? { ...p, name: form.name.trim(), testDate: form.testDate, investment, sales, notes: form.notes } : p));
      patchProductRow(editingId, { name: form.name.trim(), testDate: form.testDate, investment, sales, notes: form.notes });
    } else {
      const created = await insertProductRow({ name: form.name.trim(), testDate: form.testDate, investment, sales, notes: form.notes });
      if (created) setProducts(prev => [...prev, created]);
    }
    cancelEdit();
  }
  function removeProduct(id) { setProducts(prev => prev.filter(p => p.id !== id)); deleteProductRow(id); if (editingId === id) cancelEdit(); }

  return (
    <div>
      <SectionHeader icon={Package} title="Productos testeados" subtitle={`${products.length} productos en el historial`} accent={COLORS.teal} />

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>{editingId ? "Editar producto" : "Agregar producto"}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre del producto" style={{ ...inputStyle(), marginBottom: 0 }} />
          <input type="date" value={form.testDate} onChange={e => setForm({ ...form, testDate: e.target.value })} style={{ ...inputStyle(), marginBottom: 0 }} />
          <input type="number" value={form.investment} onChange={e => setForm({ ...form, investment: e.target.value })} placeholder="Inversión" style={{ ...inputStyle(), marginBottom: 0 }} />
          <input type="number" value={form.sales} onChange={e => setForm({ ...form, sales: e.target.value })} placeholder="Ventas" style={{ ...inputStyle(), marginBottom: 0 }} />
        </div>
        <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas (opcional)" style={{ ...inputStyle(), marginBottom: 12 }} onKeyDown={e => e.key === "Enter" && addProduct()} />
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryButton onClick={addProduct} accent={COLORS.teal}>{editingId ? <><Check size={16} /> Guardar cambios</> : <><Plus size={16} /> Agregar producto</>}</PrimaryButton>
          {editingId && <button onClick={cancelEdit} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>}
        </div>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        {products.length === 0 ? (
          <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5, padding: 20 }}>No hay productos testeados todavía.</p>
        ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 0.8fr 1.3fr 24px 24px", gap: 16, padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, minWidth: 800 }}>
            {["Producto", "Fecha", "Inversión", "Ventas", "ROI", "Estado", "", ""].map((h, i) => (
              <span key={i} style={{ ...fontBody, color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</span>
            ))}
          </div>
          {products.map(p => {
            const roi = p.investment ? ((p.sales - p.investment) / p.investment) * 100 : null;
            const sm = STATUS_META[p.status];
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 0.8fr 1.3fr 24px 24px", gap: 16, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center", minWidth: 800 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...fontBody, color: COLORS.paper, fontSize: 14, fontWeight: 500, margin: 0 }}>{p.name}</p>
                  <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12, margin: "3px 0 0" }}>{p.notes}</p>
                </div>
                <span style={{ ...fontMono, color: COLORS.muted, fontSize: 13, whiteSpace: "nowrap" }}>{p.testDate}</span>
                <span style={{ ...fontMono, color: COLORS.paper, fontSize: 13, whiteSpace: "nowrap" }}>{fmtCOP(p.investment)}</span>
                <span style={{ ...fontMono, color: COLORS.paper, fontSize: 13, whiteSpace: "nowrap" }}>{fmtCOP(p.sales)}</span>
                <span style={{ ...fontMono, color: roi === null ? COLORS.muted : roi >= 0 ? COLORS.teal : COLORS.coral, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                  {roi === null ? "—" : <>{roi >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {roi.toFixed(0)}%</>}
                </span>
                <button onClick={() => cycleStatus(p.id)} style={{
                  ...fontBody, justifySelf: "start", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                  padding: "6px 12px", borderRadius: 20, background: sm.dim, color: sm.color, whiteSpace: "nowrap",
                }}>{p.status}</button>
                <button onClick={() => startEditProduct(p)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><Pencil size={13} /></button>
                <button onClick={() => removeProduct(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={14} /></button>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   RUTINA — línea de tiempo por horas (día / semana)
--------------------------------------------------------- */

const DAY_START_MIN = 5 * 60;   // 5:00 AM — rango por defecto, preparado para ser configurable
const DAY_END_MIN = 24 * 60;    // 12:00 AM
const SNAP_MIN = 15;            // precisión interna en minutos
const PX_HOUR_DAY = 64;
const PX_HOUR_WEEK = 48;
const DEFAULT_CUSTOM_COLOR = "#8B93A0";
const BLOCK_TYPES = {
  enfoque: { label: "Enfoque profundo", icon: Brain, get tone() { return COLORS.violet; } },
  operativo: { label: "Operativo", icon: Briefcase, get tone() { return COLORS.gold; } },
  descanso: { label: "Descanso", icon: Coffee, get tone() { return COLORS.teal; } },
  movimiento: { label: "Movimiento", icon: Activity, get tone() { return COLORS.coral; } },
  otra: { label: "Otra", icon: MoreHorizontal, get tone() { return COLORS.muted; } },
};
const SOURCE_META = {
  tarea: { label: "Tareas", icon: CheckSquare, defaultType: "operativo", get tone() { return COLORS.gold; } },
  habito: { label: "Hábitos", icon: Flame, defaultType: "descanso", get tone() { return COLORS.teal; } },
  meta: { label: "Metas", icon: Target, defaultType: "enfoque", get tone() { return COLORS.violet; } },
};
const ES_DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const REPEAT_OPTIONS = [["no", "No se repite"], ["diario", "Cada día"], ["semanal", "Cada semana"]];
const RATING_OPTIONS = ["Excelente", "Bien", "Normal", "Difícil", "Muy duro"];
const FEELING_OPTIONS = ["😄", "🙂", "😐", "😕", "😫"];

function isoDateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISODate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDaysISO(s, n) { const d = parseISODate(s); d.setDate(d.getDate() + n); return isoDateLocal(d); }
function mondayOfWeekISO(s) { const d = parseISODate(s); return addDaysISO(s, -((d.getDay() + 6) % 7)); }
function fmtTime(min) {
  const m = Math.max(0, Math.min(1440, min));
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function snapToGrid(min) { return Math.round(min / SNAP_MIN) * SNAP_MIN; }

// ¿La actividad ocurre en esta fecha? (fecha exacta o repetición diaria/semanal)
function occursOn(a, ds) {
  if (a.date === ds) return true;
  if (ds < a.date) return false;
  if (a.repeat === "diario") return true;
  if (a.repeat === "semanal") return parseISODate(a.date).getDay() === parseISODate(ds).getDay();
  return false;
}

// Asigna carriles a bloques que se solapan para que no se tapen entre sí
function layoutLanes(list) {
  const sorted = [...list].sort((x, y) => x.start - y.start || x.end - y.end);
  const laneEnds = [];
  const placed = sorted.map(a => {
    let lane = laneEnds.findIndex(end => end <= a.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(a.end); }
    else laneEnds[lane] = a.end;
    return { a, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

function fmtDuration(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Rutina({ activities, setActivities, completions, setCompletions, journals, setJournals, tasks, setTasks, habits, setHabits, goals, setGoals, patchGoalRow, patchTaskRow, patchHabitRow, insertActivityRow, patchActivityRow, deleteActivityRow, toggleCompletionRow, patchJournalRow }) {
  const todayISO = isoDateLocal(new Date());
  const [viewMode, setViewMode] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [editor, setEditor] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const movedRef = useRef(false);
  const dayTrackRef = useRef(null);
  const journalSaveTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 30000);
    return () => clearInterval(t);
  }, []);

  const dayStart = DAY_START_MIN, dayEnd = DAY_END_MIN;
  const timeOptions = useMemo(() => {
    const opts = []; for (let m = dayStart; m <= dayEnd; m += SNAP_MIN) opts.push(m); return opts;
  }, [dayStart, dayEnd]);

  const weekDays = useMemo(() => {
    const mon = mondayOfWeekISO(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(mon, i));
  }, [selectedDate]);

  const minuteToY = (min, px) => (min - dayStart) / 60 * px;
  const trackH = px => (dayEnd - dayStart) / 60 * px;

  const actsFor = ds => activities.filter(a => occursOn(a, ds));

  function isDone(a, ds) {
    if (a.source) {
      if (a.source.kind === "tarea") return !!tasks.diario.find(t => t.id === a.source.id)?.done;
      if (a.source.kind === "habito") return !!habits.find(h => h.id === a.source.id)?.history[ds];
      if (a.source.kind === "meta") return !!goals.diario.find(g => g.id === a.source.id)?.done;
    }
    return !!completions[`${a.id}|${ds}`];
  }
  function toggleActivityDone(a, ds) {
    if (a.source) {
      if (a.source.kind === "tarea") {
        const t = tasks.diario.find(x => x.id === a.source.id);
        const done = !t?.done;
        setTasks(prev => ({ ...prev, diario: prev.diario.map(x => x.id === a.source.id ? { ...x, done } : x) }));
        patchTaskRow(a.source.id, { done });
        return;
      }
      if (a.source.kind === "habito") {
        const h = habits.find(x => x.id === a.source.id);
        const newHistory = { ...h?.history, [ds]: h?.history[ds] ? 0 : 1 };
        setHabits(prev => prev.map(x => x.id === a.source.id ? { ...x, history: newHistory } : x));
        patchHabitRow(a.source.id, { history: newHistory });
        return;
      }
      if (a.source.kind === "meta") {
        const g = goals.diario.find(x => x.id === a.source.id);
        const done = !g?.done;
        setGoals(prev => ({ ...prev, diario: prev.diario.map(x => x.id === a.source.id ? { ...x, done } : x) }));
        patchGoalRow(a.source.id, { done });
        return;
      }
    }
    const done = !completions[`${a.id}|${ds}`];
    setCompletions(prev => ({ ...prev, [`${a.id}|${ds}`]: done }));
    toggleCompletionRow(a.id, ds, done);
  }
  function isScheduledToday(kind, id) {
    return activities.some(a => a.source?.kind === kind && a.source?.id === id && occursOn(a, todayISO));
  }

  function openNew(ds, min) {
    const start = Math.max(dayStart, Math.min(dayEnd - SNAP_MIN, snapToGrid(min)));
    setEditor({ mode: "new", date: ds, title: "", start, end: Math.min(dayEnd, start + 60), type: "operativo", category: "", customColor: DEFAULT_CUSTOM_COLOR, description: "", repeat: "no" });
  }
  function handleTrackClick(e, ds, px) {
    const rect = e.currentTarget.getBoundingClientRect();
    openNew(ds, dayStart + (e.clientY - rect.top) / px * 60);
  }
  async function saveEditor() {
    if (!editor.title.trim() || editor.end <= editor.start) return;
    const data = { date: editor.date, title: editor.title.trim(), start: editor.start, end: editor.end, type: editor.type, customColor: editor.customColor, category: editor.category, description: editor.description, repeat: editor.repeat };
    if (editor.mode === "new") {
      const created = await insertActivityRow(data);
      if (created) setActivities(prev => [...prev, created]);
    } else {
      setActivities(prev => prev.map(a => a.id === editor.id ? { ...a, ...data } : a));
      patchActivityRow(editor.id, data);
    }
    setEditor(null);
  }

  // Arrastrar una pendiente (Tarea/Hábito/Meta) desde el panel "Planea tu día" hasta el timeline
  function startPanelDrag(e, item, kind) {
    e.preventDefault();
    const move = ev => setGhost({ x: ev.clientX, y: ev.clientY, label: item.title, tone: SOURCE_META[kind].tone });
    const up = async ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      const rect = dayTrackRef.current?.getBoundingClientRect();
      if (!rect || ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      const min = snapToGrid(dayStart + (ev.clientY - rect.top) / PX_HOUR_DAY * 60);
      const start = Math.max(dayStart, Math.min(dayEnd - 45, min));
      const data = {
        date: todayISO, title: item.title, start, end: Math.min(dayEnd, start + 45),
        type: SOURCE_META[kind].defaultType, category: "", description: "", repeat: "no", source: { kind, id: item.id },
      };
      const created = await insertActivityRow(data);
      if (created) setActivities(prev => [...prev, created]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    move(e);
  }

  // Drag para mover (vertical = hora, horizontal en semana = día) y resize desde el borde inferior
  function startDrag(e, a, dragMode, px, colInfo) {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (colInfo && !colInfo.width) colInfo = { ...colInfo, width: e.currentTarget.parentElement.getBoundingClientRect().width };
    const startX = e.clientX, startY = e.clientY;
    const orig = { start: a.start, end: a.end, date: a.date };
    const dur = a.end - a.start;
    movedRef.current = false;
    let lastPatch = null;
    const move = ev => {
      const dy = ev.clientY - startY, dx = ev.clientX - startX;
      if (Math.abs(dy) > 4 || Math.abs(dx) > 4) movedRef.current = true;
      if (!movedRef.current) return;
      const deltaMin = snapToGrid(dy / px * 60);
      setActivities(prev => prev.map(x => {
        if (x.id !== a.id) return x;
        if (dragMode === "resize") {
          const end = Math.min(dayEnd, Math.max(orig.start + SNAP_MIN, orig.end + deltaMin));
          lastPatch = { end };
          return { ...x, end };
        }
        const start = Math.max(dayStart, Math.min(dayEnd - dur, orig.start + deltaMin));
        let date = orig.date;
        if (colInfo) {
          const idx = Math.max(0, Math.min(6, colInfo.index + Math.round(dx / colInfo.width)));
          date = colInfo.week[idx];
        }
        lastPatch = { start, end: start + dur, date };
        return { ...x, start, end: start + dur, date };
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (lastPatch) patchActivityRow(a.id, lastPatch);
      setTimeout(() => { movedRef.current = false; }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function Block({ a, ds, px, lane, lanes, colInfo, compact }) {
    const typeMeta = BLOCK_TYPES[a.type] || BLOCK_TYPES.operativo;
    const TypeIcon = typeMeta.icon;
    const tone = a.type === "otra" && a.customColor ? a.customColor : typeMeta.tone;
    const done = isDone(a, ds);
    const top = minuteToY(a.start, px);
    const height = Math.max((a.end - a.start) / 60 * px - 2, 16);
    const w = 100 / lanes;
    return (
      <div
        onPointerDown={e => startDrag(e, a, "move", px, colInfo)}
        onClick={e => {
          e.stopPropagation();
          if (movedRef.current) return;
          setEditor({ mode: "edit", id: a.id, date: a.date, title: a.title, start: a.start, end: a.end, category: a.category || "", type: a.type || "operativo", customColor: a.customColor || DEFAULT_CUSTOM_COLOR, description: a.description || "", repeat: a.repeat || "no", source: a.source || null });
        }}
        style={{
          position: "absolute", top, height, left: `calc(${lane * w}% + 3px)`, width: `calc(${w}% - 7px)`,
          background: tone + (done ? "17" : "2b"), borderLeft: `3px solid ${tone}`, borderRadius: 8,
          padding: compact ? "3px 6px" : "5px 9px", cursor: "grab", overflow: "hidden", boxSizing: "border-box",
          userSelect: "none", touchAction: "none", zIndex: 2,
        }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
          {!compact && <TypeIcon size={12} color={tone} style={{ marginTop: 1.5, flexShrink: 0 }} />}
          <span style={{ ...fontBody, flex: 1, fontSize: compact ? 11 : 12.5, fontWeight: 600, lineHeight: 1.25, color: done ? COLORS.muted : COLORS.paper, textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
          <div
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); toggleActivityDone(a, ds); }}
            style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `1.5px solid ${tone}`, background: done ? tone : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {done && <Check size={10} color={COLORS.onAccent} strokeWidth={3} />}
          </div>
        </div>
        {height >= 34 && (
          <p style={{ ...fontMono, fontSize: compact ? 9.5 : 10.5, color: tone, margin: "1px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {fmtTime(a.start)} – {fmtTime(a.end)}{!compact ? ` · ${typeMeta.label}${a.category ? " · " + a.category : ""}` : ""}
          </p>
        )}
        {!compact && height >= 62 && a.description && (
          <p style={{ ...fontBody, fontSize: 11, color: COLORS.muted, margin: "3px 0 0", overflow: "hidden" }}>{a.description}</p>
        )}
        <div onPointerDown={e => startDrag(e, a, "resize", px, colInfo)}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 7, cursor: "ns-resize" }} />
      </div>
    );
  }

  const hourLines = px => {
    const out = [];
    for (let m = dayStart; m <= dayEnd; m += 60) {
      out.push(<div key={m} style={{ position: "absolute", left: 0, right: 0, top: minuteToY(m, px), height: 1, background: COLORS.border, opacity: 0.55, pointerEvents: "none" }} />);
    }
    return out;
  };
  const gutterLabels = px => {
    const out = [];
    for (let m = dayStart; m <= dayEnd; m += 60) {
      out.push(<span key={m} style={{ ...fontMono, position: "absolute", top: minuteToY(m, px) - 7, right: 10, fontSize: 10.5, color: COLORS.muted, letterSpacing: 0.3 }}>{fmtTime(m)}</span>);
    }
    return out;
  };
  const nowLine = px => {
    if (nowMin < dayStart || nowMin > dayEnd) return null;
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: minuteToY(nowMin, px), zIndex: 4, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: -3, top: -3.5, width: 8, height: 8, borderRadius: 4, background: COLORS.coral }} />
        <div style={{ height: 1.5, background: COLORS.coral }} />
      </div>
    );
  };

  const selDate = parseISODate(selectedDate);
  const dayLabel = `${ES_DAYS[selDate.getDay()]}, ${selDate.getDate()} de ${ES_MONTHS[selDate.getMonth()]} ${selDate.getFullYear()}`;
  const monDate = parseISODate(weekDays[0]), sunDate = parseISODate(weekDays[6]);
  const weekLabel = `${monDate.getDate()} de ${ES_MONTHS[monDate.getMonth()]} – ${sunDate.getDate()} de ${ES_MONTHS[sunDate.getMonth()]} ${sunDate.getFullYear()}`;

  const dayActs = actsFor(selectedDate);
  const { placed: dayPlaced, lanes: dayLanes } = layoutLanes(dayActs);
  const doneCount = dayActs.filter(a => isDone(a, selectedDate)).length;
  const journal = journals[selectedDate] || {};
  const setJ = (field, value) => {
    const updated = { ...(journals[selectedDate] || {}), [field]: value };
    setJournals(prev => ({ ...prev, [selectedDate]: updated }));
    clearTimeout(journalSaveTimer.current);
    journalSaveTimer.current = setTimeout(() => patchJournalRow(selectedDate, updated), 600);
  };

  // Composición del día: minutos programados por tipo de bloque + tiempo libre
  const typeMinutes = { enfoque: 0, operativo: 0, descanso: 0, movimiento: 0, otra: 0 };
  dayActs.forEach(a => { typeMinutes[a.type || "operativo"] += Math.max(0, a.end - a.start); });
  const totalDayMin = dayEnd - dayStart;
  const scheduledMin = Object.values(typeMinutes).reduce((s, v) => s + v, 0);
  const freeMin = Math.max(0, totalDayMin - scheduledMin);

  // Pendientes de Tareas/Hábitos/Metas para el panel "Planea tu día" (solo aplica a hoy)
  const pendingTasks = tasks.diario.filter(t => !t.done);
  const pendingHabits = habits.filter(h => !h.history[todayISO]).map(h => ({ id: h.id, title: h.name }));
  const pendingGoals = goals.diario.filter(g => !g.done);
  const hasPending = pendingTasks.length + pendingHabits.length + pendingGoals.length > 0;

  const labelStyle = { ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 };
  const navBtnStyle = { ...fontBody, background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.muted, cursor: "pointer", padding: "7px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" };

  function PendingCard({ item, kind }) {
    const meta = SOURCE_META[kind];
    const Icon = meta.icon;
    const scheduled = isScheduledToday(kind, item.id);
    return (
      <div onPointerDown={e => !scheduled && startPanelDrag(e, item, kind)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9,
        border: `1px solid ${COLORS.border}`, background: COLORS.elevated,
        cursor: scheduled ? "default" : "grab", opacity: scheduled ? 0.5 : 1, userSelect: "none", touchAction: "none",
      }}>
        <Icon size={13} color={meta.tone} style={{ flexShrink: 0 }} />
        <span style={{ ...fontBody, flex: 1, fontSize: 12.5, color: COLORS.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
        {scheduled && <span style={{ ...fontMono, fontSize: 9.5, color: COLORS.teal, whiteSpace: "nowrap" }}>Programada</span>}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader icon={Calendar} title="Rutina" subtitle="Tu día distribuido hora por hora" accent={COLORS.teal} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["dia", "Día"], ["semana", "Semana"]].map(([k, l]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{
              ...fontBody, fontSize: 13.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9,
              border: `1px solid ${viewMode === k ? COLORS.teal : COLORS.border}`,
              background: viewMode === k ? COLORS.teal + "22" : "transparent",
              color: viewMode === k ? COLORS.teal : COLORS.muted, cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setSelectedDate(addDaysISO(selectedDate, viewMode === "dia" ? -1 : -7))} style={navBtnStyle}>
            <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button onClick={() => setSelectedDate(todayISO)} style={navBtnStyle}>Hoy</button>
          <button onClick={() => setSelectedDate(addDaysISO(selectedDate, viewMode === "dia" ? 1 : 7))} style={navBtnStyle}>
            <ChevronRight size={14} />
          </button>
          <span style={{ ...fontMono, color: COLORS.muted, fontSize: 12.5, marginLeft: 4 }}>{viewMode === "dia" ? dayLabel : weekLabel}</span>
        </div>
      </div>
      <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 16px" }}>Haz clic en un espacio libre para crear una actividad. Arrastra un bloque para moverlo o estíralo desde el borde inferior.</p>

      {viewMode === "dia" && (
        <>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
            <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 10px" }}>Composición del día</p>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: COLORS.elevated, marginBottom: 12 }}>
              {Object.entries(BLOCK_TYPES).map(([key, t]) => typeMinutes[key] > 0 && (
                <div key={key} style={{ flex: `${typeMinutes[key]} 0 0%`, background: t.tone }} />
              ))}
              {freeMin > 0 && <div style={{ flex: `${freeMin} 0 0%` }} />}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {Object.entries(BLOCK_TYPES).map(([key, t]) => {
                const Icon = t.icon;
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon size={12} color={t.tone} />
                    <span style={{ ...fontMono, fontSize: 11.5, color: COLORS.muted }}>{t.label} · <span style={{ color: t.tone, fontWeight: 600 }}>{fmtDuration(typeMinutes[key])}</span></span>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...fontMono, fontSize: 11.5, color: COLORS.muted }}>Libre · <span style={{ color: COLORS.paper, fontWeight: 600 }}>{fmtDuration(freeMin)}</span></span>
              </div>
            </div>
          </div>

          {selectedDate === todayISO && (
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <p style={{ ...fontDisplay, color: COLORS.paper, fontSize: 15, fontWeight: 700, margin: "0 0 3px" }}>Planea tu día</p>
              {!hasPending ? (
                <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: 0 }}>Todo tu día está programado. ✓</p>
              ) : (
                <>
                  <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 12px" }}>Arrastra un pendiente hacia el timeline para ubicarlo en tu horario.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    {pendingTasks.length > 0 && (
                      <div>
                        <p style={{ ...fontBody, color: COLORS.gold, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px" }}>Tareas</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pendingTasks.map(t => <PendingCard key={t.id} item={t} kind="tarea" />)}
                        </div>
                      </div>
                    )}
                    {pendingHabits.length > 0 && (
                      <div>
                        <p style={{ ...fontBody, color: COLORS.teal, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px" }}>Hábitos</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pendingHabits.map(h => <PendingCard key={h.id} item={h} kind="habito" />)}
                        </div>
                      </div>
                    )}
                    {pendingGoals.length > 0 && (
                      <div>
                        <p style={{ ...fontBody, color: COLORS.violet, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px" }}>Metas</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pendingGoals.map(g => <PendingCard key={g.id} item={g} kind="meta" />)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "16px 16px 22px 0", display: "flex" }}>
            <div style={{ width: 76, position: "relative", height: trackH(PX_HOUR_DAY), flexShrink: 0 }}>
              {gutterLabels(PX_HOUR_DAY)}
            </div>
            <div ref={dayTrackRef} onClick={e => handleTrackClick(e, selectedDate, PX_HOUR_DAY)}
              style={{ flex: 1, position: "relative", height: trackH(PX_HOUR_DAY), cursor: "copy", marginRight: 16 }}>
              {hourLines(PX_HOUR_DAY)}
              {dayPlaced.map(({ a, lane }) => (
                <Block key={`${a.id}-${selectedDate}`} a={a} ds={selectedDate} px={PX_HOUR_DAY} lane={lane} lanes={dayLanes} colInfo={null} compact={false} />
              ))}
              {selectedDate === todayISO && nowLine(PX_HOUR_DAY)}
            </div>
          </div>

          <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
              <div>
                <h2 style={{ ...fontDisplay, color: COLORS.paper, fontSize: 18, fontWeight: 700, margin: 0 }}>Cierre del día</h2>
                <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "2px 0 0" }}>{dayLabel}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", width: 56, height: 56 }}>
                  <Ring pct={dayActs.length ? doneCount / dayActs.length : 0} color={COLORS.teal} size={56} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ ...fontMono, fontSize: 11, fontWeight: 600, color: COLORS.teal }}>{dayActs.length ? Math.round((doneCount / dayActs.length) * 100) : 0}%</span>
                  </div>
                </div>
                <div>
                  <p style={{ ...fontMono, fontSize: 12.5, color: COLORS.teal, margin: 0 }}>{doneCount} completadas</p>
                  <p style={{ ...fontMono, fontSize: 12.5, color: COLORS.coral, margin: "2px 0 0" }}>{dayActs.length - doneCount} pendientes</p>
                </div>
              </div>
            </div>

            <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 8px" }}>¿Cómo te fue hoy?</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {RATING_OPTIONS.map(r => (
                <button key={r} onClick={() => setJ("rating", journal.rating === r ? null : r)} style={{
                  ...fontBody, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${journal.rating === r ? COLORS.teal : COLORS.border}`,
                  background: journal.rating === r ? COLORS.teal + "22" : "transparent",
                  color: journal.rating === r ? COLORS.teal : COLORS.muted,
                }}>{r}</button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 4 }}>
              <div>
                <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 8px" }}>¿Qué salió bien?</p>
                <textarea value={journal.good || ""} onChange={e => setJ("good", e.target.value)} placeholder="Lo que funcionó hoy…" style={{ ...inputStyle(), minHeight: 70, resize: "vertical" }} />
              </div>
              <div>
                <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 8px" }}>¿Qué podrías mejorar?</p>
                <textarea value={journal.improve || ""} onChange={e => setJ("improve", e.target.value)} placeholder="Lo que ajustarías mañana…" style={{ ...inputStyle(), minHeight: 70, resize: "vertical" }} />
              </div>
            </div>

            <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 8px" }}>¿Cómo te sentiste?</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {FEELING_OPTIONS.map(f => (
                <button key={f} onClick={() => setJ("feeling", journal.feeling === f ? null : f)} style={{
                  fontSize: 19, padding: "5px 11px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${journal.feeling === f ? COLORS.violet : COLORS.border}`,
                  background: journal.feeling === f ? COLORS.violet + "22" : "transparent",
                }}>{f}</button>
              ))}
            </div>

            <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12.5, margin: "0 0 8px" }}>Notas del día</p>
            <textarea value={journal.notes || ""} onChange={e => setJ("notes", e.target.value)} placeholder="Cualquier cosa que quieras recordar de hoy…" style={{ ...inputStyle(), minHeight: 70, resize: "vertical", marginBottom: 0 }} />
          </div>
        </>
      )}

      {viewMode === "semana" && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 14px 22px 0", overflowX: "auto" }}>
          <div style={{ minWidth: 706 }}>
          <div style={{ display: "flex", marginBottom: 6 }}>
            <div style={{ width: 76, flexShrink: 0 }} />
            {weekDays.map((ds, i) => {
              const d = parseISODate(ds);
              const isToday = ds === todayISO;
              return (
                <div key={ds} onClick={() => { setSelectedDate(ds); setViewMode("dia"); }} style={{ flex: 1, textAlign: "center", cursor: "pointer", padding: "4px 0" }}>
                  <p style={{ ...fontMono, fontSize: 10.5, color: isToday ? COLORS.teal : COLORS.muted, margin: 0, letterSpacing: 0.5 }}>{WEEKDAY_LABELS[i]}</p>
                  <p style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: isToday ? COLORS.teal : COLORS.paper, margin: "2px 0 0" }}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ width: 76, position: "relative", height: trackH(PX_HOUR_WEEK), flexShrink: 0 }}>{gutterLabels(PX_HOUR_WEEK)}</div>
            {weekDays.map((ds, di) => {
              const { placed, lanes } = layoutLanes(actsFor(ds));
              return (
                <div key={ds} onClick={e => handleTrackClick(e, ds, PX_HOUR_WEEK)}
                  style={{ flex: 1, position: "relative", height: trackH(PX_HOUR_WEEK), cursor: "copy", borderLeft: `1px solid ${COLORS.border}` }}>
                  {hourLines(PX_HOUR_WEEK)}
                  {placed.map(({ a, lane }) => (
                    <Block key={`${a.id}-${ds}`} a={a} ds={ds} px={PX_HOUR_WEEK} lane={lane} lanes={lanes} colInfo={{ week: weekDays, index: di }} compact />
                  ))}
                  {ds === todayISO && nowLine(PX_HOUR_WEEK)}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {editor && (
        <div onClick={() => setEditor(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 430, maxHeight: "88vh", overflowY: "auto" }}>
            <p style={{ ...fontDisplay, color: COLORS.paper, fontSize: 17, fontWeight: 700, margin: "0 0 16px" }}>
              {editor.mode === "new" ? "Nueva actividad" : "Editar actividad"}
            </p>
            <label style={labelStyle}>Título</label>
            <input value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} placeholder="Ej. Entrenamiento" style={inputStyle()} autoFocus />
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={editor.date} onChange={e => setEditor({ ...editor, date: e.target.value })} style={inputStyle()} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Inicio</label>
                <select value={editor.start} onChange={e => { const start = Number(e.target.value); setEditor({ ...editor, start, end: Math.max(editor.end, start + SNAP_MIN) }); }} style={inputStyle()}>
                  {timeOptions.filter(m => m < dayEnd).map(m => <option key={m} value={m}>{fmtTime(m)}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fin</label>
                <select value={editor.end} onChange={e => setEditor({ ...editor, end: Number(e.target.value) })} style={inputStyle()}>
                  {timeOptions.filter(m => m > editor.start).map(m => <option key={m} value={m}>{fmtTime(m)}</option>)}
                </select>
              </div>
            </div>
            {editor.source && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, ...fontBody, fontSize: 12, color: SOURCE_META[editor.source.kind].tone }}>
                {(() => { const SrcIcon = SOURCE_META[editor.source.kind].icon; return <SrcIcon size={13} />; })()}
                Vinculada a {SOURCE_META[editor.source.kind].label.toLowerCase()} — al marcarla también se completa allí
              </div>
            )}
            <label style={labelStyle}>Tipo de bloque</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {Object.entries(BLOCK_TYPES).map(([key, t]) => {
                const Icon = t.icon;
                const active = editor.type === key;
                return (
                  <button key={key} onClick={() => setEditor({ ...editor, type: key })} style={{
                    ...fontBody, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
                    padding: "7px 12px", borderRadius: 9, cursor: "pointer",
                    border: `1px solid ${active ? t.tone : COLORS.border}`,
                    background: active ? t.tone + "22" : "transparent",
                    color: active ? t.tone : COLORS.muted,
                  }}><Icon size={14} />{t.label}</button>
                );
              })}
            </div>
            {editor.type === "otra" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <input type="color" value={editor.customColor || DEFAULT_CUSTOM_COLOR} onChange={e => setEditor({ ...editor, customColor: e.target.value })}
                  style={{ width: 40, height: 32, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 8, background: "none", cursor: "pointer" }} />
                <span style={{ ...fontMono, fontSize: 12.5, color: COLORS.muted }}>Color personalizado del bloque</span>
              </div>
            )}
            <label style={labelStyle}>Etiqueta (opcional)</label>
            <input value={editor.category} onChange={e => setEditor({ ...editor, category: e.target.value })} placeholder="Ej. Negocio, Salud, Marketing…" style={inputStyle()} />
            <label style={labelStyle}>Repetición</label>
            <select value={editor.repeat} onChange={e => setEditor({ ...editor, repeat: e.target.value })} style={inputStyle()}>
              {REPEAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label style={labelStyle}>Descripción (opcional)</label>
            <textarea value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} style={{ ...inputStyle(), minHeight: 60, resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <PrimaryButton onClick={saveEditor} accent={COLORS.teal}><Check size={16} /> Guardar</PrimaryButton>
              {editor.mode === "edit" && (
                <button onClick={() => { setActivities(prev => prev.filter(a => a.id !== editor.id)); deleteActivityRow(editor.id); setEditor(null); }} style={{
                  ...fontBody, display: "flex", alignItems: "center", gap: 6, background: "transparent",
                  border: `1px solid ${COLORS.coral}`, color: COLORS.coral, fontWeight: 600, fontSize: 14,
                  borderRadius: 10, padding: "10px 16px", cursor: "pointer",
                }}><Trash2 size={15} /> Eliminar</button>
              )}
              <button onClick={() => setEditor(null)} style={{ ...fontBody, marginLeft: "auto", background: "transparent", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {ghost && (
        <div style={{
          position: "fixed", left: ghost.x, top: ghost.y, transform: "translate(-50%, -50%)", zIndex: 100, pointerEvents: "none",
          background: ghost.tone, color: COLORS.onAccent, padding: "6px 14px", borderRadius: 8,
          fontSize: 12.5, fontWeight: 600, ...fontBody, boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
        }}>{ghost.label}</div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   TRADING — calendario mensual de PNL
--------------------------------------------------------- */

function fmtUSD(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
function fmtPct(n) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
const ACCOUNT_PRESETS = [1000, 5000, 10000, 25000, 50000, 100000];

function Trading({ trades, setTrades, accountSize, updateAccountSize, insertTradeRow, patchTradeRow, deleteTradeRow }) {
  const [ym, setYm] = useState({ year: CAL_YEAR, month: CAL_MONTH });
  const [tab, setTab] = useState("pnl");
  const [modalDate, setModalDate] = useState(null);
  const [form, setForm] = useState({ symbol: "", pnl: "" });
  const [editingId, setEditingId] = useState(null);

  const ds = d => `${ym.year}-${String(ym.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const { cells } = monthMatrix(ym.year, ym.month);

  function shiftMonth(delta) {
    setYm(prev => {
      let m = prev.month + delta, y = prev.year;
      if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  }

  const monthPrefix = `${ym.year}-${String(ym.month + 1).padStart(2, "0")}`;
  const monthTrades = trades.filter(t => t.date.startsWith(monthPrefix));
  const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);
  const monthWins = monthTrades.filter(t => t.pnl > 0).length;
  const monthWinRate = monthTrades.length ? Math.round((monthWins / monthTrades.length) * 100) : 0;
  const byDayPnl = {};
  monthTrades.forEach(t => { byDayPnl[t.date] = (byDayPnl[t.date] || 0) + t.pnl; });
  const dayEntries = Object.entries(byDayPnl);
  const bestDay = dayEntries.reduce((m, [d, v]) => (!m || v > m[1]) ? [d, v] : m, null);
  const worstDay = dayEntries.reduce((m, [d, v]) => (!m || v < m[1]) ? [d, v] : m, null);

  async function addTrade() {
    if (!form.symbol.trim() || form.pnl === "") return;
    const symbol = form.symbol.trim().toUpperCase();
    const pnl = Number(form.pnl);
    if (editingId) {
      setTrades(prev => prev.map(t => t.id === editingId ? { ...t, symbol, pnl } : t));
      patchTradeRow(editingId, { symbol, pnl });
    } else {
      const created = await insertTradeRow({ date: modalDate, symbol, pnl });
      if (created) setTrades(prev => [...prev, created]);
    }
    cancelEditTrade();
  }
  function startEditTrade(t) { setEditingId(t.id); setForm({ symbol: t.symbol, pnl: String(t.pnl) }); }
  function cancelEditTrade() { setEditingId(null); setForm({ symbol: "", pnl: "" }); }
  function removeTrade(id) { setTrades(prev => prev.filter(t => t.id !== id)); deleteTradeRow(id); if (editingId === id) cancelEditTrade(); }

  const modalTrades = modalDate ? trades.filter(t => t.date === modalDate).sort((a, b) => a.id - b.id) : [];
  const modalPnl = modalTrades.reduce((s, t) => s + t.pnl, 0);
  const modalWins = modalTrades.filter(t => t.pnl > 0).length;
  const modalWinRate = modalTrades.length ? Math.round((modalWins / modalTrades.length) * 100) : null;

  const pillBtnStyle = active => ({
    ...fontBody, fontWeight: 700, fontSize: 13.5, padding: "8px 20px", border: "none", cursor: "pointer",
    background: active ? COLORS.teal : "transparent", color: active ? COLORS.onAccent : COLORS.muted,
  });
  const navBtnStyle = { background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 9, color: COLORS.paper, cursor: "pointer", padding: "8px 10px", display: "flex" };

  return (
    <div>
      <SectionHeader icon={TrendingUp} title="Trading" subtitle="Tu desempeño diario en el mercado" accent={COLORS.teal} />

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...fontBody, color: COLORS.muted, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Tamaño de cuenta</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ACCOUNT_PRESETS.map(p => (
            <button key={p} onClick={() => updateAccountSize(p)} style={{
              ...fontMono, fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${accountSize === p ? COLORS.teal : COLORS.border}`,
              background: accountSize === p ? COLORS.teal + "22" : "transparent",
              color: accountSize === p ? COLORS.teal : COLORS.muted,
            }}>{p >= 1000 ? `${p / 1000}K` : p}</button>
          ))}
        </div>
        <input type="number" value={accountSize} onChange={e => updateAccountSize(Number(e.target.value) || 0)}
          placeholder="Personalizado" style={{ ...inputStyle(), marginBottom: 0, width: 140 }} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="PNL del mes" value={fmtUSD(monthPnl)} sub={`${monthTrades.length} operaciones`} accent={monthPnl >= 0 ? COLORS.teal : COLORS.coral} />
        <StatCard label="Retorno del mes" value={fmtPct(accountSize ? (monthPnl / accountSize) * 100 : 0)} sub={`sobre cuenta de ${fmtUSD(accountSize)}`} accent={monthPnl >= 0 ? COLORS.teal : COLORS.coral} />
        <StatCard label="% de aciertos" value={`${monthWinRate}%`} sub={`${monthWins} de ${monthTrades.length} operaciones`} accent={COLORS.gold} />
        <StatCard label="Mejor día" value={bestDay ? fmtUSD(bestDay[1]) : "—"} sub={bestDay ? bestDay[0] : "Sin datos"} accent={COLORS.teal} />
        <StatCard label="Peor día" value={worstDay ? fmtUSD(worstDay[1]) : "—"} sub={worstDay ? worstDay[0] : "Sin datos"} accent={COLORS.coral} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <button onClick={() => setTab("pnl")} style={pillBtnStyle(tab === "pnl")}>PNL</button>
            <button onClick={() => setTab("events")} style={pillBtnStyle(tab === "events")}>Events</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => shiftMonth(-1)} style={navBtnStyle}><ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /></button>
            <span style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: COLORS.paper, minWidth: 130, textAlign: "center" }}>{ES_MONTHS[ym.month]} de {ym.year}</span>
            <button onClick={() => shiftMonth(1)} style={navBtnStyle}><ChevronRight size={15} /></button>
          </div>
        </div>

        {tab === "events" ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <p style={{ ...fontBody, color: COLORS.muted, fontSize: 14 }}>Muy pronto podrás registrar eventos del mercado aquí.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 620 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8 }}>
                {WEEKDAY_LABELS.map(w => (
                  <span key={w} style={{ ...fontMono, textAlign: "center", color: COLORS.muted, fontSize: 11, letterSpacing: 0.5 }}>{w}</span>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const dstr = ds(d);
                  const dTrades = trades.filter(t => t.date === dstr);
                  const hasTrades = dTrades.length > 0;
                  const dPnl = dTrades.reduce((s, t) => s + t.pnl, 0);
                  const dReturnPct = accountSize ? (dPnl / accountSize) * 100 : 0;
                  const positive = dPnl >= 0;
                  const tone = positive ? COLORS.teal : COLORS.coral;
                  return (
                    <div key={i} onClick={() => setModalDate(dstr)} style={{
                      minHeight: 84, borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                      background: hasTrades ? tone + "1c" : COLORS.elevated,
                      border: `1px solid ${hasTrades ? tone + "55" : COLORS.border}`,
                    }}>
                      <span style={{ ...fontMono, fontSize: 13, color: COLORS.paper, fontWeight: 600 }}>{d}</span>
                      {hasTrades && (
                        <>
                          <p style={{ ...fontDisplay, fontSize: 14.5, fontWeight: 700, margin: "6px 0 2px", color: tone }}>{fmtUSD(dPnl)}</p>
                          <p style={{ ...fontMono, fontSize: 11, margin: 0, color: tone }}>{fmtPct(dReturnPct)}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {modalDate && (
        <div onClick={() => { setModalDate(null); cancelEditTrade(); }} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }}>
            <p style={{ ...fontDisplay, color: COLORS.paper, fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{modalDate}</p>
            <p style={{ ...fontMono, fontSize: 13, color: modalPnl >= 0 ? COLORS.teal : COLORS.coral, margin: "0 0 16px", fontWeight: 600 }}>
              {fmtUSD(modalPnl)}{modalWinRate !== null ? ` (${fmtPct(accountSize ? (modalPnl / accountSize) * 100 : 0)}) · ${modalWinRate}% aciertos` : " · sin operaciones"}
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} placeholder="Símbolo (ej. NQ)" style={{ ...inputStyle(), marginBottom: 0, flex: 1 }} onKeyDown={e => e.key === "Enter" && addTrade()} />
              <input type="number" value={form.pnl} onChange={e => setForm({ ...form, pnl: e.target.value })} placeholder="PNL" style={{ ...inputStyle(), marginBottom: 0, width: 110 }} onKeyDown={e => e.key === "Enter" && addTrade()} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton onClick={addTrade} accent={COLORS.teal}>{editingId ? <><Check size={16} /> Guardar</> : <><Plus size={16} /> Agregar operación</>}</PrimaryButton>
              {editingId && <button onClick={cancelEditTrade} style={{ ...fontBody, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>}
            </div>

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {modalTrades.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 9 }}>
                  <span style={{ ...fontBody, flex: 1, fontSize: 13.5, color: COLORS.paper, fontWeight: 600 }}>{t.symbol}</span>
                  <span style={{ ...fontMono, fontSize: 13, fontWeight: 600, color: t.pnl >= 0 ? COLORS.teal : COLORS.coral }}>{fmtUSD(t.pnl)}</span>
                  <button onClick={() => startEditTrade(t)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><Pencil size={13} /></button>
                  <button onClick={() => removeTrade(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={14} /></button>
                </div>
              ))}
              {modalTrades.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13 }}>Sin operaciones este día.</p>}
            </div>

            <button onClick={() => { setModalDate(null); cancelEditTrade(); }} style={{ ...fontBody, marginTop: 16, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   AUTENTICACIÓN
--------------------------------------------------------- */

function AuthShell({ children }) {
  const viewportHeight = useViewportHeight();
  return (
    <div style={{
      ...fontBody, height: viewportHeight ? `${viewportHeight}px` : "100dvh", overflowY: "auto", background: COLORS.ink, color: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center",
      paddingTop: "max(20px, env(safe-area-inset-top, 0px))", paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))",
      paddingLeft: "max(20px, env(safe-area-inset-left, 0px))", paddingRight: "max(20px, env(safe-area-inset-right, 0px))",
    }}>
      <div style={{ width: "100%", maxWidth: 380, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, overflow: "hidden", display: "flex", flexShrink: 0 }}><ProgoMark size={38} mode="dark" /></div>
          <ProgoWordmark height={18} mode="dark" />
        </div>
        {children}
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <AuthShell>
      <p style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>Falta conectar Supabase</p>
      <p style={{ ...fontBody, fontSize: 13.5, color: COLORS.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
        Crea un proyecto gratis en supabase.com y pega tu <b>Project URL</b> y <b>anon public key</b> en el archivo <code style={{ ...fontMono, background: COLORS.elevated, padding: "1px 5px", borderRadius: 4 }}>.env</code> de este proyecto (variables <code style={{ ...fontMono }}>VITE_SUPABASE_URL</code> y <code style={{ ...fontMono }}>VITE_SUPABASE_ANON_KEY</code>), luego reinicia el servidor.
      </p>
      <p style={{ ...fontBody, fontSize: 13.5, color: COLORS.muted, margin: 0, lineHeight: 1.5 }}>
        También corre <code style={{ ...fontMono, background: COLORS.elevated, padding: "1px 5px", borderRadius: 4 }}>supabase/schema.sql</code> en el SQL Editor de tu proyecto para crear las tablas.
      </p>
    </AuthShell>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(next) { setMode(next); setError(""); setNotice(""); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setNotice("");
    if (!email.trim() || !password) { setError("Ingresa tu correo y contraseña."); return; }
    setLoading(true);
    setRememberMe(remember);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) setError(error.message);
      else setNotice("Cuenta creada. Si tu proyecto pide confirmación, revisa tu correo antes de iniciar sesión.");
    }
    setLoading(false);
  }

  const tabBtnStyle = active => ({
    ...fontBody, flex: 1, padding: "9px 0", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13.5,
    background: active ? COLORS.teal : "transparent", color: active ? COLORS.onAccent : COLORS.muted,
  });

  return (
    <AuthShell>
      <div style={{ display: "flex", borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden", marginBottom: 20 }}>
        <button type="button" onClick={() => switchMode("login")} style={tabBtnStyle(mode === "login")}>Iniciar sesión</button>
        <button type="button" onClick={() => switchMode("signup")} style={tabBtnStyle(mode === "signup")}>Crear cuenta</button>
      </div>

      <form onSubmit={handleSubmit}>
        <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Correo electrónico</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" style={inputStyle()} autoComplete="email" />
        <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle()} autoComplete={mode === "login" ? "current-password" : "new-password"} />

        <label style={{ ...fontBody, display: "flex", alignItems: "center", gap: 8, color: COLORS.muted, fontSize: 13, margin: "-4px 0 16px", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: COLORS.teal, cursor: "pointer" }} />
          Mantener sesión iniciada en este dispositivo
        </label>

        {error && <p style={{ ...fontBody, color: COLORS.coral, fontSize: 12.5, margin: "0 0 12px" }}>{error}</p>}
        {notice && <p style={{ ...fontBody, color: COLORS.teal, fontSize: 12.5, margin: "0 0 12px" }}>{notice}</p>}

        <button type="submit" disabled={loading} style={{
          ...fontBody, width: "100%", background: COLORS.teal, color: COLORS.onAccent, fontWeight: 700, fontSize: 14,
          border: "none", borderRadius: 10, padding: "11px 0", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
    </AuthShell>
  );
}

function Usuarios({ myId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) setError(error.message); else setRows(data || []);
      setLoading(false);
    });
  }
  useEffect(load, []);

  async function toggleDisabled(row) {
    const { error } = await supabase.from("profiles").update({ disabled: !row.disabled }).eq("id", row.id);
    if (error) { setError(error.message); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, disabled: !r.disabled } : r));
  }

  return (
    <div>
      <SectionHeader icon={Users} title="Usuarios" subtitle="Cuentas registradas en PROGO" accent={COLORS.violet} />
      {error && <p style={{ ...fontBody, color: COLORS.coral, fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 620 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Correo", "Rol", "Registrado", "Estado"].map(h => (
                <span key={h} style={{ ...fontBody, color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</span>
              ))}
            </div>
            {loading && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, padding: 20 }}>Cargando…</p>}
            {!loading && rows.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, padding: 20 }}>Sin usuarios todavía.</p>}
            {rows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                <span style={{ ...fontBody, color: COLORS.paper, fontSize: 13.5 }}>{r.email}</span>
                <span style={{ ...fontMono, color: r.role === "admin" ? COLORS.gold : COLORS.muted, fontSize: 12.5, fontWeight: 600 }}>{r.role === "admin" ? "Admin" : "Usuario"}</span>
                <span style={{ ...fontMono, color: COLORS.muted, fontSize: 12.5 }}>{new Date(r.created_at).toLocaleDateString("es-CO")}</span>
                {r.id === myId ? (
                  <span style={{ ...fontMono, color: COLORS.muted, fontSize: 12 }}>—</span>
                ) : (
                  <button onClick={() => toggleDisabled(r)} style={{
                    ...fontBody, justifySelf: "start", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    padding: "6px 12px", borderRadius: 20,
                    background: r.disabled ? COLORS.coral + "22" : COLORS.teal + "22",
                    color: r.disabled ? COLORS.coral : COLORS.teal,
                  }}>{r.disabled ? "Desactivado" : "Activo"}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   APP SHELL
--------------------------------------------------------- */

const NAV = [
  { key: "resumen", label: "Resumen", icon: LayoutGrid, get accent() { return COLORS.gold; } },
  { key: "gastos", label: "Gastos", icon: Wallet, get accent() { return COLORS.coral; } },
  { key: "ingresos", label: "Ingresos y saldos", icon: PiggyBank, get accent() { return COLORS.teal; } },
  { key: "metas", label: "Metas", icon: Target, get accent() { return COLORS.violet; } },
  { key: "rutina", label: "Rutina", icon: Calendar, get accent() { return COLORS.teal; } },
  { key: "trading", label: "Trading", icon: TrendingUp, get accent() { return COLORS.teal; } },
  { key: "tareas", label: "Tareas diarias", icon: CheckSquare, get accent() { return COLORS.gold; } },
  { key: "habitos", label: "Hábitos", icon: Flame, get accent() { return COLORS.teal; } },
  { key: "productos", label: "Productos testeados", icon: Package, get accent() { return COLORS.teal; } },
];

// Barra inferior móvil (estilo iOS/Instagram): solo las 4 secciones de uso más
// frecuente caben fijas; el resto vive detrás del quinto ícono "Más".
const BOTTOM_TAB_KEYS = ["resumen", "gastos", "rutina", "tareas"];
const BOTTOM_TAB_LABELS = { resumen: "Resumen", gastos: "Gastos", rutina: "Rutina", tareas: "Tareas" };

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [disabledNotice, setDisabledNotice] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setProfileError(""); return; }
    let cancelled = false;
    setProfileLoading(true);
    setProfileError("");
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error?.code === "PGRST116") {
        // No existe el perfil (cuenta creada antes de que existiera la tabla/trigger): lo autocreamos como usuario normal.
        const { data: created, error: insertError } = await supabase.from("profiles")
          .insert({ id: session.user.id, email: session.user.email, role: "user" })
          .select().single();
        if (cancelled) return;
        if (insertError) setProfileError(insertError.message);
        else setProfile(created);
      } else if (error) {
        setProfileError(error.message + (error.code === "PGRST205" || error.status === 404 ? " — ¿ya corriste supabase/schema.sql en el SQL Editor?" : ""));
      } else if (data.disabled) {
        setDisabledNotice(true);
        supabase.auth.signOut();
      } else {
        setProfile(data);
      }
      setProfileLoading(false);
    });
    return () => { cancelled = true; };
  }, [session]);

  const [view, setView] = useState("resumen");
  const [mode, setMode] = useState("dark");
  const [navOpen, setNavOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [goals, setGoals] = useState({ diario: [], semanal: [], mensual: [], trimestral: [] });
  const [tasks, setTasks] = useState({ diario: [], semanal: [], mensual: [] });
  const [habits, setHabits] = useState([]);
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [completions, setCompletions] = useState({});
  const [journals, setJournals] = useState({});
  const [trades, setTrades] = useState([]);
  const [accountSize, setAccountSize] = useState(10000);
  const [incomes, setIncomes] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const isMobile = useIsMobile();
  const viewportHeight = useViewportHeight();

  useEffect(() => {
    // El fondo de <body>/meta theme-color es el que se ve en cualquier
    // hueco que Safari deje por fuera de la app (p.ej. según el estado de
    // su barra de herramientas) — debe seguir el tema activo, si no
    // queda un color fijo (oscuro) asomando cuando la app está en claro.
    const themeColor = mode === "dark" ? DARK_THEME.ink : LIGHT_THEME.ink;
    document.body.style.background = themeColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColor);
  }, [mode]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setFinanceLoading(true);
    (async () => {
      const [goalsRes, incomesRes, egresosRes, catsRes, tasksRes, expensesRes, habitsRes, productsRes, activitiesRes, completionsRes, journalsRes, tradesRes] = await Promise.all([
        supabase.from("goals").select("*").order("id", { ascending: true }),
        supabase.from("incomes").select("*").order("income_date", { ascending: false }).order("id", { ascending: false }),
        supabase.from("egresos").select("*").order("expense_date", { ascending: false }).order("id", { ascending: false }),
        supabase.from("custom_categories").select("*").order("id", { ascending: true }),
        supabase.from("tasks").select("*").order("id", { ascending: true }),
        supabase.from("expenses").select("*").order("date", { ascending: false }).order("id", { ascending: false }),
        supabase.from("habits").select("*").order("id", { ascending: true }),
        supabase.from("products").select("*").order("id", { ascending: true }),
        supabase.from("activities").select("*").order("id", { ascending: true }),
        supabase.from("activity_completions").select("*"),
        supabase.from("journals").select("*"),
        supabase.from("trades").select("*").order("date", { ascending: false }).order("id", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!goalsRes.error) {
        const grouped = { diario: [], semanal: [], mensual: [], trimestral: [] };
        (goalsRes.data || []).forEach(row => { if (grouped[row.timeframe]) grouped[row.timeframe].push(rowToGoal(row)); });
        setGoals(grouped);
      } else console.error("Error cargando metas:", goalsRes.error.message);
      if (!incomesRes.error) setIncomes(incomesRes.data || []);
      else console.error("Error cargando ingresos:", incomesRes.error.message);
      if (!egresosRes.error) setEgresos(egresosRes.data || []);
      else console.error("Error cargando egresos:", egresosRes.error.message);
      if (!catsRes.error) setCustomCategories((catsRes.data || []).map(r => ({ id: r.id, name: r.name, color: r.color })));
      else console.error("Error cargando categorías:", catsRes.error.message);
      if (!tasksRes.error) {
        const grouped = { diario: [], semanal: [], mensual: [] };
        (tasksRes.data || []).forEach(row => { if (grouped[row.timeframe]) grouped[row.timeframe].push({ id: row.id, title: row.title, done: row.done }); });
        setTasks(grouped);
      } else console.error("Error cargando tareas:", tasksRes.error.message);
      if (!expensesRes.error) setExpenses((expensesRes.data || []).map(r => ({ id: r.id, date: r.date, category: r.category, description: r.description, amount: Number(r.amount) })));
      else console.error("Error cargando gastos:", expensesRes.error.message);
      if (!habitsRes.error) setHabits((habitsRes.data || []).map(r => ({ id: r.id, name: r.name, toneKey: r.tone_key, history: r.history || {} })));
      else console.error("Error cargando hábitos:", habitsRes.error.message);
      if (!productsRes.error) setProducts((productsRes.data || []).map(r => ({ id: r.id, name: r.name, testDate: r.test_date, investment: Number(r.investment), sales: Number(r.sales), status: r.status, notes: r.notes })));
      else console.error("Error cargando productos:", productsRes.error.message);
      if (!activitiesRes.error) setActivities((activitiesRes.data || []).map(r => ({ id: r.id, date: r.date, title: r.title, start: r.start_min, end: r.end_min, type: r.type, category: r.category, customColor: r.custom_color, description: r.description, repeat: r.repeat, source: r.source })));
      else console.error("Error cargando actividades:", activitiesRes.error.message);
      if (!completionsRes.error) {
        const map = {};
        (completionsRes.data || []).forEach(r => { map[`${r.activity_id}|${r.occurrence_date}`] = r.done; });
        setCompletions(map);
      } else console.error("Error cargando completados:", completionsRes.error.message);
      if (!journalsRes.error) {
        const map = {};
        (journalsRes.data || []).forEach(r => { map[r.date] = { rating: r.rating, good: r.good, improve: r.improve, feeling: r.feeling, notes: r.notes }; });
        setJournals(map);
      } else console.error("Error cargando journals:", journalsRes.error.message);
      if (!tradesRes.error) setTrades((tradesRes.data || []).map(r => ({ id: r.id, date: r.date, symbol: r.symbol, pnl: Number(r.pnl) })));
      else console.error("Error cargando trades:", tradesRes.error.message);
      if (profile.account_size) setAccountSize(Number(profile.account_size));
      setFinanceLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile]);

  Object.assign(COLORS, mode === "dark" ? DARK_THEME : LIGHT_THEME);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (authLoading) return <AuthShell><p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5, textAlign: "center", margin: 0 }}>Cargando…</p></AuthShell>;
  if (disabledNotice) return <AuthShell><p style={{ ...fontBody, color: COLORS.coral, fontSize: 13.5, textAlign: "center", margin: 0 }}>Tu cuenta fue desactivada. Contacta al administrador.</p></AuthShell>;
  if (!session) return <AuthScreen />;
  if (profileError) return (
    <AuthShell>
      <p style={{ ...fontBody, color: COLORS.coral, fontSize: 13.5, textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>{profileError}</p>
      <button onClick={() => supabase.auth.signOut()} style={{
        ...fontBody, width: "100%", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted,
        fontWeight: 600, fontSize: 13.5, borderRadius: 10, padding: "10px 0", cursor: "pointer",
      }}>Cerrar sesión</button>
    </AuthShell>
  );
  if (profileLoading || !profile) return <AuthShell><p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5, textAlign: "center", margin: 0 }}>Cargando tu perfil…</p></AuthShell>;

  function selectView(key) { setView(key); setNavOpen(false); }

  // --- Persistencia de Metas (tabla `goals`) ---
  async function insertGoalRow(timeframe, payload) {
    const { data, error } = await supabase.from("goals").insert({
      user_id: session.user.id, timeframe,
      title: payload.title,
      done: payload.done ?? null,
      progress: payload.progress ?? null,
      target: payload.target ?? null,
      money: payload.money ?? false,
      goal_type: payload.goalType || "standard",
      financial_target: payload.financialTarget ?? null,
      financial_start_date: payload.financialStartDate ?? null,
    }).select().single();
    if (error) { console.error("Error creando meta:", error.message); return null; }
    return rowToGoal(data);
  }
  async function patchGoalRow(id, patch) {
    const dbPatch = {};
    if ("title" in patch) dbPatch.title = patch.title;
    if ("done" in patch) dbPatch.done = patch.done;
    if ("progress" in patch) dbPatch.progress = patch.progress;
    if ("target" in patch) dbPatch.target = patch.target;
    if ("money" in patch) dbPatch.money = patch.money;
    if ("goalType" in patch) dbPatch.goal_type = patch.goalType;
    if ("financialTarget" in patch) dbPatch.financial_target = patch.financialTarget;
    if ("financialStartDate" in patch) dbPatch.financial_start_date = patch.financialStartDate;
    const { error } = await supabase.from("goals").update(dbPatch).eq("id", id);
    if (error) console.error("Error actualizando meta:", error.message);
  }
  async function deleteGoalRow(id) {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) console.error("Error eliminando meta:", error.message);
  }

  // --- Persistencia de Ingresos (tabla `incomes`) — única fuente de verdad para `incomes` ---
  async function addIncome(payload) {
    const { data, error } = await supabase.from("incomes").insert({
      user_id: session.user.id, amount: payload.amount, concept: payload.concept,
      category: payload.category || null, note: payload.note || null, income_date: payload.date,
    }).select().single();
    if (error) return { error };
    setIncomes(prev => [data, ...prev].sort((a, b) => b.income_date.localeCompare(a.income_date) || b.id - a.id));
    return { data };
  }
  async function editIncome(id, payload) {
    const { data, error } = await supabase.from("incomes").update({
      amount: payload.amount, concept: payload.concept,
      category: payload.category || null, note: payload.note || null, income_date: payload.date,
    }).eq("id", id).select().single();
    if (error) return { error };
    setIncomes(prev => prev.map(i => i.id === id ? data : i).sort((a, b) => b.income_date.localeCompare(a.income_date) || b.id - a.id));
    return { data };
  }
  async function deleteIncome(id) {
    const { error } = await supabase.from("incomes").delete().eq("id", id);
    if (error) return { error };
    setIncomes(prev => prev.filter(i => i.id !== id));
    return {};
  }

  // --- Persistencia de Egresos (tabla `egresos`) — única fuente de verdad para `egresos` ---
  async function addEgreso(payload) {
    const { data, error } = await supabase.from("egresos").insert({
      user_id: session.user.id, amount: payload.amount, concept: payload.concept,
      category: payload.category || null, note: payload.note || null, expense_date: payload.date,
    }).select().single();
    if (error) return { error };
    setEgresos(prev => [data, ...prev].sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id));
    return { data };
  }
  async function editEgreso(id, payload) {
    const { data, error } = await supabase.from("egresos").update({
      amount: payload.amount, concept: payload.concept,
      category: payload.category || null, note: payload.note || null, expense_date: payload.date,
    }).eq("id", id).select().single();
    if (error) return { error };
    setEgresos(prev => prev.map(e => e.id === id ? data : e).sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id));
    return { data };
  }
  async function deleteEgreso(id) {
    const { error } = await supabase.from("egresos").delete().eq("id", id);
    if (error) return { error };
    setEgresos(prev => prev.filter(e => e.id !== id));
    return {};
  }

  // --- Ingreso mensual configurable (columna en `profiles`, usado en Gastos) ---
  async function updateMonthlyIncome(value) {
    const { data, error } = await supabase.from("profiles").update({ monthly_income: value }).eq("id", session.user.id).select().single();
    if (error) return { error };
    setProfile(data);
    return { data };
  }

  // --- Categorías de gasto personalizadas (tabla `custom_categories`) ---
  async function addCustomCategory(name, color) {
    const { data, error } = await supabase.from("custom_categories").insert({ user_id: session.user.id, name, color }).select().single();
    if (error) return { error };
    const created = { id: data.id, name: data.name, color: data.color };
    setCustomCategories(prev => [...prev, created]);
    return { data: created };
  }

  // --- Persistencia de Tareas (tabla `tasks`) ---
  async function insertTaskRow(timeframe, title) {
    const { data, error } = await supabase.from("tasks").insert({ user_id: session.user.id, timeframe, title, done: false }).select().single();
    if (error) { console.error("Error creando tarea:", error.message); return null; }
    return { id: data.id, title: data.title, done: data.done };
  }
  async function patchTaskRow(id, patch) {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) console.error("Error actualizando tarea:", error.message);
  }
  async function deleteTaskRow(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) console.error("Error eliminando tarea:", error.message);
  }

  // --- Persistencia de Gastos (tabla `expenses`) ---
  async function insertExpenseRow(payload) {
    const { data, error } = await supabase.from("expenses").insert({
      user_id: session.user.id, date: payload.date, category: payload.category,
      description: payload.description, amount: payload.amount,
    }).select().single();
    if (error) { console.error("Error creando gasto:", error.message); return null; }
    return { id: data.id, date: data.date, category: data.category, description: data.description, amount: Number(data.amount) };
  }
  async function patchExpenseRow(id, patch) {
    const { error } = await supabase.from("expenses").update(patch).eq("id", id);
    if (error) console.error("Error actualizando gasto:", error.message);
  }
  async function deleteExpenseRow(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) console.error("Error eliminando gasto:", error.message);
  }

  // --- Persistencia de Hábitos (tabla `habits`) ---
  async function insertHabitRow(name, toneKey) {
    const { data, error } = await supabase.from("habits").insert({ user_id: session.user.id, name, tone_key: toneKey, history: {} }).select().single();
    if (error) { console.error("Error creando hábito:", error.message); return null; }
    return { id: data.id, name: data.name, toneKey: data.tone_key, history: data.history || {} };
  }
  async function patchHabitRow(id, patch) {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("toneKey" in patch) dbPatch.tone_key = patch.toneKey;
    if ("history" in patch) dbPatch.history = patch.history;
    const { error } = await supabase.from("habits").update(dbPatch).eq("id", id);
    if (error) console.error("Error actualizando hábito:", error.message);
  }
  async function deleteHabitRow(id) {
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) console.error("Error eliminando hábito:", error.message);
  }

  // --- Persistencia de Productos testeados (tabla `products`) ---
  async function insertProductRow(payload) {
    const { data, error } = await supabase.from("products").insert({
      user_id: session.user.id, name: payload.name, test_date: payload.testDate,
      investment: payload.investment, sales: payload.sales, status: "En prueba", notes: payload.notes,
    }).select().single();
    if (error) { console.error("Error creando producto:", error.message); return null; }
    return { id: data.id, name: data.name, testDate: data.test_date, investment: Number(data.investment), sales: Number(data.sales), status: data.status, notes: data.notes };
  }
  async function patchProductRow(id, patch) {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("testDate" in patch) dbPatch.test_date = patch.testDate;
    if ("investment" in patch) dbPatch.investment = patch.investment;
    if ("sales" in patch) dbPatch.sales = patch.sales;
    if ("status" in patch) dbPatch.status = patch.status;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    const { error } = await supabase.from("products").update(dbPatch).eq("id", id);
    if (error) console.error("Error actualizando producto:", error.message);
  }
  async function deleteProductRow(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) console.error("Error eliminando producto:", error.message);
  }

  // --- Persistencia de Rutina (tablas `activities`, `activity_completions`, `journals`) ---
  async function insertActivityRow(payload) {
    const { data, error } = await supabase.from("activities").insert({
      user_id: session.user.id, date: payload.date, title: payload.title,
      start_min: payload.start, end_min: payload.end, type: payload.type,
      category: payload.category || "", custom_color: payload.customColor || null,
      description: payload.description || "", repeat: payload.repeat || "no", source: payload.source || null,
    }).select().single();
    if (error) { console.error("Error creando actividad:", error.message); return null; }
    return { id: data.id, date: data.date, title: data.title, start: data.start_min, end: data.end_min, type: data.type, category: data.category, customColor: data.custom_color, description: data.description, repeat: data.repeat, source: data.source };
  }
  async function patchActivityRow(id, patch) {
    const dbPatch = {};
    if ("date" in patch) dbPatch.date = patch.date;
    if ("title" in patch) dbPatch.title = patch.title;
    if ("start" in patch) dbPatch.start_min = patch.start;
    if ("end" in patch) dbPatch.end_min = patch.end;
    if ("type" in patch) dbPatch.type = patch.type;
    if ("category" in patch) dbPatch.category = patch.category;
    if ("customColor" in patch) dbPatch.custom_color = patch.customColor;
    if ("description" in patch) dbPatch.description = patch.description;
    if ("repeat" in patch) dbPatch.repeat = patch.repeat;
    const { error } = await supabase.from("activities").update(dbPatch).eq("id", id);
    if (error) console.error("Error actualizando actividad:", error.message);
  }
  async function deleteActivityRow(id) {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) console.error("Error eliminando actividad:", error.message);
  }
  async function toggleCompletionRow(activityId, occurrenceDate, done) {
    const { error } = await supabase.from("activity_completions")
      .upsert({ user_id: session.user.id, activity_id: activityId, occurrence_date: occurrenceDate, done }, { onConflict: "user_id,activity_id,occurrence_date" });
    if (error) console.error("Error guardando completado:", error.message);
  }
  async function patchJournalRow(date, patch) {
    const { error } = await supabase.from("journals")
      .upsert({ user_id: session.user.id, date, ...patch }, { onConflict: "user_id,date" });
    if (error) console.error("Error guardando journal:", error.message);
  }

  // --- Persistencia de Trading (tabla `trades`) ---
  async function insertTradeRow(payload) {
    const { data, error } = await supabase.from("trades").insert({ user_id: session.user.id, date: payload.date, symbol: payload.symbol, pnl: payload.pnl }).select().single();
    if (error) { console.error("Error creando operación:", error.message); return null; }
    return { id: data.id, date: data.date, symbol: data.symbol, pnl: Number(data.pnl) };
  }
  async function patchTradeRow(id, patch) {
    const { error } = await supabase.from("trades").update(patch).eq("id", id);
    if (error) console.error("Error actualizando operación:", error.message);
  }
  async function deleteTradeRow(id) {
    const { error } = await supabase.from("trades").delete().eq("id", id);
    if (error) console.error("Error eliminando operación:", error.message);
  }
  async function updateAccountSize(value) {
    setAccountSize(value);
    const { error } = await supabase.from("profiles").update({ account_size: value }).eq("id", session.user.id);
    if (error) console.error("Error actualizando tamaño de cuenta:", error.message);
  }

  const isAdmin = profile?.role === "admin";
  const bottomTabs = NAV.filter(item => BOTTOM_TAB_KEYS.includes(item.key));
  const moreActive = !BOTTOM_TAB_KEYS.includes(view);
  const navList = isAdmin
    ? [...NAV, { key: "usuarios", label: "Usuarios", icon: Users, get accent() { return COLORS.violet; } }]
    : NAV;

  const navItems = (
    <>
      {navList.map(item => {
        const Icon = item.icon;
        const active = view === item.key;
        return (
          <button key={item.key} onClick={() => selectView(item.key)} style={{
            ...fontBody, display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "10px 12px", borderRadius: 9, marginBottom: 4, border: "none", cursor: "pointer",
            background: active ? item.accent + "1c" : "transparent",
            color: active ? item.accent : COLORS.muted, fontSize: 13.5, fontWeight: active ? 600 : 500,
            textAlign: "left",
          }}>
            <Icon size={17} />
            {item.label}
            {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
          </button>
        );
      })}
    </>
  );

  const themeToggle = (
    <button onClick={() => setMode(m => m === "dark" ? "light" : "dark")} style={{
      ...fontBody, display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.border}`, cursor: "pointer",
      background: "transparent", color: COLORS.muted, fontSize: 13, fontWeight: 500,
    }}>
      {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {mode === "dark" ? "Modo claro" : "Modo oscuro"}
    </button>
  );

  const signOutButton = (
    <button onClick={() => supabase.auth.signOut()} style={{
      ...fontBody, display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.border}`, cursor: "pointer",
      background: "transparent", color: COLORS.coral, fontSize: 13, fontWeight: 500, marginTop: 8,
    }}>
      <LogOut size={16} /> Cerrar sesión
    </button>
  );

  const brand = size => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: size, height: size, borderRadius: size >= 34 ? 9 : 8, overflow: "hidden", flexShrink: 0, display: "flex" }}><ProgoMark size={size} mode={mode} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ProgoWordmark height={size >= 34 ? 16 : 14} mode={mode} />
        {isAdmin && (
          <span style={{ ...fontMono, display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, color: COLORS.gold, background: COLORS.gold + "1c", padding: "2px 6px", borderRadius: 20, letterSpacing: 0.3 }}>
            <ShieldCheck size={10} /> FUNDADOR
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ ...fontBody, display: "flex", flexDirection: isMobile ? "column" : "row", height: viewportHeight ? `${viewportHeight}px` : "100dvh", background: COLORS.ink, color: COLORS.paper }}>
      {isMobile ? (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: 14, paddingLeft: 16, paddingRight: 16,
            background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 40,
          }}>
            {brand(30)}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sun size={13} color={mode === "dark" ? COLORS.muted : COLORS.gold} />
              <AppleToggle checked={mode === "dark"} onChange={() => setMode(m => m === "dark" ? "light" : "dark")} />
              <Moon size={13} color={mode === "dark" ? COLORS.violet : COLORS.muted} />
            </div>
          </div>

          {navOpen && (
            <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,10,14,0.6)", display: "flex" }}>
              <div onClick={e => e.stopPropagation()} style={{
                width: "78%", maxWidth: 280, background: COLORS.card, height: "100%",
                paddingTop: "calc(20px + env(safe-area-inset-top, 0px))", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
                paddingLeft: 16, paddingRight: 16, display: "flex", flexDirection: "column", overflowY: "auto", boxSizing: "border-box",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                  {brand(30)}
                  <button onClick={() => setNavOpen(false)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex" }}><X size={20} /></button>
                </div>
                {navItems}
                <div style={{ marginTop: "auto", paddingTop: 16 }}>{themeToggle}{signOutButton}</div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ width: 240, background: COLORS.card, borderRight: `1px solid ${COLORS.border}`, padding: "24px 16px", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ padding: "0 8px", marginBottom: 32 }}>{brand(34)}</div>
          {navItems}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>{signOutButton}</div>
        </div>
      )}

      <div style={{
        flex: 1, minWidth: 0, overflowY: "auto", overscrollBehaviorY: "contain",
        ...(isMobile
          ? { padding: 16 }
          : { padding: "28px 32px" }),
      }}>
        {!isMobile && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 18, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...fontBody, fontWeight: 700, fontSize: 13.5, color: COLORS.paper, margin: 0 }}>{displayNameFromEmail(session.user.email)}</p>
              <p style={{ ...fontBody, fontSize: 11.5, color: COLORS.muted, margin: "1px 0 0" }}>{session.user.email}</p>
            </div>

            <span style={{ ...fontMono, fontSize: 11, fontWeight: 700, color: COLORS.muted, letterSpacing: 0.5, borderLeft: `1px solid ${COLORS.border}`, paddingLeft: 18 }}>JC CREW</span>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sun size={14} color={mode === "dark" ? COLORS.muted : COLORS.gold} />
              <AppleToggle checked={mode === "dark"} onChange={() => setMode(m => m === "dark" ? "light" : "dark")} />
              <Moon size={14} color={mode === "dark" ? COLORS.violet : COLORS.muted} />
            </div>
          </div>
        )}
        {view === "resumen" && <Resumen expenses={expenses} tasks={tasks} habits={habits} products={products} />}
        {view === "gastos" && <Gastos expenses={expenses} setExpenses={setExpenses} monthlyIncome={profile.monthly_income} updateMonthlyIncome={updateMonthlyIncome} customCategories={customCategories} addCustomCategory={addCustomCategory} insertExpenseRow={insertExpenseRow} patchExpenseRow={patchExpenseRow} deleteExpenseRow={deleteExpenseRow} />}
        {view === "ingresos" && <IngresosSaldos incomes={incomes} addIncome={addIncome} editIncome={editIncome} deleteIncome={deleteIncome} egresos={egresos} addEgreso={addEgreso} editEgreso={editEgreso} deleteEgreso={deleteEgreso} financeLoading={financeLoading} />}
        {view === "metas" && <Metas goals={goals} setGoals={setGoals} incomes={incomes} insertGoalRow={insertGoalRow} patchGoalRow={patchGoalRow} deleteGoalRow={deleteGoalRow} financeLoading={financeLoading} />}
        {view === "rutina" && <Rutina activities={activities} setActivities={setActivities} completions={completions} setCompletions={setCompletions} journals={journals} setJournals={setJournals} tasks={tasks} setTasks={setTasks} habits={habits} setHabits={setHabits} goals={goals} setGoals={setGoals} patchGoalRow={patchGoalRow} patchTaskRow={patchTaskRow} patchHabitRow={patchHabitRow} insertActivityRow={insertActivityRow} patchActivityRow={patchActivityRow} deleteActivityRow={deleteActivityRow} toggleCompletionRow={toggleCompletionRow} patchJournalRow={patchJournalRow} />}
        {view === "trading" && <Trading trades={trades} setTrades={setTrades} accountSize={accountSize} updateAccountSize={updateAccountSize} insertTradeRow={insertTradeRow} patchTradeRow={patchTradeRow} deleteTradeRow={deleteTradeRow} />}
        {view === "tareas" && <Tareas tasks={tasks} setTasks={setTasks} insertTaskRow={insertTaskRow} patchTaskRow={patchTaskRow} deleteTaskRow={deleteTaskRow} />}
        {view === "habitos" && <Habitos habits={habits} setHabits={setHabits} insertHabitRow={insertHabitRow} patchHabitRow={patchHabitRow} deleteHabitRow={deleteHabitRow} />}
        {view === "productos" && <Productos products={products} setProducts={setProducts} insertProductRow={insertProductRow} patchProductRow={patchProductRow} deleteProductRow={deleteProductRow} />}
        {view === "usuarios" && isAdmin && <Usuarios myId={session.user.id} />}
      </div>

      {isMobile && (
        <div style={{
          flexShrink: 0, display: "flex", justifyContent: "space-between",
          margin: `0 14px calc(14px + env(safe-area-inset-bottom, 0px)) 14px`,
          background: COLORS.card + "d9", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${COLORS.border}`, borderRadius: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.28)", padding: 6,
        }}>
          {bottomTabs.map(item => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button key={item.key} onClick={() => selectView(item.key)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                background: active ? COLORS.elevated : "transparent", borderRadius: 20,
                border: "none", cursor: "pointer", padding: "7px 4px",
                color: active ? COLORS.paper : COLORS.muted,
              }}>
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                <span style={{ ...fontBody, fontSize: 9.5, fontWeight: active ? 700 : 500 }}>{BOTTOM_TAB_LABELS[item.key]}</span>
              </button>
            );
          })}
          <button onClick={() => setNavOpen(true)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            background: moreActive ? COLORS.elevated : "transparent", borderRadius: 20,
            border: "none", cursor: "pointer", padding: "7px 4px",
            color: moreActive ? COLORS.paper : COLORS.muted,
          }}>
            <MoreHorizontal size={21} strokeWidth={moreActive ? 2.2 : 1.8} />
            <span style={{ ...fontBody, fontSize: 9.5, fontWeight: moreActive ? 700 : 500 }}>Más</span>
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  LayoutGrid, Wallet, Target, CheckSquare, Flame, Package,
  Plus, Trash2, ChevronRight, TrendingUp, TrendingDown, Coffee,
  UtensilsCrossed, ShoppingCart, Car, Home as HomeIcon, Zap,
  HeartPulse, ShoppingBag, Trash, GraduationCap, MoreHorizontal, Check,
  X, Calendar, Sun, Moon, Brain, Briefcase, Activity, Menu, LogOut, Users, ShieldCheck, Globe
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line
} from "recharts";

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
  link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap";
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

const LANGUAGES = [["es", "Español"], ["en", "English"]];

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

const seedExpenses = [
  { id: 1, date: "2026-07-01", category: "Comidas por fuera", description: "Almuerzo con proveedores", amount: 45000 },
  { id: 2, date: "2026-07-02", category: "Supermercado", description: "Mercado semana", amount: 120000 },
  { id: 3, date: "2026-07-03", category: "Transporte", description: "Uber a bodega", amount: 18000 },
  { id: 4, date: "2026-07-04", category: "Servicios", description: "Internet oficina", amount: 95000 },
  { id: 5, date: "2026-07-05", category: "Entretenimiento", description: "Cine", amount: 28000 },
  { id: 6, date: "2026-07-06", category: "Salud", description: "Droguería", amount: 32000 },
];

const CAT_LIST = Object.keys(CATEGORY_META);

const seedGoals = {
  diario: [
    { id: "d1", title: "Responder mensajes de clientes", done: true },
    { id: "d2", title: "Publicar 1 anuncio nuevo", done: true },
    { id: "d3", title: "Revisar métricas del día", done: false },
  ],
  semanal: [
    { id: "s1", title: "Testear 3 productos nuevos", progress: 2, target: 3 },
    { id: "s2", title: "Cerrar 15 ventas", progress: 9, target: 15 },
  ],
  mensual: [
    { id: "m1", title: "Facturar $8.000.000", progress: 5200000, target: 8000000, money: true },
    { id: "m2", title: "Conseguir 5 clientes recurrentes", progress: 3, target: 5 },
  ],
  trimestral: [
    { id: "t1", title: "Lanzar segunda marca", progress: 1, target: 3 },
    { id: "t2", title: "Llegar a $25.000.000 en ventas", progress: 14000000, target: 25000000, money: true },
  ],
};

const seedTasks = {
  diario: [
    { id: 1, title: "Subir catálogo actualizado", done: true },
    { id: 2, title: "Responder tickets de soporte", done: true },
    { id: 3, title: "Grabar creativo para producto ganador", done: false },
    { id: 4, title: "Pagar proveedor de flete", done: false },
    { id: 5, title: "Revisar anuncios con bajo ROAS", done: false },
  ],
  semanal: [
    { id: 101, title: "Cerrar reporte de ventas de la semana", done: true },
    { id: 102, title: "Reunión con proveedor principal", done: false },
    { id: 103, title: "Actualizar precios en catálogo", done: false },
  ],
  mensual: [
    { id: 201, title: "Cierre contable del mes", done: false },
    { id: 202, title: "Renovar pauta publicitaria", done: true },
    { id: 203, title: "Evaluar nuevo proveedor de flete", done: false },
  ],
};

const HABIT_DEFS = [
  { id: 1, name: "Revisar métricas", toneKey: "gold" },
  { id: 2, name: "Ejercicio", toneKey: "teal" },
  { id: 3, name: "Leer 20 min", toneKey: "violet" },
  { id: 4, name: "Sin comida chatarra", toneKey: "coral" },
];

function buildHabitHistory(habitId, totalDays) {
  const history = {};
  for (let d = 1; d <= totalDays; d++) {
    const score = (d * 7 + habitId * 5) % 9;
    history[`${CAL_YEAR}-${String(CAL_MONTH + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`] = score < 6 ? 1 : 0;
  }
  return history;
}

const seedHabits = HABIT_DEFS.map(h => ({ ...h, history: buildHabitHistory(h.id, new Date(CAL_YEAR, CAL_MONTH + 1, 0).getDate()) }));

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const seedProducts = [
  { id: 1, name: "Mini masajeador cervical", testDate: "2026-06-02", investment: 300000, sales: 1250000, status: "Ganador", notes: "ROAS alto, escalar presupuesto" },
  { id: 2, name: "Organizador de cables magnético", testDate: "2026-06-10", investment: 250000, sales: 180000, status: "Perdedor", notes: "CTR bajo, pausar" },
  { id: 3, name: "Lámpara de proyección galaxia", testDate: "2026-06-18", investment: 200000, sales: 410000, status: "Ganador", notes: "Buen margen, probar otro público" },
  { id: 4, name: "Soporte ergonómico laptop", testDate: "2026-07-01", investment: 180000, sales: 90000, status: "En prueba", notes: "Faltan 3 días de data" },
  { id: 5, name: "Set de cuchillos cerámicos", testDate: "2026-07-03", investment: 220000, sales: 40000, status: "En prueba", notes: "Ajustar creativo" },
];

const STATUS_META = {
  "Ganador": { get color() { return COLORS.teal; }, get dim() { return COLORS.teal + "22"; } },
  "Perdedor": { get color() { return COLORS.coral; }, get dim() { return COLORS.coral + "22"; } },
  "En prueba": { get color() { return COLORS.gold; }, get dim() { return COLORS.gold + "22"; } },
};

const seedTrades = [
  { id: 1, date: "2026-07-01", symbol: "NQ", pnl: -111.50 },
  { id: 2, date: "2026-07-02", symbol: "NQ", pnl: 200 },
  { id: 3, date: "2026-07-02", symbol: "ES", pnl: 415.50 },
  { id: 4, date: "2026-07-02", symbol: "NQ", pnl: -80 },
  { id: 5, date: "2026-07-06", symbol: "NQ", pnl: -128 },
  { id: 6, date: "2026-07-08", symbol: "ES", pnl: 5 },
];

// Rutina — actividades con horario en minutos desde medianoche (isoDateLocal se hoistea)
const TODAY_ISO = isoDateLocal(new Date());

const seedActivities = [
  { id: 1, date: TODAY_ISO, title: "Entrenamiento", start: 390, end: 450, type: "movimiento", category: "Salud", description: "", repeat: "diario" },
  { id: 2, date: TODAY_ISO, title: "Trabajo profundo", start: 480, end: 660, type: "enfoque", category: "Negocio", description: "Bloque principal del día", repeat: "diario" },
  { id: 3, date: TODAY_ISO, title: "Revisar productos en prueba", start: 840, end: 900, type: "operativo", category: "E-commerce", description: "", repeat: "no" },
  { id: 4, date: TODAY_ISO, title: "Grabar contenido", start: 960, end: 1050, type: "operativo", category: "Marketing", description: "", repeat: "no" },
];

/* ---------------------------------------------------------
   Small building blocks
--------------------------------------------------------- */

function ProgoMark({ size = 34, mode = "dark" }) {
  const gradId = `progoMarkGrad-${mode}`;
  const stops = mode === "dark"
    ? ["#0F2049", "#2B6DF0"]
    : ["#0F2E9E", "#3E7BFF"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="7" fill={`url(#${gradId})`} />
      <ellipse cx="7.5" cy="6" rx="7" ry="5" fill="#fff" opacity="0.1" />
      <rect x="7" y="5" width="4" height="14" rx="2" fill="#fff" />
      <path d="M11 5L15 5Q16.4 5 17 5.9L20 9L17 12.1Q16.4 13 15 13L11 13Z" fill="#fff" />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor={stops[0]} />
          <stop offset="1" stopColor={stops[1]} />
        </linearGradient>
      </defs>
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
  const totalGastos = expenses.reduce((a, e) => a + e.amount, 0);
  const tareasHechas = tasks.diario.filter(t => t.done).length;
  const ganadores = products.filter(p => p.status === "Ganador").length;
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
        <StatCard label="Racha más larga" value="6 días" sub="Revisar métricas" accent={COLORS.violet} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px" }}>
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 12px" }}>Gastos por día</p>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fill: COLORS.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={70} tickFormatter={v => fmtCOP(v)} />
              <Tooltip
                contentStyle={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.paper, fontFamily: "'Inter', sans-serif", fontSize: 13 }}
                formatter={v => fmtCOP(v)}
                labelStyle={{ color: COLORS.muted }}
              />
              <Bar dataKey="amount" fill={COLORS.gold} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   GASTOS
--------------------------------------------------------- */

function Gastos({ expenses, setExpenses }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return map;
  }, [expenses]);

  const total = expenses.reduce((a, e) => a + e.amount, 0);

  if (selectedCategory) {
    return <CategoryCalendar category={selectedCategory} expenses={expenses} setExpenses={setExpenses} onBack={() => setSelectedCategory(null)} />;
  }

  return (
    <div>
      <SectionHeader
        icon={Wallet} title="Gastos" subtitle="Administra y controla tus gastos por categoría" accent={COLORS.coral}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {CAT_LIST.map(cat => {
          const meta = CATEGORY_META[cat];
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
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ ...fontBody, color: COLORS.paper, fontWeight: 600, fontSize: 15 }}>Gastos recientes</span>
          <span style={{ ...fontMono, color: COLORS.coral, fontWeight: 600, fontSize: 15 }}>{fmtCOP(total)}</span>
        </div>
        {expenses.slice(0, 10).map(e => {
          const meta = CATEGORY_META[e.category];
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

function CategoryCalendar({ category, expenses, setExpenses, onBack }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ description: "", amount: "" });
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

  function addExpense() {
    if (!selectedDate || !form.description || !form.amount) return;
    setExpenses(prev => [{ id: Date.now(), date: selectedDate, category, description: form.description, amount: Number(form.amount) }, ...prev]);
    setForm({ description: "", amount: "" });
  }
  function removeExpense(id) { setExpenses(prev => prev.filter(e => e.id !== id)); }

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
            <p style={{ ...fontBody, color: COLORS.paper, fontWeight: 600, fontSize: 15, margin: "0 0 16px" }}>Agregar gasto</p>
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12 }}>Fecha</label>
            <input type="date" value={selectedDate || ""} onChange={e => setSelectedDate(e.target.value)} style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12 }}>Descripción</label>
            <input placeholder="Ej. Almuerzo con clientes" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle()} />
            <label style={{ ...fontBody, color: COLORS.muted, fontSize: 12 }}>Monto</label>
            <input type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle()} />
            <div style={{ marginTop: 4 }}>
              <PrimaryButton onClick={addExpense} accent={meta.color}><Plus size={16} /> Guardar gasto</PrimaryButton>
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
    ...fontBody, width: "100%", background: COLORS.elevated, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "9px 12px", color: COLORS.paper, fontSize: 13.5, marginBottom: 12,
    outline: "none", boxSizing: "border-box",
  };
}

/* ---------------------------------------------------------
   METAS
--------------------------------------------------------- */

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

function Metas({ goals, setGoals }) {
  const [tab, setTab] = useState("diario");
  const [form, setForm] = useState({ title: "", target: "", money: false });
  const meta = TIMEFRAME_META[tab];
  const list = goals[tab];
  const isDiario = tab === "diario";

  function toggleDaily(id) {
    setGoals(prev => ({ ...prev, diario: prev.diario.map(g => g.id === id ? { ...g, done: !g.done } : g) }));
  }
  function removeGoal(id) {
    setGoals(prev => ({ ...prev, [tab]: prev[tab].filter(g => g.id !== id) }));
  }
  function updateProgress(id, value) {
    setGoals(prev => ({
      ...prev,
      [tab]: prev[tab].map(g => g.id === id ? { ...g, progress: Math.max(0, Math.min(g.target, value)) } : g)
    }));
  }
  function addGoal() {
    if (!form.title.trim()) return;
    if (isDiario) {
      setGoals(prev => ({ ...prev, diario: [...prev.diario, { id: Date.now(), title: form.title, done: false }] }));
    } else {
      const target = Number(form.target);
      if (!target || target <= 0) return;
      setGoals(prev => ({ ...prev, [tab]: [...prev[tab], { id: Date.now(), title: form.title, progress: 0, target, money: form.money }] }));
    }
    setForm({ title: "", target: "", money: false });
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

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          onKeyDown={e => e.key === "Enter" && addGoal()}
          placeholder={`Nueva meta ${meta.label.toLowerCase()}`} style={{ ...inputStyle(), marginBottom: 0, flex: 1, minWidth: 180 }} />
        {!isDiario && (
          <input type="number" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addGoal()}
            placeholder={form.money ? "Monto meta" : "Cantidad meta"} style={{ ...inputStyle(), marginBottom: 0, width: 150 }} />
        )}
        {!isDiario && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 13, color: COLORS.muted, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={form.money} onChange={e => setForm({ ...form, money: e.target.checked })} />
            Es dinero
          </label>
        )}
        <PrimaryButton onClick={addGoal} accent={meta.color}><Plus size={16} /> Agregar</PrimaryButton>
      </div>

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
              <button onClick={() => removeGoal(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={15} /></button>
            </div>
          ))}
          {list.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>No hay metas diarias todavía.</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {list.map(g => {
            const pct = g.target ? g.progress / g.target : 0;
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
                    <p style={{ ...fontBody, color: COLORS.paper, fontSize: 14.5, fontWeight: 500, margin: "0 0 6px" }}>{g.title}</p>
                    <button onClick={() => removeGoal(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, flexShrink: 0 }}><X size={15} /></button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" value={g.progress} onChange={e => updateProgress(g.id, Number(e.target.value))} style={{
                      ...fontMono, width: 110, background: COLORS.elevated, border: `1px solid ${COLORS.border}`,
                      borderRadius: 6, padding: "6px 8px", color: COLORS.paper, fontSize: 12.5, outline: "none",
                    }} />
                    <span style={{ ...fontMono, color: COLORS.muted, fontSize: 12.5 }}>/ {g.money ? fmtCOP(g.target) : g.target}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13.5 }}>No hay metas {meta.label.toLowerCase()}es todavía.</p>}
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

function Tareas({ tasks, setTasks }) {
  const [tab, setTab] = useState("diario");
  const [newTask, setNewTask] = useState("");
  const meta = TASK_TIMEFRAME_META[tab];
  const list = tasks[tab];
  const done = list.filter(t => t.done).length;

  function toggle(id) { setTasks(prev => ({ ...prev, [tab]: prev[tab].map(t => t.id === id ? { ...t, done: !t.done } : t) })); }
  function remove(id) { setTasks(prev => ({ ...prev, [tab]: prev[tab].filter(t => t.id !== id) })); }
  function add() {
    if (!newTask.trim()) return;
    setTasks(prev => ({ ...prev, [tab]: [...prev[tab], { id: Date.now(), title: newTask, done: false }] }));
    setNewTask("");
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
        <PrimaryButton onClick={add} accent={meta.color}><Plus size={16} /> Agregar</PrimaryButton>
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

function Habitos({ habits, setHabits }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const { cells, totalDays } = monthMatrix(CAL_YEAR, CAL_MONTH);
  const isMobile = useIsMobile();

  function toggleDate(habitId, ds) {
    setHabits(prev => prev.map(h => h.id === habitId
      ? { ...h, history: { ...h.history, [ds]: h.history[ds] ? 0 : 1 } }
      : h));
  }

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

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20, overflowX: "auto" }}>
        <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13, margin: "0 0 14px" }}>Semana actual (1–7 de julio)</p>
        <div style={{ minWidth: 480 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(7, 34px) 70px", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <span></span>
            {DAY_LABELS.map((d, i) => <span key={i} style={{ ...fontMono, textAlign: "center", color: COLORS.muted, fontSize: 12 }}>{d}</span>)}
            <span style={{ ...fontMono, textAlign: "right", color: COLORS.muted, fontSize: 12 }}>racha</span>
          </div>
          {habits.map(h => {
            const hColor = COLORS[h.toneKey];
            return (
            <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr repeat(7, 34px) 70px", gap: 8, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
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
            </div>
            );
          })}
        </div>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyPct}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickLine={false} interval={2} />
                  <YAxis domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.paper, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
                    formatter={v => `${v}%`}
                    labelFormatter={l => `Día ${l}`}
                    labelStyle={{ color: COLORS.muted }}
                  />
                  <Bar dataKey="pct" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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

function Productos({ products, setProducts }) {
  function cycleStatus(id) {
    const order = ["En prueba", "Ganador", "Perdedor"];
    setProducts(prev => prev.map(p => p.id === id
      ? { ...p, status: order[(order.indexOf(p.status) + 1) % order.length] }
      : p));
  }

  return (
    <div>
      <SectionHeader icon={Package} title="Productos testeados" subtitle={`${products.length} productos en el historial`} accent={COLORS.teal} />
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 0.8fr 1.3fr", gap: 16, padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, minWidth: 760 }}>
            {["Producto", "Fecha", "Inversión", "Ventas", "ROI", "Estado"].map(h => (
              <span key={h} style={{ ...fontBody, color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</span>
            ))}
          </div>
          {products.map(p => {
            const roi = ((p.sales - p.investment) / p.investment) * 100;
            const sm = STATUS_META[p.status];
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 0.8fr 1.3fr", gap: 16, padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center", minWidth: 760 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...fontBody, color: COLORS.paper, fontSize: 14, fontWeight: 500, margin: 0 }}>{p.name}</p>
                  <p style={{ ...fontBody, color: COLORS.muted, fontSize: 12, margin: "3px 0 0" }}>{p.notes}</p>
                </div>
                <span style={{ ...fontMono, color: COLORS.muted, fontSize: 13, whiteSpace: "nowrap" }}>{p.testDate}</span>
                <span style={{ ...fontMono, color: COLORS.paper, fontSize: 13, whiteSpace: "nowrap" }}>{fmtCOP(p.investment)}</span>
                <span style={{ ...fontMono, color: COLORS.paper, fontSize: 13, whiteSpace: "nowrap" }}>{fmtCOP(p.sales)}</span>
                <span style={{ ...fontMono, color: roi >= 0 ? COLORS.teal : COLORS.coral, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                  {roi >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {roi.toFixed(0)}%
                </span>
                <button onClick={() => cycleStatus(p.id)} style={{
                  ...fontBody, justifySelf: "start", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                  padding: "6px 12px", borderRadius: 20, background: sm.dim, color: sm.color, whiteSpace: "nowrap",
                }}>{p.status}</button>
              </div>
            );
          })}
        </div>
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

function Rutina({ activities, setActivities, completions, setCompletions, journals, setJournals, tasks, setTasks, habits, setHabits, goals, setGoals }) {
  const todayISO = isoDateLocal(new Date());
  const [viewMode, setViewMode] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [editor, setEditor] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const movedRef = useRef(false);
  const dayTrackRef = useRef(null);

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
      if (a.source.kind === "tarea") { setTasks(prev => ({ ...prev, diario: prev.diario.map(t => t.id === a.source.id ? { ...t, done: !t.done } : t) })); return; }
      if (a.source.kind === "habito") { setHabits(prev => prev.map(h => h.id === a.source.id ? { ...h, history: { ...h.history, [ds]: h.history[ds] ? 0 : 1 } } : h)); return; }
      if (a.source.kind === "meta") { setGoals(prev => ({ ...prev, diario: prev.diario.map(g => g.id === a.source.id ? { ...g, done: !g.done } : g) })); return; }
    }
    setCompletions(prev => ({ ...prev, [`${a.id}|${ds}`]: !prev[`${a.id}|${ds}`] }));
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
  function saveEditor() {
    if (!editor.title.trim() || editor.end <= editor.start) return;
    const data = { date: editor.date, title: editor.title.trim(), start: editor.start, end: editor.end, type: editor.type, customColor: editor.customColor, category: editor.category, description: editor.description, repeat: editor.repeat };
    if (editor.mode === "new") setActivities(prev => [...prev, { id: Date.now(), ...data }]);
    else setActivities(prev => prev.map(a => a.id === editor.id ? { ...a, ...data } : a));
    setEditor(null);
  }

  // Arrastrar una pendiente (Tarea/Hábito/Meta) desde el panel "Planea tu día" hasta el timeline
  function startPanelDrag(e, item, kind) {
    e.preventDefault();
    const move = ev => setGhost({ x: ev.clientX, y: ev.clientY, label: item.title, tone: SOURCE_META[kind].tone });
    const up = ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      const rect = dayTrackRef.current?.getBoundingClientRect();
      if (!rect || ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      const min = snapToGrid(dayStart + (ev.clientY - rect.top) / PX_HOUR_DAY * 60);
      const start = Math.max(dayStart, Math.min(dayEnd - 45, min));
      setActivities(prev => [...prev, {
        id: Date.now(), date: todayISO, title: item.title, start, end: Math.min(dayEnd, start + 45),
        type: SOURCE_META[kind].defaultType, category: "", description: "", repeat: "no", source: { kind, id: item.id },
      }]);
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
    const move = ev => {
      const dy = ev.clientY - startY, dx = ev.clientX - startX;
      if (Math.abs(dy) > 4 || Math.abs(dx) > 4) movedRef.current = true;
      if (!movedRef.current) return;
      const deltaMin = snapToGrid(dy / px * 60);
      setActivities(prev => prev.map(x => {
        if (x.id !== a.id) return x;
        if (dragMode === "resize") return { ...x, end: Math.min(dayEnd, Math.max(orig.start + SNAP_MIN, orig.end + deltaMin)) };
        const start = Math.max(dayStart, Math.min(dayEnd - dur, orig.start + deltaMin));
        let date = orig.date;
        if (colInfo) {
          const idx = Math.max(0, Math.min(6, colInfo.index + Math.round(dx / colInfo.width)));
          date = colInfo.week[idx];
        }
        return { ...x, start, end: start + dur, date };
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
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
  const setJ = (field, value) => setJournals(prev => ({ ...prev, [selectedDate]: { ...(prev[selectedDate] || {}), [field]: value } }));

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
                <button onClick={() => { setActivities(prev => prev.filter(a => a.id !== editor.id)); setEditor(null); }} style={{
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

function Trading({ trades, setTrades, accountSize, setAccountSize }) {
  const [ym, setYm] = useState({ year: CAL_YEAR, month: CAL_MONTH });
  const [tab, setTab] = useState("pnl");
  const [modalDate, setModalDate] = useState(null);
  const [form, setForm] = useState({ symbol: "", pnl: "" });

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

  function addTrade() {
    if (!form.symbol.trim() || form.pnl === "") return;
    setTrades(prev => [...prev, { id: Date.now(), date: modalDate, symbol: form.symbol.trim().toUpperCase(), pnl: Number(form.pnl) }]);
    setForm({ symbol: "", pnl: "" });
  }
  function removeTrade(id) { setTrades(prev => prev.filter(t => t.id !== id)); }

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
            <button key={p} onClick={() => setAccountSize(p)} style={{
              ...fontMono, fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${accountSize === p ? COLORS.teal : COLORS.border}`,
              background: accountSize === p ? COLORS.teal + "22" : "transparent",
              color: accountSize === p ? COLORS.teal : COLORS.muted,
            }}>{p >= 1000 ? `${p / 1000}K` : p}</button>
          ))}
        </div>
        <input type="number" value={accountSize} onChange={e => setAccountSize(Number(e.target.value) || 0)}
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
        <div onClick={() => setModalDate(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }}>
            <p style={{ ...fontDisplay, color: COLORS.paper, fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{modalDate}</p>
            <p style={{ ...fontMono, fontSize: 13, color: modalPnl >= 0 ? COLORS.teal : COLORS.coral, margin: "0 0 16px", fontWeight: 600 }}>
              {fmtUSD(modalPnl)}{modalWinRate !== null ? ` (${fmtPct(accountSize ? (modalPnl / accountSize) * 100 : 0)}) · ${modalWinRate}% aciertos` : " · sin operaciones"}
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} placeholder="Símbolo (ej. NQ)" style={{ ...inputStyle(), marginBottom: 0, flex: 1 }} onKeyDown={e => e.key === "Enter" && addTrade()} />
              <input type="number" value={form.pnl} onChange={e => setForm({ ...form, pnl: e.target.value })} placeholder="PNL" style={{ ...inputStyle(), marginBottom: 0, width: 110 }} onKeyDown={e => e.key === "Enter" && addTrade()} />
            </div>
            <PrimaryButton onClick={addTrade} accent={COLORS.teal}><Plus size={16} /> Agregar operación</PrimaryButton>

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {modalTrades.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 9 }}>
                  <span style={{ ...fontBody, flex: 1, fontSize: 13.5, color: COLORS.paper, fontWeight: 600 }}>{t.symbol}</span>
                  <span style={{ ...fontMono, fontSize: 13, fontWeight: 600, color: t.pnl >= 0 ? COLORS.teal : COLORS.coral }}>{fmtUSD(t.pnl)}</span>
                  <button onClick={() => removeTrade(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={14} /></button>
                </div>
              ))}
              {modalTrades.length === 0 && <p style={{ ...fontBody, color: COLORS.muted, fontSize: 13 }}>Sin operaciones este día.</p>}
            </div>

            <button onClick={() => setModalDate(null)} style={{ ...fontBody, marginTop: 16, background: "transparent", border: "none", color: COLORS.muted, fontSize: 13.5, cursor: "pointer" }}>Cerrar</button>
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
  return (
    <div style={{ ...fontBody, minHeight: "100vh", background: COLORS.ink, color: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, overflow: "hidden", display: "flex", flexShrink: 0 }}><ProgoMark size={38} mode="dark" /></div>
          <div>
            <p style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, margin: 0 }}>PROGO</p>
            <p style={{ ...fontBody, fontSize: 11, color: COLORS.muted, margin: 0 }}>by JC CREW</p>
          </div>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(next) { setMode(next); setError(""); setNotice(""); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setNotice("");
    if (!email.trim() || !password) { setError("Ingresa tu correo y contraseña."); return; }
    setLoading(true);
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
  { key: "metas", label: "Metas", icon: Target, get accent() { return COLORS.violet; } },
  { key: "rutina", label: "Rutina", icon: Calendar, get accent() { return COLORS.teal; } },
  { key: "trading", label: "Trading", icon: TrendingUp, get accent() { return COLORS.teal; } },
  { key: "tareas", label: "Tareas diarias", icon: CheckSquare, get accent() { return COLORS.gold; } },
  { key: "habitos", label: "Hábitos", icon: Flame, get accent() { return COLORS.teal; } },
  { key: "productos", label: "Productos testeados", icon: Package, get accent() { return COLORS.teal; } },
];

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
        setProfileError(error.message + (error.code === "PGRST205" || error.status === 404 ? " — ¿ya corriste supabase/schema.sql y supabase/profiles.sql en el SQL Editor?" : ""));
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
  const [expenses, setExpenses] = useState(seedExpenses);
  const [goals, setGoals] = useState(seedGoals);
  const [tasks, setTasks] = useState(seedTasks);
  const [habits, setHabits] = useState(seedHabits);
  const [products, setProducts] = useState(seedProducts);
  const [activities, setActivities] = useState(seedActivities);
  const [completions, setCompletions] = useState({});
  const [journals, setJournals] = useState({});
  const [trades, setTrades] = useState(seedTrades);
  const [accountSize, setAccountSize] = useState(10000);
  const [language, setLanguage] = useState("es");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const isAdmin = profile?.role === "admin";
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
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <p style={{ ...fontDisplay, fontSize: size >= 34 ? 15 : 14, fontWeight: 700, margin: 0 }}>PROGO</p>
          {isAdmin && (
            <span style={{ ...fontMono, display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, color: COLORS.gold, background: COLORS.gold + "1c", padding: "2px 6px", borderRadius: 20, letterSpacing: 0.3 }}>
              <ShieldCheck size={10} /> FUNDADOR
            </span>
          )}
        </div>
        {size >= 34 && <p style={{ ...fontBody, fontSize: 11, color: COLORS.muted, margin: 0 }}>by JC CREW</p>}
      </div>
    </div>
  );

  return (
    <div style={{ ...fontBody, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", background: COLORS.ink, color: COLORS.paper }}>
      {isMobile ? (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px",
            background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 40,
          }}>
            {brand(30)}
            <button onClick={() => setNavOpen(true)} style={{
              background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8,
              color: COLORS.paper, cursor: "pointer", padding: 8, display: "flex",
            }}><Menu size={19} /></button>
          </div>

          {navOpen && (
            <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,10,14,0.6)", display: "flex" }}>
              <div onClick={e => e.stopPropagation()} style={{
                width: "78%", maxWidth: 280, background: COLORS.card, height: "100%",
                padding: "20px 16px", display: "flex", flexDirection: "column", overflowY: "auto", boxSizing: "border-box",
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
        <div style={{ width: 240, background: COLORS.card, borderRight: `1px solid ${COLORS.border}`, padding: "24px 16px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "0 8px", marginBottom: 32 }}>{brand(34)}</div>
          {navItems}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>{signOutButton}</div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "16px" : "28px 32px", overflowY: "auto" }}>
        {!isMobile && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 18, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...fontBody, fontWeight: 700, fontSize: 13.5, color: COLORS.paper, margin: 0 }}>{displayNameFromEmail(session.user.email)}</p>
              <p style={{ ...fontBody, fontSize: 11.5, color: COLORS.muted, margin: "1px 0 0" }}>{session.user.email}</p>
            </div>

            <span style={{ ...fontMono, fontSize: 11, fontWeight: 700, color: COLORS.muted, letterSpacing: 0.5, borderLeft: `1px solid ${COLORS.border}`, paddingLeft: 18 }}>JC CREW</span>

            <div style={{ position: "relative" }}>
              <button onClick={() => setLangMenuOpen(o => !o)} style={{
                ...fontBody, display: "flex", alignItems: "center", gap: 6, background: "transparent",
                border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.muted, cursor: "pointer",
                padding: "7px 12px", fontSize: 13,
              }}>
                <Globe size={14} /> {LANGUAGES.find(l => l[0] === language)?.[1]}
              </button>
              {langMenuOpen && (
                <>
                  <div onClick={() => setLangMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />
                  <div style={{ position: "absolute", top: "110%", right: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 9, overflow: "hidden", zIndex: 30, minWidth: 130 }}>
                    {LANGUAGES.map(([code, label]) => (
                      <button key={code} onClick={() => { setLanguage(code); setLangMenuOpen(false); }} style={{
                        ...fontBody, display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none",
                        background: language === code ? COLORS.teal + "1c" : "transparent",
                        color: language === code ? COLORS.teal : COLORS.paper, fontSize: 13, cursor: "pointer",
                      }}>{label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sun size={14} color={mode === "dark" ? COLORS.muted : COLORS.gold} />
              <AppleToggle checked={mode === "dark"} onChange={() => setMode(m => m === "dark" ? "light" : "dark")} />
              <Moon size={14} color={mode === "dark" ? COLORS.violet : COLORS.muted} />
            </div>
          </div>
        )}
        {view === "resumen" && <Resumen expenses={expenses} tasks={tasks} habits={habits} products={products} />}
        {view === "gastos" && <Gastos expenses={expenses} setExpenses={setExpenses} />}
        {view === "metas" && <Metas goals={goals} setGoals={setGoals} />}
        {view === "rutina" && <Rutina activities={activities} setActivities={setActivities} completions={completions} setCompletions={setCompletions} journals={journals} setJournals={setJournals} tasks={tasks} setTasks={setTasks} habits={habits} setHabits={setHabits} goals={goals} setGoals={setGoals} />}
        {view === "trading" && <Trading trades={trades} setTrades={setTrades} accountSize={accountSize} setAccountSize={setAccountSize} />}
        {view === "tareas" && <Tareas tasks={tasks} setTasks={setTasks} />}
        {view === "habitos" && <Habitos habits={habits} setHabits={setHabits} />}
        {view === "productos" && <Productos products={products} setProducts={setProducts} />}
        {view === "usuarios" && isAdmin && <Usuarios myId={session.user.id} />}
      </div>
    </div>
  );
}

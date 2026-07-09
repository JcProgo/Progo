# PROGO — Resumen técnico maestro

**Propósito de este documento:** contexto completo para retomar el desarrollo de PROGO en una conversación nueva sin perder ninguna decisión, estado o pendiente. Última actualización: 2026-07-09.

---

## 1. Qué es PROGO

Plataforma de gestión de negocio/productividad personal ("Organiza. Ejecuta. Progresa.") por **JC CREW**. Multi-usuario, con cuentas reales (correo/contraseña) y aislamiento total de datos por usuario.

Secciones: Resumen, Gastos, Ingresos y saldos, Metas, Rutina, Trading, Tareas diarias, Hábitos, Productos testeados, y Usuarios (solo admin).

---

## 2. Arquitectura

- **Frontend:** React 19 + Vite 8, un solo archivo `src/App.jsx` (~2940 líneas, todos los componentes). Sin router — navegación por estado (`view`) en el shell de `App()`.
- **Estilo:** 100% inline styles (objetos `style={{...}}`), sin CSS externo salvo `src/index.css` (reset mínimo). Paleta de colores en objetos `DARK_THEME`/`LIGHT_THEME` mezclados a un objeto mutable `COLORS` vía `Object.assign` en cada render — **patrón importante**: cualquier estilo que dependa de color debe leer `COLORS.x` en el momento del render, nunca cachearlo en una constante a nivel de módulo (excepción: `inputStyle()` es una función, no un objeto, precisamente por este motivo).
- **Fuentes:** Space Grotesk (display), Inter (body), JetBrains Mono (números/datos), cargadas por `<link>` inyectado en JS al importar el módulo.
- **Backend:** Supabase (Postgres + Auth), acceso directo desde el cliente vía `@supabase/supabase-js`, sin backend propio ni Edge Functions. Todas las reglas de acceso viven en Row Level Security (RLS) de Postgres.
- **Hosting:** Vercel, proyecto `progo` bajo el team `jcprogos-projects`. Deploy automático on push a `main` en GitHub (`github.com/JcProgo/Progo`, público).
- **URL producción:** `https://progo-theta.vercel.app/`

### Convención de persistencia (aplicada a TODAS las secciones)
Cada dominio de datos sigue el mismo patrón, sin excepción:
1. Estado vive en `App()` (`useState`), cargado una vez en un único `useEffect` grande disparado por `[profile]` (ver §5).
2. Funciones `insertXRow` / `patchXRow` / `deleteXRow` definidas en `App()`, cada una llama a Supabase y luego actualiza el estado local.
3. Los componentes de sección reciben el estado + esas funciones como props, y las invocan **junto con** su `setState` local (nunca solo uno de los dos) para que la UI se sienta instantánea pero quede guardado.
4. Los `id` de filas nuevas SIEMPRE vienen de la respuesta de Supabase (`.select().single()` tras el insert) — nunca se usa `Date.now()` como id definitivo.

Excepciones deliberadas a "guardar en cada cambio":
- **Drag/resize de bloques en Rutina:** se persiste solo al soltar (`pointerup`), no en cada `pointermove`.
- **Journal (notas de texto en Rutina):** debounce de 600ms tras dejar de escribir.

---

## 3. Base de datos (Supabase Postgres)

### Estado REAL verificado en vivo (2026-07-09, vía REST a `yzpyobyflkyvpflqqljt.supabase.co`)

| Tabla | ¿Existe en la BD real? |
|---|---|
| `profiles` | ✅ Sí (con `role`, `disabled`, `monthly_income`) |
| `goals` | ✅ Sí (con campos de meta financiera) |
| `incomes` | ✅ Sí |
| `custom_categories` | ✅ Sí |
| `tasks` | ❌ **NO** |
| `expenses` | ❌ **NO** |
| `habits` | ❌ **NO** |
| `products` | ❌ **NO** |
| `activities` | ❌ **NO** |
| `activity_completions` | ❌ **NO** |
| `journals` | ❌ **NO** |
| `trades` | ❌ **NO** |
| `profiles.account_size` (columna) | ❌ **NO** |

**⚠️ ACCIÓN PENDIENTE CRÍTICA:** el archivo `supabase/full_persistence.sql` (que crea las 8 tablas faltantes + la columna `account_size`) fue entregado al usuario pero **no se ha confirmado que lo haya ejecutado**. Hasta que corra ese SQL, Tareas, Gastos, Hábitos, Productos, Rutina y Trading fallarán silenciosamente al guardar (verán errores `PGRST205 relation does not exist` en la consola del navegador) y esas secciones se comportarán como si estuvieran siempre vacías. **Primer paso al retomar: confirmar/pedir que corra `supabase/full_persistence.sql`.**

### Archivos SQL en el repo (`supabase/*.sql`) — orden histórico real

1. `profiles.sql` — tabla `profiles` (id, email, role, disabled) + trigger que autopromueve a `admin` al correo `juaneschaverra15@gmail.com` al registrarse + función `is_admin()` (evita recursión RLS).
2. `incomes_and_goals.sql` — tablas `goals` (con `goal_type`, `financial_target`, `financial_start_date`) e `incomes`.
3. `monthly_income.sql` — `alter table profiles add column monthly_income`.
4. `custom_categories.sql` — tabla `custom_categories`.
5. `full_persistence.sql` — **el que falta correr**: `tasks`, `expenses`, `habits`, `products`, `activities`, `activity_completions`, `journals`, `trades`, + columna `profiles.account_size`.

### ⚠️ Deuda técnica: `supabase/schema.sql` está OBSOLETO
Es el primer borrador especulativo (escrito antes de que existieran Ingresos/metas financieras/categorías personalizadas). Su tabla `goals` NO tiene los campos financieros y quedó redundante con `incomes_and_goals.sql`. **Nunca se ejecutó contra la base real.** Recomendación para la próxima sesión: **borrarlo** y consolidar todo en un único archivo canónico (ver §7 Próximos pasos) para que quien retome no se confunda sobre cuál es "el" schema.

### Seguridad (RLS)
Todas las tablas tienen `enable row level security` + policy `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` (mismo nombre de policy `"own rows"` en todas). Excepción: `profiles` tiene policies separadas para select/update/insert (`select own or admin`, `update own or admin`, `insert own`) porque los admins necesitan leer todos los perfiles (para el panel de Usuarios) sin poder tocar los datos financieros de nadie más.

---

## 4. Autenticación y roles

- Supabase Auth, email + contraseña. Sin OAuth.
- **"Confirm email" está ACTIVADO** en producción (se desactivó temporalmente durante pruebas y se reactivó antes de compartir el link).
- Tabla `profiles` espejo de `auth.users`, creada automáticamente por trigger `on_auth_user_created` al registrarse.
- **Rol admin:** el correo `juaneschaverra15@gmail.com` se marca `role='admin'` automáticamente al registrarse (hardcodeado en el trigger SQL). Ver a un usuario ya existente que debería ser admin pero se registró antes del trigger: hay lógica de auto-reparación en el frontend (`App.jsx`, efecto de carga de perfil) que crea la fila de perfil como `role='user'` si falta — un admin preexistente necesitaría un `UPDATE profiles SET role='admin' WHERE email=...` manual si esto vuelve a pasar.
- **Admin ve:** insignia dorada "FUNDADOR" en el sidebar/topbar, ítem de nav "Usuarios" con lista de todas las cuentas (email, rol, fecha, activar/desactivar). Los admins **NO** pueden ver gastos/metas/etc. de otros usuarios (solo la tabla `profiles`, nunca las tablas de datos).
- **Cuenta desactivada:** si `profiles.disabled = true`, el usuario es deslogueado automáticamente en su próxima carga y ve un mensaje fijo.

---

## 5. Flujo de carga de datos (App.jsx)

```
session (Supabase Auth) 
  → profile (tabla profiles, con auto-creación si falta)
    → useEffect único: cuando `profile` está listo, hace UN Promise.all
      que trae goals + incomes + custom_categories + tasks + expenses +
      habits + products + activities + activity_completions + journals +
      trades, y también lee profile.account_size.
      Bandera de carga: `financeLoading` (nombre heredado de cuando solo
      cubría Metas/Ingresos; ahora gatea TODO lo anterior).
```

Gates de render en `App()` (en este orden): `!isSupabaseConfigured` → `authLoading` → `disabledNotice` → `!session` → `profileError` → `profileLoading || !profile`. Cada uno con su propia pantalla en `AuthShell`.

---

## 6. Funcionalidades implementadas, sección por sección

### Resumen
Dashboard general: gastos del mes, tareas completadas hoy, productos ganadores, racha de hábitos más larga (calculada real, ya no hardcodeada), gráfico de gastos por día (Recharts).

### Gastos
- Categorías fijas (10, con ícono+color de `CATEGORY_META`) + **categorías personalizadas** (nombre+color libre, tabla `custom_categories`, ícono genérico `Tag`).
- Tarjeta "Ingreso mensual" configurable manualmente (no calculado de Ingresos reales — decisión explícita del usuario) con barra de presupuesto (gastado vs. disponible, se pone coral si te pasas).
- CRUD completo de gastos por categoría (`CategoryCalendar`) con calendario mensual.

### Ingresos y saldos (nueva, construida en esta sesión)
- Ingresos totales, saldo actual (= ingresos, sin egresos todavía — diseñado para poder restar egresos después), total registros, ingresos del mes, ingresos de hoy.
- CRUD completo con validación (monto > 0, concepto obligatorio), confirmación inline antes de eliminar, mensajes de éxito/error, estados vacío/carga.

### Metas
- 4 timeframes (diario/semanal/mensual/trimestral), CRUD completo persistido.
- **Meta financiera** (nuevo tipo): en vez de progreso manual, se calcula en vivo con `computeFinancialProgress(incomes, goal)` = `min(100, suma_ingresos_desde(financial_start_date) / financial_target * 100)`. Es la única fuente de verdad — nunca se guarda un `%` duplicado.

### Rutina
- Timeline por horas (día/semana), bloques con tipo (`enfoque`/`operativo`/`descanso`/`movimiento`/`otra` con color custom vía `<input type=color>`), drag para mover/redimensionar, repetición (diario/semanal).
- Panel "Planea tu día": arrastra tareas/hábitos/metas pendientes al timeline (crea actividad con `source: {kind, id}` vinculada — completarla en Rutina completa el original y viceversa).
- Cierre del día: journal (rating, qué salió bien, qué mejorar, feeling emoji, notas) + % de cumplimiento del día.
- Composición del día: barra de tiempo por tipo de bloque.

### Trading
- Calendario mensual estilo TradeZella (verde/rojo por día), navegación de mes.
- Tamaño de cuenta configurable (presets 1K-100K + custom) — **ahora persistido** en `profiles.account_size` (pendiente correr SQL).
- % de retorno por día/mes calculado sobre el tamaño de cuenta.
- CRUD de operaciones (símbolo + PNL) por día vía modal.

### Tareas / Hábitos / Productos testeados
CRUD completo y persistido (agregar/editar/eliminar), siguiendo el mismo patrón. Hábitos tiene selector de color (4 tonos fijos) + calendario de cumplimiento mensual + rachas.

### Usuarios (solo admin)
Lista de perfiles, activar/desactivar cuentas.

### Móvil / responsive
- `useIsMobile()` hook (breakpoint 768px) usado en todos los grids de 2 columnas para colapsar a 1.
- Sidebar → topbar + drawer lateral en móvil.
- Toggle de tema (claro/oscuro, componente `AppleToggle` estilo iOS) presente tanto en el topbar de escritorio (con selector de idioma decorativo y nombre/email del usuario) como junto al menú hamburguesa en móvil, ambos con íconos sol/luna identificando la función.

---

## 7. Variables de entorno

Archivo `.env` (NO está en git, sí en `.gitignore`; `.env.example` sí está commiteado como referencia):

```
VITE_SUPABASE_URL=https://yzpyobyflkyvpflqqljt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (JWT anon/public key, seguro exponer en frontend)
```

**En Vercel** (Project → Settings → Environment Variables) deben existir las mismas dos, marcadas para Production+Preview. **Importante:** Vite las "hornea" en build time — si se cambian, hay que hacer **Redeploy** manual en Vercel, no basta con guardarlas.

No hay ninguna otra variable de entorno ni secreto en el proyecto. El token personal de Vercel usado para automatizar deploys/env vars durante esta sesión NO se guardó en ningún archivo (se usó una sola vez vía API y se descartó).

---

## 8. Decisiones de diseño importantes (por qué, no solo qué)

- **Paleta de colores validada con el skill `dataviz`:** oro/teal/coral/violeta, calculados y verificados con `validate_palette.js` (contraste, daltonismo) para modo oscuro y claro por separado — no son colores "a ojo". Documentados en el comment-header de `App.jsx` líneas ~14-29.
- **Ingreso mensual (Gastos) es MANUAL, no automático:** decisión explícita del usuario — es un valor tipo "sueldo esperado" distinto de los ingresos reales transaccionales de "Ingresos y saldos". Preguntar antes de "arreglar" esto asumiendo que deberían ser lo mismo.
- **Meta financiera calcula progreso en vivo, nunca lo guarda:** para evitar inconsistencias/duplicados (requisito explícito del usuario: "no sumar dos veces el mismo registro").
- **Saldo actual = ingresos (sin egresos) por ahora:** diseñado deliberadamente para poder restar egresos en el futuro sin refactor.
- **No se creó una tabla `goals` separada para metas financieras:** se extendió la tabla `goals` existente con 3 columnas nuevas, por instrucción explícita del usuario.
- **No hay CI/tests automatizados.** Verificación = `npm run build` + `npm run lint` (oxlint) + revisión manual de código línea por línea +, cuando fue posible, prueba visual en `preview_*` tools contra el servidor local. **El asistente nunca ha podido iniciar sesión real en la app** (política de seguridad: nunca se entran contraseñas), así que ningún flujo post-login fue verificado por click real del asistente — solo por inspección de código + build limpio + bundle de producción confirmado con las strings esperadas.

---

## 9. Errores pendientes / riesgos conocidos

1. **`full_persistence.sql` posiblemente no corrido** (ver §3) — bloquea persistencia de 6 secciones enteras.
2. **`supabase/schema.sql` obsoleto y confuso** — debería borrarse o marcarse claramente como histórico.
3. **Bundle sin code-splitting:** ~870KB (Vite avisa "chunks larger than 500kB"). No es un bug, pero si el proyecto crece más vale la pena `React.lazy()` por sección.
4. **Ningún flujo fue probado end-to-end por el asistente con login real** — todo lo construido en persistencia (~8 tablas, ~20 funciones CRUD) pasó build+lint+revisión de código pero no un click real de "guardar → recargar → sigue ahí" hecho por el asistente. Recomendado: el usuario debería probar cada sección una vez después de correr el SQL pendiente.
5. **`git config` de commits usa nombre/email autodetectados** (`juanchaverra@MacBook-Air-de-Juan.local`) en vez de un nombre real configurado — cosmético, no rompe nada.
6. Warnings de lint pre-existentes y no relacionados: `LineChart`/`Line` importados de `recharts` y nunca usados (línea 12 de `App.jsx`).

---

## 10. Próximos pasos sugeridos (no empezados)

- Confirmar que `full_persistence.sql` se corrió; si no, correrlo y verificar cada sección migrada.
- Consolidar los 6 archivos `.sql` en uno solo canónico y borrar `schema.sql`.
- Módulo de egresos para completar `saldo = ingresos - egresos` (mencionado como "próximamente" en la UI de Ingresos y saldos).
- Decidir si el selector de idioma en el topbar (actualmente decorativo, no traduce nada) se implementa de verdad o se retira.
- Code-splitting por sección si el bundle sigue creciendo.
- Considerar mover las funciones CRUD de `App()` (que ya son ~25 funciones) a un hook custom o módulo aparte (`useProgoData.js`) si `App.jsx` sigue creciendo — hoy funciona pero el archivo es monolítico (2940 líneas).

---

## 11. Cómo retomar en un chat nuevo

1. Pega este archivo completo como primer mensaje.
2. Repo: `~/progo` local, remoto `https://github.com/JcProgo/Progo.git`, rama `main`, deploy automático a Vercel en cada push.
3. Antes de tocar código, correr las verificaciones de §3 (`curl` a las tablas) para confirmar qué existe hoy en la base real — este documento puede quedar desactualizado si se corrió SQL después de escribirlo.
4. Servidor local: `npm run dev` (puerto 5173) — usar `preview_start`/`preview_*` tools, no abrir Chrome directo.
5. El asistente **no debe** iniciar sesión ni crear cuentas por el usuario (política de seguridad) — para probar login/flujos autenticados, pedirle al usuario que lo haga y reporte, o que comparta capturas vía "revisa finder".

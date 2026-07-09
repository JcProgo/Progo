# PROGO — Resumen técnico maestro

**Propósito de este documento:** contexto completo para retomar el desarrollo de PROGO en una conversación nueva sin perder ninguna decisión, estado o pendiente. Última actualización: 2026-07-09 (sesión de consolidación: módulo de Egresos, SQL canónico, selector de idioma retirado, code-splitting de Recharts).

---

## 1. Qué es PROGO

Plataforma de gestión de negocio/productividad personal ("Organiza. Ejecuta. Progresa.") por **JC CREW**. Multi-usuario, con cuentas reales (correo/contraseña) y aislamiento total de datos por usuario.

Secciones: Resumen, Gastos, Ingresos y saldos, Metas, Rutina, Trading, Tareas diarias, Hábitos, Productos testeados, y Usuarios (solo admin).

---

## 2. Arquitectura

- **Frontend:** React 19 + Vite 8, un solo archivo `src/App.jsx` (~2990 líneas, todos los componentes). Sin router — navegación por estado (`view`) en el shell de `App()`.
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
| `profiles` | ✅ Sí (con `role`, `disabled`, `monthly_income`, `account_size`) |
| `goals` | ✅ Sí (con campos de meta financiera) |
| `incomes` | ✅ Sí |
| `custom_categories` | ✅ Sí |
| `tasks` | ✅ Sí |
| `expenses` | ✅ Sí |
| `habits` | ✅ Sí |
| `products` | ✅ Sí |
| `activities` | ✅ Sí |
| `activity_completions` | ✅ Sí |
| `journals` | ✅ Sí |
| `trades` | ✅ Sí |
| `egresos` | ✅ Sí (confirmado en vivo tras correr `supabase/schema.sql`) |

**✅ RESUELTO:** el usuario corrió `supabase/schema.sql` y se verificó en vivo (`HTTP 200` contra `/rest/v1/egresos`) que la tabla existe. El módulo de Egresos ya puede persistir de punta a punta. No queda ninguna tabla pendiente de crear.

### Archivo SQL en el repo

Ya no hay migraciones fragmentadas: todo vive en **`supabase/schema.sql`**, un único archivo canónico e idempotente (safe de correr repetidas veces) que refleja el snapshot completo del esquema — `profiles` (+ trigger de auto-registro + `is_admin()`), `goals`, `incomes`, `egresos`, `custom_categories`, `tasks`, `expenses`, `habits`, `products`, `activities`, `activity_completions`, `journals`, `trades`. Los archivos previos (`profiles.sql`, `incomes_and_goals.sql`, `monthly_income.sql`, `custom_categories.sql`, `full_persistence.sql`, y el `schema.sql` obsoleto original con la tabla `user_settings` nunca usada) fueron fusionados en este único archivo y borrados del repo.

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
Dashboard general: gastos del mes, tareas completadas hoy, productos ganadores, racha de hábitos más larga (calculada real, ya no hardcodeada), gráfico de gastos por día (Recharts, cargado de forma perezosa — ver §8).

### Gastos
- Categorías fijas (10, con ícono+color de `CATEGORY_META`) + **categorías personalizadas** (nombre+color libre, tabla `custom_categories`, ícono genérico `Tag`).
- Tarjeta "Ingreso mensual" configurable manualmente (no calculado de Ingresos reales — decisión explícita del usuario) con barra de presupuesto (gastado vs. disponible, se pone coral si te pasas).
- CRUD completo de gastos por categoría (`CategoryCalendar`) con calendario mensual.

### Ingresos y saldos
- Tabs "Ingresos" / "Egresos" (componente `MOVEMENT_KIND_META`, mismo patrón de tabs que Tareas) sobre las mismas tarjetas de estadísticas: ingresos totales, egresos totales, **saldo actual = ingresos − egresos** (ya no es un placeholder "próximamente"), ingresos del mes, egresos del mes.
- CRUD completo para ambos tipos (tablas `incomes` y `egresos`, mismas columnas: `amount`, `concept`, `category`, `note`, y `income_date`/`expense_date` respectivamente) con validación (monto > 0, concepto obligatorio), confirmación inline antes de eliminar, mensajes de éxito/error, estados vacío/carga.

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
- Toggle de tema (claro/oscuro, componente `AppleToggle` estilo iOS) presente tanto en el topbar de escritorio (con nombre/email del usuario) como junto al menú hamburguesa en móvil, ambos con íconos sol/luna identificando la función. El selector de idioma decorativo que existía antes en el topbar de escritorio **fue retirado** (no traducía nada realmente — ver §8).

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
- **Saldo actual = ingresos − egresos:** implementado en esta sesión. La tabla `egresos` mirror exactamente la forma de `incomes` (mismas columnas salvo `income_date`→`expense_date`) para mantener el patrón de "una tabla por concepto, mismo shape". El componente `IngresosSaldos` quedó genérico por `kind` (`ingreso`/`egreso`) en vez de duplicar todo el JSX — un solo formulario/lista que cambia de tabla y color según la pestaña activa.
- **No se creó una tabla `goals` separada para metas financieras:** se extendió la tabla `goals` existente con 3 columnas nuevas, por instrucción explícita del usuario.
- **Selector de idioma retirado, no implementado:** era decorativo (cambiaba una etiqueta pero no traducía ninguna cadena de la app). Decisión: mejor quitarlo que dejar una UI que miente sobre lo que hace. Si se quiere i18n real en el futuro, es un proyecto aparte (extraer todas las cadenas hardcodeadas en español a un diccionario).
- **Recharts se carga con `import()` dinámico, no import estático:** el hook `useRecharts()` (arriba de `App.jsx`) hace `import("recharts")` una sola vez (promesa cacheada a nivel de módulo) y los componentes `Resumen`/`Hábitos` renderizan un placeholder `ChartLoading` mientras tanto. Esto saca ~350KB del bundle inicial sin tocar la estructura de archivos del proyecto (seguía siendo un solo `App.jsx`) — se prefirió sobre extraer cada sección a su propio archivo con `React.lazy()`, que habría sido un refactor mucho más grande y riesgoso sin poder probarlo con login real.
- **No hay CI/tests automatizados.** Verificación = `npm run build` + `npm run lint` (oxlint) + revisión manual de código línea por línea +, cuando fue posible, prueba visual en `preview_*` tools contra el servidor local. **El asistente nunca ha podido iniciar sesión real en la app** (política de seguridad: nunca se entran contraseñas), así que ningún flujo post-login fue verificado por click real del asistente — solo por inspección de código + build limpio + bundle de producción confirmado con las strings esperadas.

---

## 9. Errores pendientes / riesgos conocidos

1. **Ningún flujo fue probado end-to-end por el asistente con login real** — ni la persistencia previa (~8 tablas) ni el nuevo módulo de Egresos, code-splitting de Recharts, o remoción del selector de idioma pasaron por un click real de "usar la app" hecho por el asistente (política de seguridad: nunca se entran contraseñas). Todo pasó build+lint+revisión de código línea por línea, incluyendo verificar a mano que cada columna escrita coincide con `schema.sql`, y que la tabla `egresos` existe en vivo (`HTTP 200` en `/rest/v1/egresos`, confirmado 2026-07-09 tras correr el SQL). Recomendado: el usuario debería probar cada sección una vez, especialmente Ingresos y saldos con ambas pestañas.
2. **`git config` de commits usa nombre/email autodetectados** (`juanchaverra@MacBook-Air-de-Juan.local`) en vez de un nombre real configurado — cosmético, no rompe nada.
3. **Bundle inicial sigue por encima de 500KB** (bajó de ~870KB a ~521KB tras sacar Recharts a un chunk separado cargado bajo demanda; el chunk de Recharts en sí también supera 500KB, así que Vite sigue avisando en el build). No es un bug — solo queda como posible optimización futura si el proyecto sigue creciendo (ej. tree-shaking más agresivo de `lucide-react`, o extraer más secciones a módulos separados).

---

## 10. Próximos pasos sugeridos (no empezados)

- Probar Ingresos y saldos con datos reales (ambas pestañas: registrar, editar, eliminar un ingreso y un egreso, confirmar que el saldo se actualiza y que sigue ahí tras recargar).
- Considerar mover las funciones CRUD de `App()` (que ya son ~28 funciones) a un hook custom o módulo aparte (`useProgoData.js`) si `App.jsx` sigue creciendo — hoy funciona pero el archivo es monolítico (~2950 líneas).
- Si se decide invertir en internacionalización real (el selector de idioma se retiró por decorativo, ver §8), sería un proyecto aparte: extraer todas las cadenas hardcodeadas en español a un diccionario.

---

## 11. Cómo retomar en un chat nuevo

1. Pega este archivo completo como primer mensaje.
2. Repo: `~/progo` local, remoto `https://github.com/JcProgo/Progo.git`, rama `main`, deploy automático a Vercel en cada push.
3. Antes de tocar código, correr las verificaciones de §3 (`curl` a las tablas) para confirmar qué existe hoy en la base real — este documento puede quedar desactualizado si se corrió SQL después de escribirlo.
4. Servidor local: `npm run dev` (puerto 5173) — usar `preview_start`/`preview_*` tools, no abrir Chrome directo.
5. El asistente **no debe** iniciar sesión ni crear cuentas por el usuario (política de seguridad) — para probar login/flujos autenticados, pedirle al usuario que lo haga y reporte, o que comparta capturas vía "revisa finder".

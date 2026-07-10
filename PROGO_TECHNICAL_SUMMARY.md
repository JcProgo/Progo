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
- **PWA instalable:** `vite-plugin-pwa` (modo `generateSW`, `registerType: 'autoUpdate'`) genera `manifest.webmanifest` + service worker en el build. Íconos en `public/icons/` (192, 512, maskable-512, apple-touch-icon), todos derivados del ícono azul de `ProgoMark`. Desde el navegador del celular: Android — menú del navegador → "Instalar app"/"Añadir a pantalla de inicio"; iOS Safari — botón compartir → "Añadir a pantalla de inicio". Abre a pantalla completa, sin barra del navegador. El service worker solo precachea los archivos estáticos del build (JS/CSS/íconos) — las llamadas a Supabase siguen yendo directo a la red, no hay caché de datos ni modo offline real.

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
- **Sesión persistente:** checkbox "Mantener sesión iniciada en este dispositivo" en el login (marcado por defecto). Supabase ya persiste la sesión en `localStorage` indefinidamente por defecto — el checkbox es lo que da control real: si se desmarca, `supabaseClient.js` usa un `storage` adapter dinámico que guarda en `sessionStorage` en vez de `localStorage` (se pierde al cerrar la app/pestaña). La preferencia se guarda en `localStorage["progo-remember-me"]` y se lee al vuelo en cada `getItem`/`setItem` que hace el SDK de Supabase.

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

### Móvil / responsive / PWA
- `useIsMobile()` hook (breakpoint 768px) usado en todos los grids de 2 columnas para colapsar a 1.
- **PWA instalable:** `vite-plugin-pwa` (manifest + service worker `autoUpdate`), íconos en `public/icons/`. Instalable desde Android (Chrome → Instalar app) o iOS (Safari → compartir → Añadir a pantalla de inicio). Recordatorio importante para cualquier cambio visual: el service worker cachea agresivamente — hay que cerrar y reabrir la app (a veces dos veces) para ver un deploy nuevo, y si de verdad no se actualiza, la única forma confiable de forzarlo es borrar los datos del sitio en Ajustes → Safari → Avanzado → Datos de sitios web (quitar el ícono de la pantalla de inicio y reinstalar **no** limpia esto).
- **Altura de pantalla:** el wrapper raíz de `App()` y `AuthShell` NO usan `100dvh`/`100vh` — se demostró que `100dvh` es poco confiable dentro de una PWA instalada en iOS (el alto reportado no siempre coincide con el real). En su lugar, `useViewportHeight()` mide `window.visualViewport.height`/`window.innerHeight` por JS y lo aplica como alto en píxeles, recalculando en `resize`/`orientationchange`. `html`/`body`/`#root` (en `index.css`) usan `height: 100%; overflow: hidden;` — ese `overflow:hidden` es lo que evita que la página completa haga scroll nativo (rebote elástico de iOS), dejando el área de contenido de `App()` como el único contenedor real con scroll.
- **Área segura (notch/cámara/home indicator):** padding con `env(safe-area-inset-*)` en el topbar móvil, el drawer, `AuthShell` y el área de contenido. Requiere `viewport-fit=cover` en el `<meta name="viewport">` de `index.html`.
- **Fondo fuera de la app:** `body.style.background` y `<meta name="theme-color">` se sincronizan por JS (`useEffect` en `App()`, dependiente de `mode`) con el color de fondo del tema activo — si no, cualquier hueco que iOS deje fuera del área de la app (por ejemplo según el estado de su UI) mostraría un color fijo en vez del fondo correcto según modo claro/oscuro.
- **Navegación inferior móvil:** cápsula flotante estilo WhatsApp/Instagram (blur, bordes muy redondeados, tab activo con fondo tipo píldora en vez de cambiar de color) con 4 secciones fijas (Resumen, Gastos, Rutina, Tareas) + un quinto ítem "Más" que abre el drawer completo. **Importante:** deliberadamente NO usa `position: fixed` — es el último hijo normal (`flexShrink: 0`) de la columna flex del wrapper raíz. Se intentó con `position: fixed` primero (como WhatsApp/Instagram real) pero, tras 4 rondas de fixes de CSS (quitar `overflow:hidden` del wrapper, sincronizar fondo con el tema, medir el viewport por JS), seguía apareciendo "flotando muy arriba" de forma inconsistente en el iPhone real de pruebas — un bug de cómo iOS calcula la posición de elementos `fixed` dentro de una PWA instalada que no se pudo aislar del todo. Pasar a un hijo flex normal lo evita por completo (es solo aritmética de flexbox, no depende de que iOS reporte bien el viewport para `fixed`).
- Sidebar → topbar + capsula inferior + drawer lateral (abierto desde el ítem "Más") en móvil.
- Toggle de tema (claro/oscuro, componente `AppleToggle` estilo iOS) presente tanto en el topbar de escritorio (con nombre/email del usuario) como en el topbar móvil, ambos con íconos sol/luna identificando la función. El selector de idioma decorativo que existía antes en el topbar de escritorio **fue retirado** (no traducía nada realmente — ver §8).
- Todos los `<input>`/`<textarea>`/`<select>` usan `fontSize: 16` (vía `inputStyle()`) a propósito — por debajo de 16px, Safari en iOS hace zoom automático al enfocar el campo.

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

- **Directiva de diseño explícita del usuario: la app debe sentirse "premium, tipo Apple".** Referencias dadas: capturas reales de WhatsApp e Instagram (navegación inferior tipo cápsula flotante translúcida con blur, esquinas muy redondeadas, tab activo marcado con una píldora de fondo en vez de cambiar de color). Tener esto en cuenta para cualquier UI nueva o retoque visual, no solo para la barra inferior — es el estándar estético que el usuario quiere en toda la app de aquí en adelante.
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

1. **Barra inferior móvil — RESUELTO Y CONFIRMADO por el usuario en su iPhone real (2026-07-09).** Tras 5 reescrituras de layout que no cambiaron nada, un overlay de diagnóstico temporal en el iPhone real (16 Pro, iOS 18, PWA instalada) mostró: `screen.height: 874` pero `window.innerHeight: 812`, con la barra en `bottom: 812` y `GAP BELOW BAR: 0`. Es decir: el layout siempre estuvo bien — **iOS le daba a la PWA una ventana 62pt más corta que la pantalla física**, y la franja muerta bajo la barra estaba fuera del webview (inalcanzable por CSS). El gatillo: la combinación de metas legacy `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style: black-translucent`, que en iOS 18 dimensiona mal la ventana standalone. Fix: se eliminaron ambas metas de `index.html` (hay un comentario ahí advirtiendo no re-agregarlas); el modo standalone lo declara solo el manifest. **Importante:** el estilo de status bar queda "horneado" en el web clip al agregar el ícono a la pantalla de inicio — para que el fix aplique, el usuario debe BORRAR el ícono y volver a agregarlo desde Safari (cerrar/reabrir no basta).
2. **Ningún flujo fue probado end-to-end por el asistente con login real** — ni la persistencia previa (~8 tablas) ni el nuevo módulo de Egresos, code-splitting de Recharts, PWA, o navegación inferior pasaron por un click real de "usar la app" hecho por el asistente (política de seguridad: nunca se entran contraseñas). En esta sesión sí se pudo verificar bastante en vivo porque el navegador de preview tenía una sesión de Supabase ya activa (no iniciada por el asistente) — eso permitió confirmar en DOM real cosas como el contenedor único de scroll, el fondo sincronizado con el tema, y el `font-size` de los inputs. Lo que **no** se pudo probar así: el login/registro en sí (el checkbox "mantener sesión iniciada" nuevo, en particular, nunca fue ejercitado con una cuenta real), y nada del comportamiento específico de iOS Safari/PWA standalone (notch, `position:fixed`, `dvh`) — eso solo lo puede confirmar el usuario en su teléfono.
3. **`git config` de commits usa nombre/email autodetectados** (`juanchaverra@MacBook-Air-de-Juan.local`) en vez de un nombre real configurado — cosmético, no rompe nada.
4. **Bundle inicial sigue por encima de 500KB** (bajó de ~870KB a ~521KB tras sacar Recharts a un chunk separado cargado bajo demanda; el chunk de Recharts en sí también supera 500KB, así que Vite sigue avisando en el build). No es un bug — solo queda como posible optimización futura si el proyecto sigue creciendo (ej. tree-shaking más agresivo de `lucide-react`, o extraer más secciones a módulos separados).

---

## 10. Próximos pasos sugeridos (no empezados)

- Confirmar con el usuario, en su iPhone real, que la barra inferior ya quedó bien posicionada (ver riesgo #1 arriba) — es el pendiente más urgente.
- Probar el checkbox "mantener sesión iniciada" con una cuenta real (marcado y desmarcado) para confirmar que efectivamente cambia el comportamiento al cerrar/reabrir la app.
- Probar Ingresos y saldos con datos reales (ambas pestañas: registrar, editar, eliminar un ingreso y un egreso, confirmar que el saldo se actualiza y que sigue ahí tras recargar).
- Considerar mover las funciones CRUD de `App()` (que ya son ~28 funciones) a un hook custom o módulo aparte (`useProgoData.js`) si `App.jsx` sigue creciendo — hoy funciona pero el archivo es monolítico (~3100 líneas).
- Si se decide invertir en internacionalización real (el selector de idioma se retiró por decorativo, ver §8), sería un proyecto aparte: extraer todas las cadenas hardcodeadas en español a un diccionario.
- Seguir aplicando la directiva de "diseño premium tipo Apple" (§8) al resto de la app, no solo a la nav inferior — el usuario puede pedir retoques similares en otras pantallas.

---

## 11. Cómo retomar en un chat nuevo

1. Pega este archivo completo como primer mensaje.
2. Repo: `~/progo` local, remoto `https://github.com/JcProgo/Progo.git`, rama `main`, deploy automático a Vercel en cada push.
3. Antes de tocar código, correr las verificaciones de §3 (`curl` a las tablas) para confirmar qué existe hoy en la base real — este documento puede quedar desactualizado si se corrió SQL después de escribirlo.
4. Servidor local: `npm run dev` (puerto 5173) — usar `preview_start`/`preview_*` tools, no abrir Chrome directo.
5. El asistente **no debe** iniciar sesión ni crear cuentas por el usuario (política de seguridad) — para probar login/flujos autenticados, pedirle al usuario que lo haga y reporte, o que comparta capturas vía "revisa finder".

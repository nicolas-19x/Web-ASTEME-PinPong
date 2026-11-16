# Academia de Tenis de Mesa · Plataforma de gestión

Plataforma privada para el entrenador, los jugadores y sus familias: expedientes
deportivos, evaluaciones, planes de desarrollo, torneos internos automatizados,
competencias externas, horarios, asistencia, comunicados, estadísticas e informes.
Español, zona horaria `America/Costa_Rica`.

**Stack:** React 19 + TypeScript + Vite, Tailwind CSS 4, shadcn/ui (Radix) + Lucide,
TanStack Query, Supabase (PostgreSQL, Auth, Storage, Edge Functions), react-pdf,
exceljs, Recharts. Todas las dependencias están fijadas a versión exacta.

---

## Qué está construido

| Módulo | Estado | Notas |
|---|---|---|
| Autenticación y roles | Funcional | Sin registro público. Roles: entrenador (admin), jugador, encargado. El rol vive en `profiles` y solo lo cambia un admin. |
| Seguridad (RLS) | Funcional y probado | RLS en **todas** las tablas; funciones de autorización en el esquema `private` (no expuesto). 46 pruebas SQL. Advisors de Supabase: 0 hallazgos. |
| Panel del entrenador | Funcional | Totales, distribución por categoría y nivel, próximos eventos, últimos controles y resultados, alertas, actividad reciente, accesos rápidos y buscador global (Ctrl/⌘ K). |
| Jugadores y expedientes | Funcional | Listado con búsqueda, filtros, orden y vista tabla/tarjetas; alta con validación; ficha con información general, historial competitivo, controles, evaluaciones, plan de desarrollo, logros e historial de cambios; notas internas privadas; archivo sin pérdida de historial. Foto opcional solo con autorización (almacenamiento privado). |
| Evaluaciones | Funcional | Habilidades configurables, puntuación 0–10, observación o ambas; conclusión; nota privada; compartir o no; evolución y comparación con la anterior. |
| Planes de desarrollo | Funcional | Versionado automático; cada objetivo/fortaleza/aspecto se comparte individualmente. |
| **Motor de torneos** | Funcional y probado | Asistente en 5 pasos; ranking y siembra en serpentina; sorteo reproducible o desempate manual; grupos y todos contra todos con BYE; mesas sin solapamientos; marcador digital (11 puntos, diferencia de 2, mejor de 3/5/…); validación de sets en el servidor; correcciones auditadas; clasificación con desempates configurables y decisión manual documentada; eliminación directa con BYE a cabezas de serie, sin cruces del mismo grupo en primera ronda cuando es posible y avance automático; tercer lugar; cierre que integra posición, partidos, medallas y ranking en los expedientes sin duplicados; vista en vivo. |
| PDF de torneos | Funcional | Planilla previa (participantes, ranking, grupos, cabezas de serie, turnos, mesas, casillas para sets, tablas vacías) y PDF final (podio, estadísticas, clasificación, eliminatoria, grupos). |
| Competencias externas | Funcional | Convocados, inscritos, posición, partidos, sets, medallas y reconocimientos (pasan al expediente y a logros); galería opcional solo con fotos autorizadas. |
| Calendario deportivo | Funcional | Torneos, competencias, controles internos y actividades especiales. No es un calendario de reservas. |
| Horarios y grupos | Funcional | Grupos por categoría/nivel, días, horas y espacio; integrantes con historial; cambios puntuales y cancelaciones visibles en los portales. |
| Asistencia | Funcional | Lista táctil (presente/ausente/justificado) con guardado inmediato; reportes por jugador, mes y grupo; tendencia de 6 meses. |
| Comunicados | Funcional | Destinatarios por academia, categoría o grupo y por jugadores y/o familias; borradores; lecturas. Sin chat ni comentarios. |
| Estadísticas y reconocimientos | Funcional | Campeones por categoría, podios, récords, rachas, asistencia, mejoras; distinciones (jugador del mes, etc.). |
| Informes y exportación | Funcional | PDF individual con secciones elegibles (y opción “solo lo compartible”), PDF de torneos pasados, CSV y Excel de jugadores, asistencia y resultados. |
| Portal del jugador | Funcional | Solo lectura; solo su expediente y lo compartido. |
| Portal familiar | Funcional | Uno o varios hijos vinculados **y autorizados**; sin búsqueda de otros menores. |
| Configuración | Funcional | Nombre, logo, banner; colores, fondo, tipografía y tema claro/oscuro con vista previa y control de contraste; categorías, niveles, habilidades y pruebas; reglas y desempates predeterminados; cuentas y vínculos; visibilidad en portales. |

**Datos iniciales:** los 12 jugadores del documento maestro, solo con los datos
entregados (`supabase/seed.sql`): sin apellidos inventados (excepto “Castro”, que
venía en el documento), sin fechas de nacimiento, ranking, evaluaciones ni resultados.
La edad se guarda como *edad informada* con su fecha de registro; Gonzalo queda con
edad pendiente. No se crearon cuentas para menores.

**Excluido a propósito:** biblioteca de ejercicios, planificador de sesiones,
reservas, calendario genérico, tienda/pagos, red social, chat y comentarios.

---

## Poner en marcha (local)

Requisitos: Node 22+, Docker.

```bash
npm install
npx supabase start          # base de datos, Auth, Storage y Edge Functions locales
npx supabase db reset       # aplica la migración y carga los 12 jugadores reales
cp .env.example .env.local  # y completa con la URL y la clave PUBLICABLE que imprime `supabase start`
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=<clave secreta local> \
  node scripts/create-admin.mjs entrenador@ejemplo.com 'ContraseñaSegura1' 'Nombre del entrenador'
npm run dev                 # http://127.0.0.1:5173
```

El resto de cuentas (jugadores y familias) las crea el entrenador en
**Configuración → Cuentas y vínculos**.

## Publicar en Supabase (producción)

Faltan las credenciales del proyecto de Supabase: no se entregaron, así que no hay
despliegue en la nube. Para publicar:

1. Crea un proyecto en Supabase y vincúlalo: `npx supabase link --project-ref <ref>`.
2. Aplica el esquema: `npx supabase db push`. Carga los datos iniciales ejecutando
   `supabase/seed.sql` una sola vez (SQL Editor o `psql`).
3. Despliega la función de cuentas: `npx supabase functions deploy admin-users`.
   Usa las variables que Supabase inyecta (`SUPABASE_URL`, `SUPABASE_SECRET_KEYS`);
   no hace falta configurar secretos.
4. En **Authentication**, desactiva el registro público (ya está así en `config.toml`)
   y configura la URL del sitio.
5. Crea el primer administrador con `scripts/create-admin.mjs` usando la clave secreta
   **desde una máquina de confianza** (nunca en el frontend).
6. Compila el frontend (`npm run build`) y publica `dist/` en cualquier hosting estático
   (Vercel, Netlify, Cloudflare Pages…) con `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_PUBLISHABLE_KEY`. Configura el hosting para que todas las rutas
   sirvan `index.html`.

Nota: desde 2026 las tablas nuevas no se exponen solas a la Data API; la migración
incluye los `GRANT` explícitos necesarios y RLS en todas las tablas.

---

## Pruebas

| Comando | Qué prueba | Resultado |
|---|---|---|
| `npm test` | 55 pruebas unitarias: motor de torneos (4, 5, 8, 12 y 16 participantes; grupos pares e impares; serpentina; rankings vacíos y empatados; BYE; mesas sin solapamientos; marcador; desempates, incluido el triple empate circular; eliminatoria con BYE, cruces del mismo grupo, avance, tercer lugar, correcciones) y exportación CSV | 55/55 |
| `npm run test:rls` | 46 pruebas de seguridad en la base: anónimo, jugador, encargado, encargado desactivado, vínculo no autorizado y administrador (lectura, escritura, escalada de rol, notas privadas, comunicados por destinatario, RPC, validación de sets en el servidor, auditoría, ranking, historial, versionado) | 46/46 |
| `npm run test:e2e` | 22 recorridos en navegador (Playwright) sobre datos ficticios: roles, persistencia tras cerrar sesión, edición e historial, archivo, evaluación y plan compartidos, torneo completo (asistente, marcador en celular, set inválido rechazado, corrección auditada, eliminatoria, cierre, PDF previo y final), asistencia en celular, comunicados, CSV, portales de jugador y familia, intentos de acceso indebido por API, sin desborde horizontal a 390, 820 y 1366 px, sin errores de JavaScript | 22/22 |
| `npx supabase db advisors` | Asesor de seguridad y rendimiento de Supabase | 0 hallazgos |

`npm run test:e2e` reinicia la base local, carga **datos ficticios** (`scripts/test-fixtures.mjs`,
que se niega a ejecutarse contra cualquier URL que no sea local) y levanta Vite. Los datos
de prueba nunca se mezclan con los reales: viven solo en el entorno local y se borran con
`npm run db:reset`. Las capturas quedan en `test-results/e2e/`.

---

## Arquitectura

```
src/
  lib/tournament/   Motor de torneos en TypeScript puro (sin React ni Supabase) + pruebas
  lib/              Cliente Supabase, auth, tema (tokens CSS), formato de fechas/edades, consultas
  features/         Lógica de torneos sobre la base de datos, PDF (react-pdf), exportación
  components/       Componentes de la app y de shadcn/ui
  pages/admin/      Módulos del entrenador
  pages/portal/     Portales de jugador y familia
supabase/
  migrations/       Esquema, RLS, triggers, RPC y buckets de Storage
  seed.sql          Datos reales iniciales
  tests/            Pruebas SQL de RLS
  functions/        admin-users (gestión de cuentas con la clave secreta, solo en servidor)
e2e/                Pruebas de extremo a extremo
docs/DESIGN.md      Sistema de diseño
```

Decisiones de seguridad principales:

- Las notas internas viven en `private_notes`, separadas de las filas que ven familias y jugadores.
- Objetivos, evaluaciones, controles y logros tienen su propia marca de “compartido”, aplicada por RLS.
- Los resultados se guardan con la RPC `save_match_result` (valida los sets en el servidor y audita cada cambio).
- `portal_match_results` es la única función `SECURITY DEFINER` expuesta: devuelve los partidos del propio jugador con solo el nombre de pila del rival, y comprueba la autorización con `auth.uid()`.
- Fotos de jugadores y galería en buckets privados con URLs firmadas; solo se muestran con autorización.

## Pendiente o por configurar

- **Credenciales de Supabase de producción** y hosting del frontend (ver “Publicar”).
- **Correo saliente:** no hay recuperación de contraseña por email; el entrenador asigna contraseñas nuevas desde Configuración. Para habilitarla hace falta configurar SMTP en Supabase.
- La vista en vivo se actualiza cada 10 s (sin Realtime). Las mesas se asignan automáticamente en la fase de grupos; en la eliminatoria se juega en la mesa que quede libre.
- Modalidad individual (no dobles).
- Los PDF usan Helvetica (legible y universal) en lugar de Archivo.
- El logo aparece en los PDF si es PNG o JPG (react-pdf no admite SVG ni WebP).
- Avisos menores de lint (compatibilidad con React Compiler en formularios), sin efecto funcional.
- Nota solo para este entorno de desarrollo: el runtime local de Edge Functions necesitó el
  certificado del proxy del sandbox (`supabase/functions/.env`, ignorado por git). En producción no aplica.

/* eslint-disable */
// Pruebas de extremo a extremo contra el stack LOCAL (datos ficticios).
// Requisitos: `supabase start`, fixtures cargados y el servidor de Vite en 5173.
// Uso recomendado: npm run test:e2e  (reinicia la base, carga fixtures y levanta Vite)
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5173';
const OUT = path.resolve(__dirname, '../test-results/e2e');
fs.mkdirSync(OUT, { recursive: true });
const ACC = {
  coach: ['entrenador@prueba.local', 'Entrenador123!'],
  player: ['jugador@prueba.local', 'Jugador123!'],
  guardian: ['familia@prueba.local', 'Familia123!'],
};

const results = [];
let browser;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function newPage(viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'es-CR', timezoneId: 'America/Costa_Rica', acceptDownloads: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
  page.setDefaultTimeout(15000);
  return page;
}

async function login(page, who) {
  await page.goto(`${BASE}/login`);
  await page.fill('#email', ACC[who][0]);
  await page.fill('#password', ACC[who][1]);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.waitForLoadState('networkidle');
}

async function logout(page) {
  const btn = page.getByRole('button', { name: 'Cerrar sesión' });
  await btn.or(page.getByRole('button', { name: 'Más' })).filter({ visible: true }).first().waitFor();
  if (await btn.filter({ visible: true }).count()) await btn.filter({ visible: true }).first().click();
  else {
    await page.getByRole('button', { name: 'Más' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).last().click();
  }
  await page.waitForURL(/\/login/);
}

async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  PASA  ${name}`);
  } catch (e) {
    const waiting = (e.message.match(/waiting for (.*)/) ?? [])[1];
    results.push({ name, ok: false, ms: Date.now() - t0, error: e.message.split('\n')[0] + (waiting ? ` (esperando ${waiting})` : '') });
    const slugName = name.normalize('NFD').replace(/[^\w]+/g, '-').slice(0, 60);
    for (const pg of browser.contexts().flatMap((c) => c.pages())) await pg.screenshot({ path: path.join(OUT, `FALLA-${slugName}-${Math.random().toString(36).slice(2, 6)}.png`), fullPage: true }).catch(() => {});
    console.log(`  FALLA ${name}\n        ${results.at(-1).error}`);
  }
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function enterManualResult(page, a, b) {
  // En el marcador: ingresar sets a mano (A gana 2-0 por defecto).
  const manualBtn = page.getByRole('button', { name: 'Ingresar sets a mano' });
  const firstInput = page.getByLabel(/^Set 1, puntos de/).first();
  await manualBtn.or(firstInput).first().waitFor();
  if (await manualBtn.isVisible()) await manualBtn.click();
  const sets = [[a, b], [a, b]];
  for (let i = 0; i < sets.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Agregar set' }).click();
    await page.getByLabel(new RegExp(`^Set ${i + 1}, puntos de`)).nth(0).fill(String(sets[i][0]));
    await page.getByLabel(new RegExp(`^Set ${i + 1}, puntos de`)).nth(1).fill(String(sets[i][1]));
  }
  await page.getByRole('button', { name: /^Guardar (resultado|corrección)$/ }).click();
  await page.waitForURL(/\/torneos\/[0-9a-f-]+$/);
  await page.waitForLoadState('networkidle');
}

async function playAllPending(page, tournamentUrl) {
  for (let guard = 0; guard < 40; guard++) {
    await page.goto(`${tournamentUrl}?tab=vivo`);
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[aria-label*="registrar marcador"]').first();
    if (!(await link.count())) return guard;
    await link.click();
    await page.waitForURL(/marcador/);
    await enterManualResult(page, 11, 6);
  }
  throw new Error('Demasiados partidos pendientes');
}

async function download(page, trigger, file) {
  const [dl] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const p = path.join(OUT, file);
  await dl.saveAs(p);
  return fs.readFileSync(p);
}

async function api(token, pathq, init = {}) {
  const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const res = await fetch(`${status.API_URL}${pathq}`, {
    ...init,
    headers: { apikey: status.PUBLISHABLE_KEY, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null), key: status.PUBLISHABLE_KEY, url: status.API_URL };
}

async function tokenFor(who) {
  const r = await api(null, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: ACC[who][0], password: ACC[who][1] }) });
  return r.body.access_token;
}

(async () => {
  browser = await chromium.launch();
  console.log('E2E contra', BASE);
  const page = await newPage();
  let tournamentUrl = '';

  await test('Roles: sin sesión, las rutas privadas llevan al inicio de sesión', async () => {
    const p = await newPage();
    await p.goto(`${BASE}/jugadores`);
    await p.waitForURL(/\/login/);
    await p.context().close();
  });

  await test('Panel del entrenador con datos reales', async () => {
    await login(page, 'coach');
    await page.getByRole('heading', { name: 'Panel del entrenador' }).waitFor();
    const active = await page.locator('text=jugadores activos').locator('..').locator('.numeral').innerText();
    assert(Number(active) >= 12, `jugadores activos = ${active}`);
    await page.screenshot({ path: path.join(OUT, 'panel.png'), fullPage: true });
  });

  await test('Jugadores: crear, persistir tras cerrar sesión y recargar', async () => {
    await page.goto(`${BASE}/jugadores?nuevo=1`);
    await page.fill('#pf-first', 'PRUEBA Persistencia');
    await page.getByLabel('Categoría', { exact: true }).click();
    await page.getByRole('option', { name: 'Sub-13' }).click();
    await page.getByRole('button', { name: 'Registrar jugador' }).last().click();
    await page.waitForURL(/\/jugadores\/[0-9a-f-]+$/);
    await logout(page);
    await login(page, 'coach');
    await page.goto(`${BASE}/jugadores`);
    await page.reload();
    await page.getByRole('textbox', { name: 'Buscar jugador' }).fill('Persistencia');
    await page.getByRole('link', { name: /PRUEBA Persistencia/ }).first().waitFor();
  });

  await test('Jugadores: cambio de categoría queda en el historial sin borrar registros', async () => {
    await page.getByRole('link', { name: /PRUEBA Persistencia/ }).first().click();
    await page.getByRole('button', { name: 'Editar ficha' }).click();
    await page.getByLabel('Categoría', { exact: true }).click();
    await page.getByRole('option', { name: 'Sub-15' }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByText('Ficha actualizada').waitFor();
    await page.getByRole('tab', { name: 'Historial de cambios' }).click();
    await page.getByText('Sub-13 → Sub-15').waitFor();
  });

  await test('Jugadores: archivar conserva el expediente', async () => {
    await page.getByRole('tab', { name: 'Información general' }).click();
    await page.getByRole('button', { name: 'Archivar expediente' }).click();
    await page.getByRole('button', { name: 'Archivar', exact: true }).click();
    await page.getByText('Expediente archivado').waitFor();
    await page.goto(`${BASE}/jugadores?estado=archived`);
    await page.getByRole('link', { name: /PRUEBA Persistencia/ }).first().waitFor();
  });

  let p01 = '';
  await test('Evaluación compartida, plan con un objetivo compartido y otro privado', async () => {
    await page.goto(`${BASE}/jugadores`);
    await page.getByRole('textbox', { name: 'Buscar jugador' }).fill('PRUEBA 01');
    await page.getByRole('link', { name: /PRUEBA 01 Ficticio/ }).first().click();
    await page.waitForURL(/\/jugadores\/[0-9a-f-]+/);
    p01 = page.url().split('/jugadores/')[1].split('?')[0];
    await page.getByRole('tab', { name: 'Evaluaciones' }).click();
    await page.getByRole('button', { name: 'Nueva evaluación' }).click();
    await page.getByLabel('Derecha').check();
    await page.getByLabel('Puntuación de Derecha').fill('7');
    await page.getByLabel('Revés').check();
    await page.getByLabel('Observación de Revés').fill('Mejorar la empuñadura');
    await page.fill('#ev-c', 'Buen progreso general');
    await page.fill('#ev-p', 'NOTA PRIVADA QUE NO DEBE VERSE');
    await page.getByText('Compartir puntuaciones, observaciones y conclusión').click();
    await page.getByRole('button', { name: 'Guardar evaluación' }).click();
    await page.getByText('Evaluación guardada').waitFor();
    await page.getByRole('tab', { name: 'Plan de desarrollo' }).click();
    await page.getByRole('button', { name: /Crear plan de desarrollo/ }).click();
    await page.getByRole('group', { name: 'Objetivos a corto plazo' }).getByRole('button', { name: 'Agregar' }).click();
    await page.getByRole('textbox', { name: 'Objetivos a corto plazo' }).fill('OBJETIVO COMPARTIDO');
    await page.getByRole('group', { name: 'Objetivos a corto plazo' }).getByRole('button', { name: /pulsa para compartir/ }).click();
    await page.getByRole('group', { name: 'Aspectos por mejorar' }).getByRole('button', { name: 'Agregar' }).click();
    await page.getByRole('textbox', { name: 'Aspectos por mejorar' }).fill('ASPECTO PRIVADO');
    await page.getByRole('button', { name: 'Guardar versión' }).click();
    await page.getByText('Plan guardado como nueva versión').waitFor();
  });

  await test('Torneo: asistente con 8 jugadores ficticios y 2 grupos', async () => {
    await page.goto(`${BASE}/torneos/nuevo`);
    await page.fill('#tw-n', 'PRUEBA Torneo E2E');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Buscar por nombre').fill('PRUEBA 0');
    for (let i = 1; i <= 8; i++) await page.getByRole('checkbox').nth(i - 1).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Sugerencia para 8 inscritos').waitFor();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('heading', { name: 'Grupo A' }).waitFor();
    await page.getByRole('heading', { name: 'Grupo B' }).waitFor();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar y guardar torneo' }).click();
    await page.waitForURL(/\/torneos\/[0-9a-f-]+\?tab=documentos/);
    tournamentUrl = page.url().split('?')[0];
  });

  await test('Torneo: PDF previo generado desde los datos guardados', async () => {
    const buf = await download(page, () => page.getByRole('button', { name: 'Descargar PDF previo' }).click(), 'planilla-previa.pdf');
    assert(buf.subarray(0, 4).toString() === '%PDF', 'no es un PDF');
    assert(buf.length > 3000, `PDF demasiado pequeño (${buf.length} bytes)`);
  });

  await test('Marcador digital en celular: cierra sets y partido automáticamente', async () => {
    const m = await newPage({ width: 390, height: 844 });
    await login(m, 'coach');
    await m.goto(`${tournamentUrl}?tab=vivo`);
    await m.locator('a[aria-label*="registrar marcador"]').first().click();
    await m.waitForURL(/marcador/);
    const plus = m.getByRole('button', { name: /^Sumar un punto a/ });
    for (let s = 0; s < 2; s++) for (let i = 0; i < 11; i++) await plus.first().click();
    await m.getByText(/gana 2-0/).waitFor();
    assert(await noHorizontalOverflow(m), 'desborde horizontal en el marcador');
    await m.screenshot({ path: path.join(OUT, 'marcador-movil.png'), fullPage: true });
    await m.getByRole('button', { name: 'Confirmar resultado' }).click();
    await m.waitForURL(/\/torneos\/[0-9a-f-]+$/);
    await m.context().close();
  });

  await test('Marcador: rechaza un set inválido (11-10)', async () => {
    await page.goto(`${tournamentUrl}?tab=vivo`);
    await page.locator('a[aria-label*="registrar marcador"]').first().click();
    await page.getByRole('button', { name: 'Ingresar sets a mano' }).click();
    await page.getByLabel(/^Set 1, puntos de/).nth(0).fill('11');
    await page.getByLabel(/^Set 1, puntos de/).nth(1).fill('10');
    await page.getByText('Se necesita una diferencia mínima de 2').first().waitFor();
    await page.getByRole('button', { name: 'Guardar resultado' }).click();
    await page.getByText(/diferencia mínima/).first().waitFor();
    assert(page.url().includes('marcador'), 'no debió guardar');
  });

  await test('Torneo: registrar todos los partidos de grupos', async () => {
    const n = await playAllPending(page, tournamentUrl);
    assert(n >= 10, `se registraron ${n} partidos`);
  });

  await test('Torneo: corrección de resultado con motivo queda auditada', async () => {
    await page.goto(`${tournamentUrl}?tab=vivo`);
    await page.locator('a[aria-label*="corregir resultado"]').first().click();
    await page.fill('#sb-r', 'Corrección E2E');
    await page.getByLabel(/^Set 1, puntos de/).nth(0).fill('3');
    await page.getByLabel(/^Set 1, puntos de/).nth(1).fill('11');
    await page.getByLabel(/^Set 2, puntos de/).nth(0).fill('4');
    await page.getByLabel(/^Set 2, puntos de/).nth(1).fill('11');
    await page.getByRole('button', { name: 'Guardar corrección' }).click();
    await page.waitForURL(/\/torneos\/[0-9a-f-]+$/);
    await page.goto(`${tournamentUrl}?tab=auditoria`);
    await page.getByText(/Motivo: Corrección E2E/).waitFor();
  });

  await test('Torneo: clasificaciones, cuadro eliminatorio y avance automático', async () => {
    await page.goto(`${tournamentUrl}?tab=grupos`);
    await page.getByRole('heading', { name: 'Grupo A' }).waitFor();
    await page.waitForLoadState('networkidle');
    const unresolved = await page.getByRole('button', { name: 'Resolver empate' }).count();
    if (unresolved) {
      await page.getByRole('button', { name: 'Resolver empate' }).click();
      await page.fill('#tie-n', 'Sorteo E2E');
      await page.getByRole('button', { name: 'Guardar orden' }).click();
      await page.getByText('Orden del grupo guardado').waitFor();
    }
    await page.getByRole('button', { name: 'Cerrar grupos y generar eliminatoria' }).click();
    await page.getByText(/Cuadro eliminatorio generado/).waitFor();
    await page.getByRole('heading', { name: 'Semifinal' }).waitFor();
    await playAllPending(page, tournamentUrl);
    await page.goto(`${tournamentUrl}?tab=eliminatoria`);
    await page.getByRole('heading', { name: 'Final', exact: true }).waitFor();
    await page.getByText(/^Campeón: /).waitFor();
  });

  await test('Torneo: cierre integra posición y medallas en el expediente', async () => {
    await page.goto(tournamentUrl);
    await page.getByRole('button', { name: 'Cerrar torneo e integrar en expedientes' }).click();
    await page.getByRole('button', { name: 'Cerrar torneo', exact: true }).click();
    await page.getByText(/Torneo cerrado/).waitFor();
    const buf = await download(page, () => page.getByRole('button', { name: 'PDF de resultados' }).click(), 'resultados.pdf');
    assert(buf.subarray(0, 4).toString() === '%PDF', 'el PDF final no es válido');
    await page.goto(`${BASE}/estadisticas`);
    await page.getByText('PRUEBA Torneo E2E').first().waitFor();
  });

  await test('Asistencia en celular: marcar y conservar al recargar', async () => {
    const m = await newPage({ width: 390, height: 844 });
    await login(m, 'coach');
    await m.goto(`${BASE}/horarios`);
    await m.getByRole('button', { name: 'Crear grupo' }).first().click();
    await m.fill('#gr-n', 'PRUEBA Grupo E2E');
    await m.getByRole('button', { name: 'Agregar día' }).click();
    const wd = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' })).getDay()];
    await m.getByLabel('Día').click();
    await m.getByRole('option', { name: wd }).click();
    await m.getByRole('button', { name: 'Crear grupo' }).last().click();
    await m.getByText('Grupo creado').waitFor();
    await m.getByRole('button', { name: 'Agregar', exact: true }).last().click();
    for (const n of ['PRUEBA 01', 'PRUEBA 02', 'PRUEBA 03']) await m.getByRole('dialog').getByText(new RegExp(`^${n} Ficticio$`)).click();
    await m.getByRole('button', { name: /^Agregar \d/ }).click();
    await m.goto(`${BASE}/asistencia`);
    await m.getByLabel('Grupo').click();
    await m.getByRole('option', { name: 'PRUEBA Grupo E2E' }).click();
    await m.getByRole('radiogroup', { name: /PRUEBA 01/ }).getByRole('radio', { name: 'Presente' }).click();
    await m.getByRole('radiogroup', { name: /PRUEBA 02/ }).getByRole('radio', { name: 'Ausente' }).click();
    await m.getByRole('radiogroup', { name: /PRUEBA 03/ }).getByRole('radio', { name: 'Justificado' }).click();
    await m.waitForLoadState('networkidle');
    assert(await noHorizontalOverflow(m), 'desborde horizontal en asistencia');
    await m.screenshot({ path: path.join(OUT, 'asistencia-movil.png'), fullPage: true });
    await m.reload();
    await m.getByLabel('Grupo').click();
    await m.getByRole('option', { name: 'PRUEBA Grupo E2E' }).click();
    const checked = await m.getByRole('radiogroup', { name: /PRUEBA 02/ }).getByRole('radio', { name: 'Ausente' }).getAttribute('aria-checked');
    assert(checked === 'true', 'la asistencia no persistió');
    await m.context().close();
  });

  await test('Comunicados: publicar solo para jugadores', async () => {
    await page.goto(`${BASE}/comunicados?nuevo=1`);
    await page.fill('#an-t', 'PRUEBA Aviso para jugadores');
    await page.fill('#an-b', 'Contenido de prueba');
    await page.getByText('Padres y encargados', { exact: true }).click();
    await page.getByRole('button', { name: 'Publicar' }).last().click();
    await page.getByText('Comunicado publicado').waitFor();
  });

  await test('Exportación CSV del listado de jugadores', async () => {
    await page.goto(`${BASE}/informes`);
    const buf = await download(page, () => page.getByRole('button', { name: 'CSV' }).first().click(), 'jugadores.csv');
    const txt = buf.toString('utf8');
    assert(txt.includes('Nicolás') && txt.includes('Gonzalo'), 'faltan jugadores reales en el CSV');
  });

  await test('Portal del jugador: solo su expediente y lo compartido', async () => {
    const j = await newPage({ width: 390, height: 844 });
    await login(j, 'player');
    await j.waitForURL(/\/portal\/jugador\//);
    await j.getByRole('heading', { name: 'PRUEBA 01 Ficticio' }).waitFor();
    await j.getByRole('tab', { name: 'Evaluaciones' }).click();
    await j.getByText('Buen progreso general').waitFor();
    assert(!(await j.getByText('NOTA PRIVADA QUE NO DEBE VERSE').count()), 'se ve la nota privada');
    await j.getByRole('tab', { name: 'Objetivos' }).click();
    await j.getByText('OBJETIVO COMPARTIDO').first().waitFor();
    assert(!(await j.getByText('ASPECTO PRIVADO').count()), 'se ve un aspecto no compartido');
    await j.goto(`${BASE}/jugadores`);
    await j.waitForURL(/\/portal/);
    await j.goto(`${BASE}/portal/comunicados`);
    await j.getByText('PRUEBA Aviso para jugadores').waitFor();
    assert(await noHorizontalOverflow(j), 'desborde horizontal en el portal');
    await j.screenshot({ path: path.join(OUT, 'portal-jugador.png'), fullPage: true });
    await j.context().close();
  });

  await test('Portal familiar: solo hijos vinculados y autorizados', async () => {
    const g = await newPage({ width: 820, height: 1180 });
    await login(g, 'guardian');
    await g.getByText('Tus jugadores').waitFor();
    const names = await g.locator('section[aria-label="Jugadores vinculados"] [data-player-name]').allInnerTexts();
    assert(names.length === 2 && names.includes('PRUEBA 01 Ficticio') && names.includes('PRUEBA 02 Ficticio'), `ve: ${names.join(', ')}`);
    await g.goto(`${BASE}/portal/comunicados`);
    await g.waitForLoadState('networkidle');
    assert(!(await g.getByText('PRUEBA Aviso para jugadores').count()), 've un comunicado dirigido solo a jugadores');
    await g.screenshot({ path: path.join(OUT, 'portal-familia-tablet.png'), fullPage: true });
    await g.context().close();
  });

  await test('Seguridad: RLS bloquea accesos no autorizados por la API', async () => {
    const tg = await tokenFor('guardian');
    const ta = await tokenFor('coach');
    const target = await api(ta, '/rest/v1/players?select=id&first_name=eq.PRUEBA%2001');
    p01 = target.body[0].id;
    const list = await api(tg, '/rest/v1/players?select=first_name');
    assert(list.body.length === 2, `encargado ve ${list.body.length} expedientes`);
    const notes = await api(tg, '/rest/v1/private_notes?select=body');
    assert(Array.isArray(notes.body) && notes.body.length === 0, 'encargado ve notas internas');
    const upd = await api(tg, `/rest/v1/players?id=eq.${p01}`, { method: 'PATCH', body: JSON.stringify({ first_name: 'hack' }), headers: { prefer: 'return=representation' } });
    assert(Array.isArray(upd.body) && upd.body.length === 0, 'el encargado pudo editar');
    const tp = await tokenFor('player');
    const fn = await fetch(`${list.url}/functions/v1/admin-users`, { method: 'POST', headers: { apikey: list.key, authorization: `Bearer ${tp}`, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'list' }) });
    assert(fn.status === 403, `jugador obtuvo ${fn.status} al gestionar cuentas`);
    const anon = await api(null, '/rest/v1/players?select=first_name');
    assert(anon.status === 401 || anon.status === 403 || (Array.isArray(anon.body) && anon.body.length === 0), 'anónimo leyó expedientes');
  });

  await test('Responsive: sin desborde horizontal en celular, tablet y computadora', async () => {
    for (const [w, h] of [[390, 844], [820, 1180], [1366, 900]]) {
      const r = await newPage({ width: w, height: h });
      await login(r, 'coach');
      for (const route of ['/', '/jugadores', '/torneos', tournamentUrl.replace(BASE, '') + '?tab=grupos', '/asistencia', '/configuracion']) {
        await r.goto(BASE + route);
        await r.waitForLoadState('networkidle');
        assert(await noHorizontalOverflow(r), `desborde en ${route} a ${w}px`);
      }
      await r.goto(BASE + '/');
      await r.waitForLoadState('networkidle');
      await r.screenshot({ path: path.join(OUT, `panel-${w}.png`), fullPage: true });
      await r.context().close();
    }
  });

  await test('Sin errores de JavaScript en la sesión del entrenador', async () => {
    assert(page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'resultados.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length} pasan, ${failed.length} fallan`);
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await browser?.close();
  process.exit(1);
});

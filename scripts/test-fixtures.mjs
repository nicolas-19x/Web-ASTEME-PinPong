#!/usr/bin/env node
// Datos FICTICIOS para el entorno de pruebas LOCAL. Nunca se ejecuta contra producción:
// se niega si la URL no es 127.0.0.1/localhost. Se eliminan con `npm run db:reset`.
//
//   node scripts/test-fixtures.mjs [cantidadDeJugadores=16]
import { createClient } from '@supabase/supabase-js';

import { execSync } from 'node:child_process';

// Lee URL y clave del stack local (`supabase status`), sin guardarlas en el repositorio.
function localStatus() {
  try {
    const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return Object.fromEntries(out.split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }));
  } catch {
    return {};
  }
}
const st = process.env.SUPABASE_SECRET_KEY ? {} : localStatus();
const url = process.env.SUPABASE_URL ?? st.API_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SECRET_KEY ?? st.SECRET_KEY;
if (!key) {
  console.error('No se encontró la clave del stack local. ¿Está corriendo `supabase start`?');
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  console.error('Este script solo se ejecuta contra el stack local de Supabase.');
  process.exit(1);
}
const n = Number(process.argv[2] ?? 16);
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export const ACCOUNTS = {
  coach: { email: 'entrenador@prueba.local', password: 'Entrenador123!', name: 'Entrenador (prueba local)', role: 'admin' },
  player: { email: 'jugador@prueba.local', password: 'Jugador123!', name: 'PRUEBA Jugador con cuenta', role: 'player' },
  guardian: { email: 'familia@prueba.local', password: 'Familia123!', name: 'PRUEBA Encargado', role: 'guardian' },
};

async function ensureUser(a) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === a.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email: a.email, password: a.password, email_confirm: true, app_metadata: { role: a.role } });
    if (error) throw error;
    user = data.user;
  }
  await admin.from('profiles').upsert({ id: user.id, full_name: a.name, role: a.role, active: true });
  return user.id;
}

const cats = Object.fromEntries((await admin.from('categories').select('id, name')).data.map((c) => [c.name, c.id]));
const levels = (await admin.from('levels').select('id, name')).data;

await ensureUser(ACCOUNTS.coach);
const playerUid = await ensureUser(ACCOUNTS.player);
const guardianUid = await ensureUser(ACCOUNTS.guardian);

const existing = (await admin.from('players').select('id, first_name').like('first_name', 'PRUEBA%')).data;
let fake = existing;
if (!existing.length) {
  const rows = Array.from({ length: n }, (_, i) => ({
    first_name: `PRUEBA ${String(i + 1).padStart(2, '0')}`,
    last_names: 'Ficticio',
    category_id: i % 2 ? cats['Sub-13'] : cats['Sub-15'],
    level_id: levels[i % levels.length].id,
    age_reported: 11 + (i % 5),
    age_reported_on: new Date().toISOString().slice(0, 10),
    // Rankings ficticios con empates y huecos (algunos sin ranking).
    ranking_points: i % 5 === 4 ? null : 1000 - Math.floor(i / 2) * 50,
    dominant_hand: i % 3 ? 'right' : 'left',
  }));
  fake = (await admin.from('players').insert(rows).select('id, first_name')).data;
}
// Cuenta de jugador → PRUEBA 01; encargado → PRUEBA 01 y PRUEBA 02 (autorizados) y PRUEBA 03 (no autorizado).
const byName = Object.fromEntries(fake.map((p) => [p.first_name, p.id]));
await admin.from('players').update({ user_id: playerUid }).eq('id', byName['PRUEBA 01']);
let { data: g } = await admin.from('guardians').select('id').eq('profile_id', guardianUid).maybeSingle();
if (!g) g = (await admin.from('guardians').insert({ profile_id: guardianUid, full_name: ACCOUNTS.guardian.name }).select('id').single()).data;
await admin.from('player_guardians').upsert(
  [
    { player_id: byName['PRUEBA 01'], guardian_id: g.id, authorized: true },
    { player_id: byName['PRUEBA 02'], guardian_id: g.id, authorized: true },
    { player_id: byName['PRUEBA 03'], guardian_id: g.id, authorized: false },
  ],
  { onConflict: 'player_id,guardian_id' },
);
console.log(`Fixtures listos: ${fake.length} jugadores ficticios y cuentas de prueba.`);
console.log(Object.values(ACCOUNTS).map((a) => `  ${a.role}: ${a.email} / ${a.password}`).join('\n'));

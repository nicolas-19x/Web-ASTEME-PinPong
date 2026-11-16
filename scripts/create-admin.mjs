#!/usr/bin/env node
// Crea la cuenta del entrenador/administrador inicial.
// Ejecutar UNA vez desde una máquina de confianza; la clave secreta nunca va al frontend.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_... \
//   node scripts/create-admin.mjs entrenador@correo.com "Contraseña segura" "Nombre del entrenador"
import { createClient } from '@supabase/supabase-js';

const [email, password, fullName] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || !email || !password || !fullName) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/create-admin.mjs <correo> <contraseña> "<nombre>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: 'admin' },
  user_metadata: { full_name: fullName },
});
if (error) {
  console.error('No se pudo crear el usuario:', error.message);
  process.exit(1);
}
const { error: pErr } = await admin.from('profiles').insert({ id: data.user.id, full_name: fullName, role: 'admin' });
if (pErr) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error('No se pudo crear el perfil:', pErr.message);
  process.exit(1);
}
console.log(`Administrador creado: ${email}`);

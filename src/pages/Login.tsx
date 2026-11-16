import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Field } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { clearSupabaseConfig, saveSupabaseConfig, supabaseConfigEditable, supabaseConfigured } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { session, role, profile, signIn, loading } = useAuth();
  const { settings, logoUrl } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) return <ConnectSupabase />;
  if (!loading && session && role) return <Navigate to={role === 'admin' ? '/' : '/portal'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const name = settings?.name ?? 'Academia de Tenis de Mesa';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Mesa vista desde arriba: azul mesa con línea central y red */}
      <div className="table-band relative hidden overflow-hidden lg:block" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-white/85" />
        <div className="absolute inset-6 rounded-sm border-[3px] border-white/85" />
        <div className="absolute right-[18%] bottom-[22%] size-16 rounded-full bg-ball shadow-[0_12px_30px_rgb(0_0_0/0.35)]" />
        <div className="absolute bottom-10 left-10 max-w-[22ch]">
          <p className="condensed text-[3.1rem] leading-[0.95] font-extrabold">{name}</p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-12 rounded-lg bg-white object-contain p-1" />
            ) : (
              <span className="size-12 rounded-full bg-ball" aria-hidden />
            )}
            <p className="condensed text-[1.35rem] leading-tight font-bold lg:hidden">{name}</p>
          </div>
          <h1 className="text-[2.2rem]">Iniciar sesión</h1>
          <p className="mt-1.5 text-muted-foreground">Usa la cuenta que te entregó el entrenador.</p>

          {session && !loading && !role && (
            <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              {profile && !profile.active
                ? 'Tu cuenta está desactivada. Habla con el entrenador.'
                : 'Tu cuenta no tiene un perfil asignado. Pide al entrenador que la configure.'}
            </p>
          )}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            <Field label="Correo" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Contraseña" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy} className="mt-2">
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Entrar
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">¿Olvidaste tu contraseña? El entrenador puede asignarte una nueva.</p>
          {supabaseConfigEditable && (
            <button
              type="button"
              className="mt-2 text-sm text-muted-foreground underline underline-offset-4"
              onClick={() => {
                clearSupabaseConfig();
                window.location.reload();
              }}
            >
              Cambiar la conexión con Supabase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Primera vez: pide la URL y la clave publicable del proyecto de Supabase y las guarda en este navegador. */
function ConnectSupabase() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = url.trim().replace(/\/+$/, '');
    const k = key.trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)) return setError('La URL debe verse así: https://abcd1234.supabase.co');
    if (/^sb_secret_/.test(k)) return setError('Esa es la clave SECRETA: no la uses aquí. Pega la Publishable key (sb_publishable_...).');
    if (!/^(sb_publishable_|eyJ)/.test(k)) return setError('Pega la Publishable key: empieza con sb_publishable_');
    setBusy(true);
    try {
      const res = await fetch(`${u}/rest/v1/academy_settings?select=name`, { headers: { apikey: k } });
      if (!res.ok) throw new Error(res.status === 401 ? 'La clave no corresponde a ese proyecto.' : `Supabase respondió ${res.status}. ¿Ejecutaste los archivos SQL?`);
      saveSupabaseConfig({ url: u, key: k });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'No se pudo conectar. Revisa la URL.');
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md">
        <span className="mb-6 block size-12 rounded-full bg-ball" aria-hidden />
        <h1 className="text-[2.1rem]">Conectar con Supabase</h1>
        <p className="mt-1.5 text-muted-foreground">
          Solo la primera vez. Encuentra estos datos en tu proyecto de Supabase, en Project Settings. Se guardan en este navegador.
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          <Field label="Project URL" htmlFor="sb-url" hint="En Project Settings → Data API">
            <Input id="sb-url" placeholder="https://abcd1234.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Publishable key" htmlFor="sb-key" hint="En Project Settings → API Keys. Nunca la secret key.">
            <Input id="sb-key" placeholder="sb_publishable_..." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Conectar
          </Button>
        </form>
      </div>
    </div>
  );
}

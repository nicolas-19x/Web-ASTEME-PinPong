import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Field } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { session, role, profile, signIn, loading } = useAuth();
  const { settings, logoUrl } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

          {!supabaseConfigured && (
            <p role="alert" className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
              Falta configurar Supabase: crea <code>.env.local</code> con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
            </p>
          )}
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
        </div>
      </div>
    </div>
  );
}

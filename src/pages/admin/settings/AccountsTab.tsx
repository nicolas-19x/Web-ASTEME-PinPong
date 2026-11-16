import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Link2, Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Chip, EmptyState, ErrorState, Field, Loading, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { fullName } from '@/lib/format';
import { usePlayers } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';

interface Account {
  id: string;
  full_name: string;
  role: 'admin' | 'player' | 'guardian';
  active: boolean;
  email: string | null;
  player: { id: string; first_name: string; last_names: string | null } | null;
  guardian: { id: string; player_guardians: { player_id: string; authorized: boolean; players: { first_name: string; last_names: string | null } | null }[] } | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = ((await ctx.json()) as { error?: string }).error ?? msg;
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(msg);
  }
  return data as T;
}

const ROLE: Record<string, string> = { admin: 'Entrenador / administrador', player: 'Jugador', guardian: 'Padre o encargado' };

export function AccountsTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [create, setCreate] = useState(false);
  const [pwd, setPwd] = useState<Account | null>(null);
  const [link, setLink] = useState<Account | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['accounts'], queryFn: () => call<{ accounts: Account[] }>({ action: 'list' }) });
  const setActive = useMutation({
    mutationFn: (v: { user_id: string; active: boolean }) => call({ action: 'set_active', ...v }),
    onSuccess: (_, v) => {
      toast.success(v.active ? 'Cuenta activada' : 'Cuenta desactivada: ya no puede ingresar');
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleLink = useMutation({
    mutationFn: async (v: { guardian_id: string; player_id: string; authorized?: boolean; remove?: boolean }) => {
      const q = supabase.from('player_guardians');
      if (v.remove) unwrap(await q.delete().eq('guardian_id', v.guardian_id).eq('player_id', v.player_id));
      else unwrap(await q.update({ authorized: v.authorized }).eq('guardian_id', v.guardian_id).eq('player_id', v.player_id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['accounts'] }),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  const accounts = data?.accounts ?? [];
  const groups: [string, Account[]][] = [
    ['Entrenadores', accounts.filter((a) => a.role === 'admin')],
    ['Padres y encargados', accounts.filter((a) => a.role === 'guardian')],
    ['Jugadores', accounts.filter((a) => a.role === 'player')],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          No hay registro público: tú creas cada cuenta. Un encargado solo ve a los jugadores vinculados y autorizados; un jugador solo ve su propio expediente.
        </p>
        <Button onClick={() => setCreate(true)}>
          <UserPlus /> Crear cuenta
        </Button>
      </div>
      {groups.map(([title, list]) => (
        <Panel key={title} title={`${title} (${list.length})`} bodyClassName="p-0 sm:p-0">
          {list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin cuentas.</p>
          ) : (
            <ul className="divide-y">
              {list.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 p-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{a.full_name}</span>
                      <span className="text-sm text-muted-foreground">{a.email}</span>
                    </span>
                    {!a.active && <Chip tone="warning">Desactivada</Chip>}
                    {a.player && <Chip tone="info">Expediente: {fullName(a.player)}</Chip>}
                    <Button size="sm" variant="outline" onClick={() => setPwd(a)}>
                      <KeyRound /> Contraseña
                    </Button>
                    {a.id !== profile?.id && (
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={a.active} onCheckedChange={(c) => setActive.mutate({ user_id: a.id, active: c })} aria-label={`Cuenta de ${a.full_name} activa`} /> Activa
                      </label>
                    )}
                  </div>
                  {a.role === 'guardian' && a.guardian && (
                    <div className="rounded-lg bg-muted/60 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">Jugadores vinculados</p>
                        <Button size="sm" variant="outline" onClick={() => setLink(a)}>
                          <Link2 /> Vincular
                        </Button>
                      </div>
                      {a.guardian.player_guardians.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin vínculos: esta cuenta no ve ningún expediente.</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {a.guardian.player_guardians.map((pg) => (
                            <li key={pg.player_id} className="flex min-h-10 items-center gap-3 text-sm">
                              <span className="flex-1">{pg.players ? fullName(pg.players) : '—'}</span>
                              <label className="flex items-center gap-2">
                                <Switch checked={pg.authorized} onCheckedChange={(c) => toggleLink.mutate({ guardian_id: a.guardian!.id, player_id: pg.player_id, authorized: c })} aria-label="Vínculo autorizado" />
                                {pg.authorized ? 'Autorizado' : 'Sin autorización'}
                              </label>
                              <Button size="icon-sm" variant="ghost" aria-label="Quitar vínculo" onClick={() => toggleLink.mutate({ guardian_id: a.guardian!.id, player_id: pg.player_id, remove: true })}>
                                <Trash2 />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ))}
      {accounts.length === 0 && <EmptyState title="Sin cuentas" />}
      {create && <CreateAccount onClose={() => setCreate(false)} accounts={accounts} />}
      {pwd && <PasswordDialog account={pwd} onClose={() => setPwd(null)} />}
      {link && <LinkDialog account={link} onClose={() => setLink(null)} />}
    </div>
  );
}

function CreateAccount({ onClose, accounts }: { onClose: () => void; accounts: Account[] }) {
  const qc = useQueryClient();
  const { data: players = [] } = usePlayers();
  const [f, setF] = useState({ role: 'guardian', email: '', password: '', full_name: '', player_id: '', phone: '' });
  const [links, setLinks] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const withAccount = new Set(accounts.map((a) => a.player?.id).filter(Boolean));
  const free = players.filter((p) => p.status !== 'archived' && !withAccount.has(p.id) && !p.user_id);
  const save = useMutation({
    mutationFn: () => call({ action: 'create', ...f, player_id: f.role === 'player' ? f.player_id : undefined, player_ids: f.role === 'guardian' ? links : undefined }),
    onSuccess: () => {
      toast.success('Cuenta creada. Entrega el correo y la contraseña a la persona.');
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['players'] });
      onClose();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear cuenta</DialogTitle>
          <DialogDescription>La persona entra con este correo y contraseña. Puede pedirte una nueva cuando quiera.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Tipo de cuenta">
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
              <SelectTrigger className="w-full" aria-label="Tipo de cuenta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nombre completo" htmlFor="ac-n" required>
            <Input id="ac-n" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Correo" htmlFor="ac-e" required>
            <Input id="ac-e" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Contraseña inicial" htmlFor="ac-p" required hint="Mínimo 8 caracteres.">
            <Input id="ac-p" type="text" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
          {f.role === 'player' && (
            <Field label="Expediente del jugador" required hint="Solo aparecen expedientes sin cuenta.">
              <Select value={f.player_id} onValueChange={(v) => setF({ ...f, player_id: v })}>
                <SelectTrigger className="w-full" aria-label="Expediente">
                  <SelectValue placeholder="Elige" />
                </SelectTrigger>
                <SelectContent>
                  {free.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {fullName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {f.role === 'guardian' && (
            <>
              <Field label="Teléfono" htmlFor="ac-t">
                <Input id="ac-t" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Hijos o jugadores a cargo</legend>
                <ul className="flex max-h-56 flex-col overflow-y-auto rounded-lg border p-2">
                  {players
                    .filter((p) => p.status !== 'archived')
                    .map((p) => (
                      <li key={p.id}>
                        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                          <Checkbox checked={links.includes(p.id)} onCheckedChange={() => setLinks((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} className="size-5" />
                          {fullName(p)}
                        </label>
                      </li>
                    ))}
                </ul>
              </fieldset>
            </>
          )}
          {err && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              setErr(null);
              if (!f.full_name.trim()) return setErr('Escribe el nombre.');
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr('Escribe un correo válido.');
              if (f.password.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.');
              if (f.role === 'player' && !f.player_id) return setErr('Elige el expediente del jugador.');
              save.mutate();
            }}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Crear cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [p, setP] = useState('');
  const save = useMutation({
    mutationFn: () => call({ action: 'reset_password', user_id: account.id, password: p }),
    onSuccess: () => {
      toast.success('Contraseña actualizada');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva contraseña para {account.full_name}</DialogTitle>
          <DialogDescription>Entrégasela en persona o por un medio privado.</DialogDescription>
        </DialogHeader>
        <Field label="Contraseña" htmlFor="pw-n" hint="Mínimo 8 caracteres.">
          <Input id="pw-n" type="text" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={p.length < 8 || save.isPending} onClick={() => save.mutate()}>
            Guardar contraseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: players = [] } = usePlayers();
  const linked = new Set(account.guardian?.player_guardians.map((p) => p.player_id));
  const [sel, setSel] = useState<string[]>([]);
  const [rel, setRel] = useState('');
  const save = useMutation({
    mutationFn: async () =>
      unwrap(await supabase.from('player_guardians').insert(sel.map((player_id) => ({ player_id, guardian_id: account.guardian!.id, relationship: rel.trim() || null, authorized: true })))),
    onSuccess: () => {
      toast.success('Vínculos guardados');
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular a {account.full_name}</DialogTitle>
          <DialogDescription>Podrá consultar únicamente los expedientes que vincules y autorices.</DialogDescription>
        </DialogHeader>
        <Field label="Parentesco" htmlFor="lk-r" hint="Opcional, por ejemplo madre, padre o tutor.">
          <Input id="lk-r" value={rel} onChange={(e) => setRel(e.target.value)} />
        </Field>
        <ul className="flex flex-col divide-y">
          {players
            .filter((p) => !linked.has(p.id) && p.status !== 'archived')
            .map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Checkbox checked={sel.includes(p.id)} onCheckedChange={() => setSel((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} className="size-5" />
                  {fullName(p)}
                </label>
              </li>
            ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!sel.length || save.isPending} onClick={() => save.mutate()}>
            Vincular {sel.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

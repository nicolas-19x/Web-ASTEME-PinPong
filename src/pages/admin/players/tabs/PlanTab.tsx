import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Chip, EmptyState, ErrorState, Field, Loading, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, todayISO } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';

export const GOAL_KINDS = [
  ['short_term', 'Objetivos a corto plazo'],
  ['medium_term', 'Objetivos a mediano plazo'],
  ['strength', 'Fortalezas'],
  ['improvement', 'Aspectos por mejorar'],
  ['competitive_goal', 'Metas competitivas'],
] as const;
type GoalKind = (typeof GOAL_KINDS)[number][0];
const GOAL_STATUS: Record<string, string> = { pending: 'Pendiente', in_progress: 'En progreso', achieved: 'Logrado', dropped: 'Descartado' };
const isObjective = (k: string) => k === 'short_term' || k === 'medium_term' || k === 'competitive_goal';

export function usePlans(playerId: string) {
  return useQuery({
    queryKey: ['plans', playerId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('development_plans')
          .select('*, development_goals(*)')
          .eq('player_id', playerId)
          .order('version', { ascending: false }),
      ),
  });
}

function GoalList({ goals, admin }: { goals: { id: string; kind: string; description: string; status: string; shared: boolean; sort_order: number }[]; admin: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {GOAL_KINDS.map(([k, label]) => {
        const gs = goals.filter((g) => g.kind === k).sort((a, b) => a.sort_order - b.sort_order);
        if (!gs.length) return null;
        return (
          <div key={k}>
            <h3 className="mb-2 text-[1.1rem]">{label}</h3>
            <ul className="flex flex-col gap-2">
              {gs.map((g) => (
                <li key={g.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                  <span className="flex-1">{g.description}</span>
                  {isObjective(g.kind) && <Chip tone={g.status === 'achieved' ? 'success' : g.status === 'in_progress' ? 'info' : 'neutral'}>{GOAL_STATUS[g.status]}</Chip>}
                  {admin && (g.shared ? <Eye className="mt-1 size-4 text-success" aria-label="Compartido" /> : <EyeOff className="mt-1 size-4 text-muted-foreground" aria-label="No compartido" />)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function PlanTab({ playerId, admin = true }: { playerId: string; admin?: boolean }) {
  const { data, isLoading, error, refetch } = usePlans(playerId);
  const [open, setOpen] = useState(false);
  const notes = useQuery({
    queryKey: ['plan-notes', playerId],
    enabled: admin,
    queryFn: async () => unwrap(await supabase.from('private_notes').select('*').eq('player_id', playerId).eq('entity_type', 'plan')),
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  const plans = data ?? [];
  const current = plans.find((p) => p.is_current);
  const visibleGoals = current?.development_goals ?? [];

  return (
    <div className="flex flex-col gap-6">
      {admin && (
        <Button className="self-start" onClick={() => setOpen(true)}>
          <Plus /> {current ? 'Actualizar plan (nueva versión)' : 'Crear plan de desarrollo'}
        </Button>
      )}
      {!current || (!admin && visibleGoals.length === 0) ? (
        <EmptyState title={admin ? 'Sin plan de desarrollo' : 'Sin objetivos publicados'}>
          {admin
            ? 'Define objetivos, fortalezas, aspectos por mejorar y metas competitivas. Tú decides qué se comparte.'
            : 'Cuando el entrenador publique objetivos aparecerán aquí.'}
        </EmptyState>
      ) : (
        <Panel
          title={`Plan vigente${admin ? `, versión ${current.version}` : ''}`}
          action={current.review_date && <span className="text-sm text-muted-foreground">Revisión: {fmtDate(current.review_date)}</span>}
        >
          <GoalList goals={visibleGoals} admin={admin} />
          {admin && notes.data?.find((n) => n.entity_id === current.id) && (
            <p className="mt-4 flex gap-2 rounded-lg bg-muted p-3 text-sm">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-label="Nota privada" />
              {notes.data.find((n) => n.entity_id === current.id)!.body}
            </p>
          )}
        </Panel>
      )}
      {admin && plans.length > 1 && (
        <Panel title="Versiones anteriores">
          <ol className="flex flex-col gap-3">
            {plans
              .filter((p) => !p.is_current)
              .map((p) => (
                <li key={p.id}>
                  <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer font-semibold">
                      Versión {p.version}, {fmtDateTime(p.created_at)}
                    </summary>
                    <div className="mt-3">
                      <GoalList goals={p.development_goals} admin />
                    </div>
                  </details>
                </li>
              ))}
          </ol>
        </Panel>
      )}
      {admin && <PlanDialog open={open} onOpenChange={setOpen} playerId={playerId} current={current ?? null} />}
    </div>
  );
}

interface DraftGoal {
  kind: GoalKind;
  description: string;
  status: string;
  shared: boolean;
}

function PlanDialog({
  open,
  onOpenChange,
  playerId,
  current,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  playerId: string;
  current: { review_date: string | null; development_goals: { kind: string; description: string; status: string; shared: boolean }[] } | null;
}) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [goals, setGoals] = useState<DraftGoal[]>([]);
  const [review, setReview] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  if (open && !initialized) {
    setGoals(current?.development_goals.map((g) => ({ kind: g.kind as GoalKind, description: g.description, status: g.status, shared: g.shared })) ?? []);
    setReview(current?.review_date ?? '');
    setInitialized(true);
  }
  if (!open && initialized) setInitialized(false);

  const save = useMutation({
    mutationFn: async () => {
      const plan = unwrap(await supabase.from('development_plans').insert({ player_id: playerId, version: 0, review_date: review || null }).select('id').single());
      const rows = goals
        .filter((g) => g.description.trim())
        .map((g, i) => ({ plan_id: plan.id, player_id: playerId, kind: g.kind, description: g.description.trim(), status: g.status, shared: g.shared, sort_order: i }));
      if (rows.length) unwrap(await supabase.from('development_goals').insert(rows));
      if (note.trim()) unwrap(await supabase.from('private_notes').insert({ player_id: playerId, entity_type: 'plan', entity_id: plan.id, body: note.trim(), created_by: profile?.id }));
    },
    onSuccess: () => {
      toast.success('Plan guardado como nueva versión');
      setNote('');
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ['plans', playerId] });
      void qc.invalidateQueries({ queryKey: ['plan-notes', playerId] });
    },
    onError: (e) => setErr(e.message),
  });

  const set = (i: number, patch: Partial<DraftGoal>) => setGoals((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{current ? 'Actualizar plan de desarrollo' : 'Crear plan de desarrollo'}</DialogTitle>
          <DialogDescription>Al guardar se crea una versión nueva; la anterior queda en el historial. El ojo indica si cada punto se comparte.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {GOAL_KINDS.map(([k, label]) => (
            <fieldset key={k} className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">{label}</legend>
              {goals.map((g, i) =>
                g.kind !== k ? null : (
                  <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Input value={g.description} onChange={(e) => set(i, { description: e.target.value })} aria-label={label} className="min-w-0 flex-1" />
                    {isObjective(k) && (
                      <Select value={g.status} onValueChange={(v) => set(i, { status: v })}>
                        <SelectTrigger className="w-36" aria-label="Estado del objetivo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(GOAL_STATUS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      variant={g.shared ? 'secondary' : 'ghost'}
                      size="icon"
                      aria-pressed={g.shared}
                      aria-label={g.shared ? 'Compartido; pulsa para hacerlo privado' : 'Privado; pulsa para compartir'}
                      onClick={() => set(i, { shared: !g.shared })}
                    >
                      {g.shared ? <Eye className="text-success" /> : <EyeOff />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Quitar" onClick={() => setGoals((x) => x.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                ),
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setGoals((x) => [...x, { kind: k, description: '', status: 'pending', shared: false }])}
              >
                <Plus /> Agregar
              </Button>
            </fieldset>
          ))}
          <Field label="Fecha de revisión" htmlFor="pl-r" className="max-w-56">
            <Input id="pl-r" type="date" min={todayISO()} value={review} onChange={(e) => setReview(e.target.value)} />
          </Field>
          <Field label="Notas del entrenador" htmlFor="pl-n" hint="Privadas: nunca se comparten.">
            <Textarea id="pl-n" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {err && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              setErr(null);
              if (!goals.some((g) => g.description.trim())) return setErr('Agrega al menos un punto al plan.');
              save.mutate();
            }}
          >
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Guardar versión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

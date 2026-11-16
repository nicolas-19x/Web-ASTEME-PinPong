import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Chip, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { fmtDate, todayISO } from '@/lib/format';
import { useSkills } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-table" style={{ width: `${score * 10}%` }} />
      </span>
      <span className="numeral w-8 text-[1.1rem]">{score}</span>
    </span>
  );
}

export function useEvaluations(playerId: string) {
  return useQuery({
    queryKey: ['evaluations', playerId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('evaluations')
          .select('*, evaluation_items(*)')
          .eq('player_id', playerId)
          .order('evaluated_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  });
}

export function EvaluationsTab({ playerId, admin = true }: { playerId: string; admin?: boolean }) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useEvaluations(playerId);
  const notes = useQuery({
    queryKey: ['eval-notes', playerId],
    enabled: admin,
    queryFn: async () => unwrap(await supabase.from('private_notes').select('*').eq('player_id', playerId).eq('entity_type', 'evaluation')),
  });

  useEffect(() => {
    if (admin && params.get('nueva') === '1') {
      setOpen(true);
      const next = new URLSearchParams(params);
      next.delete('nueva');
      setParams(next, { replace: true });
    }
  }, [admin, params, setParams]);

  const toggleShare = useMutation({
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => unwrap(await supabase.from('evaluations').update({ shared }).eq('id', id)),
    onSuccess: (_, v) => {
      toast.success(v.shared ? 'Evaluación compartida con jugador y familia' : 'Evaluación ahora es privada');
      void qc.invalidateQueries({ queryKey: ['evaluations', playerId] });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('evaluations').delete().eq('id', id)),
    onSuccess: () => {
      setDel(null);
      toast.success('Evaluación eliminada');
      void qc.invalidateQueries({ queryKey: ['evaluations', playerId] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  const evals = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {admin && (
        <Button className="self-start" onClick={() => setOpen(true)}>
          <Plus /> Nueva evaluación
        </Button>
      )}
      {evals.length === 0 ? (
        <EmptyState title="Sin evaluaciones">
          {admin ? 'Elige qué habilidades valorar en cada ocasión; no hace falta evaluarlas todas.' : 'El entrenador aún no ha compartido evaluaciones.'}
        </EmptyState>
      ) : (
        <>
          <EvaluationProgress evals={evals} />
          <ol className="flex flex-col gap-4">
            {evals.map((e) => {
              const note = notes.data?.find((n) => n.entity_id === e.id);
              return (
                <li key={e.id}>
                  <Panel
                    title={fmtDate(e.evaluated_on, { day: 'numeric', month: 'long', year: 'numeric' })}
                    action={
                      admin && (
                        <div className="flex items-center gap-1">
                          <Chip tone={e.shared ? 'success' : 'neutral'}>{e.shared ? 'Compartida' : 'Privada'}</Chip>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={e.shared ? 'Dejar de compartir' : 'Compartir con jugador y familia'}
                            onClick={() => toggleShare.mutate({ id: e.id, shared: !e.shared })}
                          >
                            {e.shared ? <EyeOff /> : <Eye />}
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Eliminar evaluación" onClick={() => setDel(e.id)}>
                            <Trash2 />
                          </Button>
                        </div>
                      )
                    }
                  >
                    {e.evaluator_name && <p className="mb-3 text-sm text-muted-foreground">Evaluó: {e.evaluator_name}</p>}
                    <ul className="flex flex-col divide-y">
                      {e.evaluation_items.map((it) => (
                        <li key={it.id} className="grid gap-1 py-2 sm:grid-cols-[11rem_auto_1fr] sm:items-center sm:gap-4">
                          <span className="font-semibold">{it.skill_name}</span>
                          <ScoreBar score={it.score} />
                          {it.comment && <span className="text-sm text-muted-foreground">{it.comment}</span>}
                        </li>
                      ))}
                    </ul>
                    {e.conclusion && (
                      <p className="mt-3 rounded-lg bg-muted p-3">
                        <span className="font-semibold">Conclusión: </span>
                        {e.conclusion}
                      </p>
                    )}
                    {admin && note && (
                      <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
                        <Lock className="mt-0.5 size-3.5 shrink-0" aria-label="Nota privada" />
                        {note.body}
                      </p>
                    )}
                  </Panel>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {admin && <EvaluationDialog open={open} onOpenChange={setOpen} playerId={playerId} />}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="¿Eliminar evaluación?"
        description="Se borrarán sus puntuaciones y observaciones. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        busy={remove.isPending}
        onConfirm={() => {
          if (del) remove.mutate(del);
        }}
      />
    </div>
  );
}

type Evals = NonNullable<ReturnType<typeof useEvaluations>['data']>;

/** Comparación entre evaluaciones: evolución por habilidad y diferencia entre las dos últimas. */
function EvaluationProgress({ evals }: { evals: Evals }) {
  const skills = useMemo(() => {
    const count = new Map<string, number>();
    evals.forEach((e) => e.evaluation_items.forEach((i) => i.score != null && count.set(i.skill_name, (count.get(i.skill_name) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [evals]);
  const [skill, setSkill] = useState<string>('');
  const current = skill || skills[0];
  if (!skills.length) return null;
  const series = [...evals]
    .reverse()
    .map((e) => ({ d: fmtDate(e.evaluated_on, { day: 'numeric', month: 'short', year: '2-digit' }), v: e.evaluation_items.find((i) => i.skill_name === current)?.score }))
    .filter((p) => p.v != null)
    .map((p) => ({ ...p, v: Number(p.v) }));
  const [last, prev] = evals;
  const diffs =
    last && prev
      ? last.evaluation_items
          .filter((i) => i.score != null)
          .map((i) => {
            const before = prev.evaluation_items.find((p) => p.skill_name === i.skill_name)?.score;
            return { skill: i.skill_name, now: Number(i.score), before: before == null ? null : Number(before) };
          })
      : [];

  return (
    <Panel
      title="Evolución"
      action={
        <Select value={current} onValueChange={setSkill}>
          <SelectTrigger size="sm" className="min-w-40" aria-label="Habilidad a comparar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {skills.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-52" role="img" aria-label={`Puntuación de ${current} en el tiempo: ${series.map((s) => `${s.d} ${s.v}`).join(', ')}`}>
          {series.length < 2 ? (
            <p className="text-sm text-muted-foreground">Se necesitan al menos dos evaluaciones con {current} para ver la evolución.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v) => [v, current]} />
                <Line type="monotone" dataKey="v" stroke="var(--brand-table)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--brand-ball)', stroke: 'var(--brand-table)' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {diffs.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Última evaluación frente a la anterior ({fmtDate(prev!.evaluated_on, { day: 'numeric', month: 'short' })})
            </p>
            <ul className="flex flex-col gap-1.5">
              {diffs.map((d) => {
                const delta = d.before == null ? null : d.now - d.before;
                return (
                  <li key={d.skill} className="flex items-center justify-between gap-2">
                    <span>{d.skill}</span>
                    <span className="flex items-center gap-2">
                      <span className="numeral text-[1.15rem]">{d.now}</span>
                      <span
                        className={cn(
                          'w-12 text-right text-sm font-semibold',
                          delta == null ? 'text-muted-foreground' : delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {delta == null ? 'nuevo' : delta > 0 ? `+${delta}` : delta === 0 ? '=' : delta}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

interface ItemState {
  selected: boolean;
  score: string;
  comment: string;
}

function EvaluationDialog({ open, onOpenChange, playerId }: { open: boolean; onOpenChange: (o: boolean) => void; playerId: string }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: skills = [] } = useSkills();
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [custom, setCustom] = useState('');
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  const [conclusion, setConclusion] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const all = [...skills.filter((s) => s.active).map((s) => ({ id: s.id as string | null, name: s.name })), ...extraSkills.map((n) => ({ id: null, name: n }))];
  const upd = (name: string, patch: Partial<ItemState>) =>
    setItems((s) => ({ ...s, [name]: { ...{ selected: false, score: '', comment: '' }, ...s[name], ...patch } }));

  const save = useMutation({
    mutationFn: async () => {
      const chosen = all.filter((s) => items[s.name]?.selected);
      const ev = unwrap(
        await supabase
          .from('evaluations')
          .insert({ player_id: playerId, evaluated_on: date, evaluator_id: profile?.id, evaluator_name: profile?.full_name, conclusion: conclusion.trim() || null, shared })
          .select('id')
          .single(),
      );
      const rows = chosen.map((s) => ({
        evaluation_id: ev.id,
        player_id: playerId,
        skill_id: s.id,
        skill_name: s.name,
        score: items[s.name].score.trim() === '' ? null : Number(items[s.name].score.replace(',', '.')),
        comment: items[s.name].comment.trim() || null,
      }));
      const ins = await supabase.from('evaluation_items').insert(rows);
      if (ins.error) {
        await supabase.from('evaluations').delete().eq('id', ev.id);
        throw new Error(ins.error.message);
      }
      if (privateNote.trim()) {
        unwrap(await supabase.from('private_notes').insert({ player_id: playerId, entity_type: 'evaluation', entity_id: ev.id, body: privateNote.trim(), created_by: profile?.id }));
      }
    },
    onSuccess: () => {
      toast.success('Evaluación guardada');
      setItems({});
      setConclusion('');
      setPrivateNote('');
      setExtraSkills([]);
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ['evaluations', playerId] });
      void qc.invalidateQueries({ queryKey: ['eval-notes', playerId] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => setErr(e.message),
  });

  const submit = () => {
    setErr(null);
    const chosen = all.filter((s) => items[s.name]?.selected);
    if (!chosen.length) return setErr('Elige al menos una habilidad.');
    for (const s of chosen) {
      const it = items[s.name];
      const n = Number(it.score.replace(',', '.'));
      if (it.score.trim() === '' && !it.comment.trim()) return setErr(`${s.name}: agrega una puntuación, una observación o ambas.`);
      if (it.score.trim() !== '' && (!Number.isFinite(n) || n < 0 || n > 10)) return setErr(`${s.name}: la puntuación va de 0 a 10.`);
    }
    if (date > todayISO()) return setErr('La fecha no puede ser futura.');
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva evaluación</DialogTitle>
          <DialogDescription>Marca solo las habilidades que valoras hoy. Cada una admite puntuación de 0 a 10, observación o ambas.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Fecha" htmlFor="ev-d" className="max-w-56">
            <Input id="ev-d" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Habilidades</legend>
            {all.map((s) => {
              const it = items[s.name];
              const id = `sk-${s.name.replace(/\W/g, '')}`;
              return (
                <div key={s.name} className={cn('rounded-lg border p-2.5', it?.selected && 'border-table/50 bg-table/5')}>
                  <label htmlFor={id} className="flex min-h-9 cursor-pointer items-center gap-3">
                    <Checkbox id={id} checked={!!it?.selected} onCheckedChange={(c) => upd(s.name, { selected: c === true })} className="size-5" />
                    <span className="font-medium">{s.name}</span>
                  </label>
                  {it?.selected && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[7rem_1fr]">
                      <Input inputMode="decimal" placeholder="0–10" aria-label={`Puntuación de ${s.name}`} value={it.score} onChange={(e) => upd(s.name, { score: e.target.value })} />
                      <Input placeholder="Observación" aria-label={`Observación de ${s.name}`} value={it.comment} onChange={(e) => upd(s.name, { comment: e.target.value })} />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otra habilidad" aria-label="Agregar otra habilidad" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const n = custom.trim();
                  if (n && !all.some((s) => s.name.toLowerCase() === n.toLowerCase())) {
                    setExtraSkills((x) => [...x, n]);
                    upd(n, { selected: true });
                  }
                  setCustom('');
                }}
              >
                Agregar
              </Button>
            </div>
          </fieldset>
          <Field label="Conclusión general" htmlFor="ev-c">
            <Textarea id="ev-c" rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
          </Field>
          <Field label="Nota privada del entrenador" htmlFor="ev-p" hint="Nunca se comparte.">
            <Textarea id="ev-p" rows={2} value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={shared} onCheckedChange={(c) => setShared(c === true)} className="size-5" />
            Compartir puntuaciones, observaciones y conclusión con el jugador y su familia
          </label>
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
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Guardar evaluación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

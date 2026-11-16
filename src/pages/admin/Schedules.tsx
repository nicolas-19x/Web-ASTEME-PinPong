import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX2, Pencil, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Chip, ConfirmDialog, EmptyState, ErrorState, Field, Loading, PageHeader, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, fmtDate, fmtTime, fullName, isoWeekday, todayISO, WEEKDAYS } from '@/lib/format';
import { qk, useCategories, useGroups, useLevels, usePlayers, type GroupItem } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';

const NONE = '__none__';

export function useExceptions(from: string, to: string) {
  return useQuery({
    queryKey: ['schedule_exceptions', from, to],
    queryFn: async () => unwrap(await supabase.from('schedule_exceptions').select('*, training_groups(name)').gte('on_date', from).lte('on_date', to).order('on_date')),
  });
}

/** Semana (lunes a domingo) con horarios fijos y cambios puntuales. */
export function WeekView({ groups, exceptions, weekStart }: { groups: GroupItem[]; exceptions: { group_id: string; on_date: string; kind: string; start_time: string | null; end_time: string | null; location: string | null; note: string | null }[]; weekStart: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {WEEKDAYS.map((day, i) => {
        const date = addDays(weekStart, i);
        const sessions = groups
          .filter((g) => g.active)
          .flatMap((g) => g.group_schedules.filter((s) => s.weekday === i + 1).map((s) => ({ g, s })))
          .sort((a, b) => a.s.start_time.localeCompare(b.s.start_time));
        return (
          <section key={day} className={`rounded-lg border bg-card p-2.5 ${date === todayISO() ? 'border-ball' : ''}`}>
            <h3 className="mb-2 text-[1rem]">
              {day} <span className="font-normal text-muted-foreground">{fmtDate(date, { day: 'numeric', month: 'short' })}</span>
            </h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin entrenamientos</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sessions.map(({ g, s }) => {
                  const ex = exceptions.find((e) => e.group_id === g.id && e.on_date === date);
                  return (
                    <li key={s.id} className={`rounded-md p-1.5 text-sm ${ex?.kind === 'cancelled' ? 'bg-destructive/8 line-through decoration-destructive/60' : 'bg-table/8'}`}>
                      <span className="block font-semibold">{g.name}</span>
                      <span className="text-xs">
                        {ex?.kind === 'changed' ? (
                          <>
                            <span className="font-semibold text-warning">Cambio:</span> {fmtTime(ex.start_time)}–{fmtTime(ex.end_time)}
                          </>
                        ) : (
                          `${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`
                        )}
                        {(ex?.location ?? s.location ?? g.location) ? `, ${ex?.location ?? s.location ?? g.location}` : ''}
                      </span>
                      {ex && <span className="block text-xs no-underline">{ex.kind === 'cancelled' ? 'Cancelado' : ''}{ex.note ? ` ${ex.note}` : ''}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function weekStartOf(iso: string) {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

export default function Schedules() {
  const { data: groups, isLoading, error, refetch } = useGroups();
  const [weekStart, setWeekStart] = useState(weekStartOf(todayISO()));
  const ex = useExceptions(weekStart, addDays(weekStart, 6));
  const [editing, setEditing] = useState<GroupItem | 'new' | null>(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  return (
    <div>
      <PageHeader
        title="Horarios y grupos"
        description="Horarios oficiales de los grupos de entrenamiento. No es un sistema de reservas."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Crear grupo
          </Button>
        }
      />
      <Panel
        title="Semana"
        className="mb-6"
        action={
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(weekStartOf(todayISO()))}>
              Esta semana
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Siguiente
            </Button>
          </div>
        }
      >
        <WeekView groups={groups ?? []} exceptions={ex.data ?? []} weekStart={weekStart} />
      </Panel>
      {!groups?.length ? (
        <EmptyState title="Aún no hay grupos de entrenamiento" action={<Button onClick={() => setEditing('new')}><Plus /> Crear grupo</Button>}>
          Define grupos por categoría o nivel, con sus días, horas y mesa o espacio.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <GroupPanel key={g.id} g={g} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}
      {editing && <GroupDialog group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GroupPanel({ g, onEdit }: { g: GroupItem; onEdit: () => void }) {
  const qc = useQueryClient();
  const { data: players = [] } = usePlayers();
  const [addOpen, setAddOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [del, setDel] = useState(false);
  const members = g.group_memberships.filter((m) => !m.end_date);
  const upcomingEx = useQuery({
    queryKey: ['schedule_exceptions', 'group', g.id],
    queryFn: async () => unwrap(await supabase.from('schedule_exceptions').select('*').eq('group_id', g.id).gte('on_date', todayISO()).order('on_date')),
  });
  const removeMember = useMutation({
    mutationFn: async (mid: string) => unwrap(await supabase.from('group_memberships').update({ end_date: todayISO() }).eq('id', mid)),
    onSuccess: () => {
      toast.success('Jugador retirado del grupo (queda en su historial)');
      void qc.invalidateQueries({ queryKey: qk.groups });
    },
    onError: (e) => toast.error(e.message),
  });
  const removeEx = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('schedule_exceptions').delete().eq('id', id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedule_exceptions'] }),
  });
  const removeGroup = useMutation({
    mutationFn: async () => unwrap(await supabase.from('training_groups').update({ active: false }).eq('id', g.id)),
    onSuccess: () => {
      toast.success('Grupo desactivado; su historial de asistencia se conserva');
      void qc.invalidateQueries({ queryKey: qk.groups });
    },
  });
  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          {g.name}
          {g.categories && <Chip tone="info">{g.categories.name}</Chip>}
          {g.levels && <Chip>{g.levels.name}</Chip>}
          {!g.active && <Chip tone="warning">Inactivo</Chip>}
        </span>
      }
      action={
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil /> Editar
          </Button>
          {g.active && (
            <Button size="icon-sm" variant="ghost" aria-label="Desactivar grupo" onClick={() => setDel(true)}>
              <Trash2 />
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-[1.05rem]">Horario semanal</h3>
          {g.group_schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin horario. Agrégalo en Editar.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {[...g.group_schedules]
                .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
                .map((s) => (
                  <li key={s.id}>
                    <span className="font-semibold">{WEEKDAYS[s.weekday - 1]}</span> {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                    {s.location || g.location ? `, ${s.location ?? g.location}` : ''}
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[1.05rem]">Integrantes ({members.length})</h3>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <UserPlus /> Agregar
            </Button>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin integrantes.</p>
          ) : (
            <ul className="flex flex-col">
              {members.map((m) => {
                const p = players.find((x) => x.id === m.player_id);
                return (
                  <li key={m.id} className="flex min-h-10 items-center justify-between gap-2 text-sm">
                    <span>{p ? fullName(p) : '…'}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={`Retirar a ${p ? fullName(p) : ''} del grupo`} onClick={() => removeMember.mutate(m.id)}>
                      <UserMinus />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[1.05rem]">Cambios y cancelaciones</h3>
            <Button size="sm" variant="outline" onClick={() => setExOpen(true)}>
              <CalendarX2 /> Registrar
            </Button>
          </div>
          {!upcomingEx.data?.length ? (
            <p className="text-sm text-muted-foreground">Sin cambios próximos.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {upcomingEx.data.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-semibold">{fmtDate(e.on_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>:{' '}
                    {e.kind === 'cancelled' ? 'cancelado' : `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}`}
                    {e.note ? `. ${e.note}` : ''}
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label="Quitar cambio" onClick={() => removeEx.mutate(e.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {addOpen && <AddMembers group={g} onClose={() => setAddOpen(false)} />}
      {exOpen && <ExceptionDialog groupId={g.id} onClose={() => setExOpen(false)} />}
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`¿Desactivar ${g.name}?`}
        description="Dejará de aparecer en horarios y asistencia. Su historial de asistencia se conserva."
        confirmLabel="Desactivar"
        destructive
        onConfirm={() => removeGroup.mutate()}
      />
    </Panel>
  );
}

function AddMembers({ group, onClose }: { group: GroupItem; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: players = [] } = usePlayers();
  const current = new Set(group.group_memberships.filter((m) => !m.end_date).map((m) => m.player_id));
  const candidates = players.filter((p) => p.status === 'active' && !current.has(p.id));
  const [sel, setSel] = useState<string[]>([]);
  const suggested = candidates.filter((p) => (!group.category_id || p.category_id === group.category_id) && (!group.level_id || p.level_id === group.level_id));
  const save = useMutation({
    mutationFn: async () => unwrap(await supabase.from('group_memberships').insert(sel.map((player_id) => ({ group_id: group.id, player_id })))),
    onSuccess: () => {
      toast.success('Integrantes agregados');
      void qc.invalidateQueries({ queryKey: qk.groups });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar a {group.name}</DialogTitle>
          <DialogDescription>Primero aparecen los jugadores de la categoría y nivel del grupo.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y">
          {[...suggested, ...candidates.filter((p) => !suggested.includes(p))].map((p) => (
            <li key={p.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <Checkbox checked={sel.includes(p.id)} onCheckedChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="size-5" />
                <span className="flex-1">{fullName(p)}</span>
                <span className="text-sm text-muted-foreground">{p.categories?.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!sel.length || save.isPending}>
            Agregar {sel.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExceptionDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ date: todayISO(), kind: 'cancelled', start: '', end: '', location: '', note: '' });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.from('schedule_exceptions').insert({
          group_id: groupId,
          on_date: f.date,
          kind: f.kind,
          start_time: f.kind === 'changed' ? f.start : null,
          end_time: f.kind === 'changed' ? f.end : null,
          location: f.location.trim() || null,
          note: f.note.trim() || null,
        }),
      ),
    onSuccess: () => {
      toast.success('Cambio registrado; se refleja en los portales');
      void qc.invalidateQueries({ queryKey: ['schedule_exceptions'] });
      onClose();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambio puntual de horario</DialogTitle>
          <DialogDescription>Para avisar también por mensaje, publica un comunicado de cambio de horario.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha" htmlFor="ex-d" required>
            <Input id="ex-d" type="date" min={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger className="w-full" aria-label="Tipo de cambio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cancelled">Cancelar entrenamiento</SelectItem>
                <SelectItem value="changed">Cambiar hora o lugar</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {f.kind === 'changed' && (
            <>
              <Field label="Nueva hora de inicio" htmlFor="ex-s" required>
                <Input id="ex-s" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
              </Field>
              <Field label="Nueva hora de fin" htmlFor="ex-e" required>
                <Input id="ex-e" type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
              </Field>
              <Field label="Lugar" htmlFor="ex-l">
                <Input id="ex-l" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Nota" htmlFor="ex-n" className="sm:col-span-2">
            <Input id="ex-n" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ej.: feriado" />
          </Field>
        </div>
        {err && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              setErr(null);
              if (f.kind === 'changed' && (!f.start || !f.end || f.end <= f.start)) return setErr('Indica una hora de inicio y una de fin posterior.');
              save.mutate();
            }}
          >
            Guardar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupDialog({ group, onClose }: { group: GroupItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: levels = [] } = useLevels();
  const [f, setF] = useState({
    name: group?.name ?? '',
    category_id: group?.category_id ?? NONE,
    level_id: group?.level_id ?? NONE,
    location: group?.location ?? '',
    active: group?.active ?? true,
  });
  const [slots, setSlots] = useState(
    group?.group_schedules.map((s) => ({ weekday: String(s.weekday), start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5), location: s.location ?? '' })) ?? [],
  );
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: f.name.trim(),
        category_id: f.category_id === NONE ? null : f.category_id,
        level_id: f.level_id === NONE ? null : f.level_id,
        location: f.location.trim() || null,
        active: f.active,
      };
      const id = group ? (unwrap(await supabase.from('training_groups').update(row).eq('id', group.id)), group.id) : unwrap(await supabase.from('training_groups').insert(row).select('id').single()).id;
      unwrap(await supabase.from('group_schedules').delete().eq('group_id', id));
      if (slots.length)
        unwrap(await supabase.from('group_schedules').insert(slots.map((s) => ({ group_id: id, weekday: +s.weekday, start_time: s.start, end_time: s.end, location: s.location.trim() || null }))));
    },
    onSuccess: () => {
      toast.success(group ? 'Grupo actualizado' : 'Grupo creado');
      void qc.invalidateQueries({ queryKey: qk.groups });
      onClose();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{group ? `Editar ${group.name}` : 'Crear grupo'}</DialogTitle>
          <DialogDescription>Los cambios de horario se ven en los portales de jugadores y familias del grupo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del grupo" htmlFor="gr-n" required className="sm:col-span-2">
            <Input id="gr-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: Sub-13 formativo" />
          </Field>
          <Field label="Categoría">
            <Select value={f.category_id} onValueChange={(v) => setF({ ...f, category_id: v })}>
              <SelectTrigger className="w-full" aria-label="Categoría del grupo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Varias / ninguna</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nivel">
            <Select value={f.level_id} onValueChange={(v) => setF({ ...f, level_id: v })}>
              <SelectTrigger className="w-full" aria-label="Nivel del grupo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Varios / ninguno</SelectItem>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Espacio o mesa habitual" htmlFor="gr-l" className="sm:col-span-2">
            <Input id="gr-l" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          {group && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={f.active} onCheckedChange={(c) => setF({ ...f, active: c === true })} className="size-5" /> Grupo activo
            </label>
          )}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Horario semanal</legend>
          {slots.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <Select value={s.weekday} onValueChange={(v) => setSlots((x) => x.map((y, j) => (j === i ? { ...y, weekday: v } : y)))}>
                <SelectTrigger aria-label="Día">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, k) => (
                    <SelectItem key={d} value={String(k + 1)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="time" aria-label="Hora de inicio" value={s.start} onChange={(e) => setSlots((x) => x.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)))} />
              <Input type="time" aria-label="Hora de fin" value={s.end} onChange={(e) => setSlots((x) => x.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)))} />
              <Button variant="ghost" size="icon" aria-label="Quitar horario" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setSlots((x) => [...x, { weekday: '1', start: '16:00', end: '17:30', location: '' }])}>
            <Plus /> Agregar día
          </Button>
        </fieldset>
        {err && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              setErr(null);
              if (!f.name.trim()) return setErr('Escribe el nombre del grupo.');
              if (slots.some((s) => !s.start || !s.end || s.end <= s.start)) return setErr('Cada horario necesita una hora de fin posterior a la de inicio.');
              save.mutate();
            }}
          >
            {group ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Chip, ConfirmDialog, EmptyState, ErrorState, Field, Loading, PageHeader } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dateOnly, fmtDate, fmtTime, isoWeekday, todayISO } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Ev {
  key: string;
  id: string;
  date: string;
  end?: string | null;
  title: string;
  kind: 'tournament' | 'competition' | 'control' | 'special' | 'other';
  time?: string | null;
  location?: string | null;
  href?: string;
  deletable?: boolean;
}
const KIND: Record<Ev['kind'], [string, 'info' | 'ball' | 'success' | 'warning' | 'neutral']> = {
  tournament: ['Torneo interno', 'info'],
  competition: ['Competencia', 'ball'],
  control: ['Control interno', 'success'],
  special: ['Actividad especial', 'warning'],
  other: ['Evento', 'neutral'],
};

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
function shiftMonth(iso: string, delta: number) {
  const d = dateOnly(iso);
  d.setUTCMonth(d.getUTCMonth() + delta, 1);
  return d.toISOString().slice(0, 10);
}
function monthEnd(iso: string) {
  const d = dateOnly(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage({ portal = false }: { portal?: boolean }) {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthStart(todayISO()));
  const [del, setDel] = useState<Ev | null>(null);
  const from = month;
  const to = monthEnd(month);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['calendar', month, portal],
    queryFn: async () => {
      const [t, c, e] = await Promise.all([
        supabase.from('tournaments').select('id, name, held_on, location').gte('held_on', from).lte('held_on', to),
        supabase.from('competitions').select('id, name, start_date, end_date, location').lte('start_date', to).or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`),
        supabase.from('sport_events').select('*').gte('starts_on', from).lte('starts_on', to),
      ]);
      const evs: Ev[] = [
        ...unwrap(t).map((x) => ({ key: `t${x.id}`, id: x.id, date: x.held_on, title: x.name, kind: 'tournament' as const, location: x.location, href: portal ? undefined : `/torneos/${x.id}` })),
        ...unwrap(c).map((x) => ({ key: `c${x.id}`, id: x.id, date: x.start_date, end: x.end_date, title: x.name, kind: 'competition' as const, location: x.location, href: portal ? undefined : `/competencias/${x.id}` })),
        ...unwrap(e).map((x) => ({ key: `e${x.id}`, id: x.id, date: x.starts_on, title: x.title, kind: x.kind as Ev['kind'], time: x.start_time, location: x.location, deletable: !portal })),
      ];
      return evs.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('sport_events').delete().eq('id', id)),
    onSuccess: () => {
      toast.success('Evento eliminado');
      setDel(null);
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const monthLabel = fmtDate(month, { month: 'long', year: 'numeric' });
  const firstWeekday = isoWeekday(month);
  const days = Number(to.slice(8, 10));
  const today = todayISO();
  const evs = data ?? [];
  const onDay = (iso: string) => evs.filter((e) => e.date === iso || (e.end && e.date <= iso && e.end >= iso));

  return (
    <div>
      <PageHeader
        title="Calendario deportivo"
        description="Torneos, competencias, controles internos y actividades especiales."
        actions={
          !portal && (
            <Button onClick={() => setParams({ nuevo: 'control' })}>
              <Plus /> Agregar evento
            </Button>
          )
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <h2 className="min-w-44 text-center text-[1.5rem] first-letter:uppercase">{monthLabel}</h2>
        <Button variant="outline" size="icon" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight />
        </Button>
        {month !== monthStart(today) && (
          <Button variant="ghost" onClick={() => setMonth(monthStart(today))}>
            Hoy
          </Button>
        )}
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="hidden rounded-xl border bg-card p-3 md:block" aria-hidden>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday - 1 }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const iso = `${month.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
                const es = onDay(iso);
                return (
                  <div key={iso} className={cn('min-h-20 rounded-md border p-1.5 text-left', iso === today && 'border-ball', es.length === 0 && 'border-transparent bg-muted/40')}>
                    <span className={cn('numeral text-[1rem]', iso === today && 'text-ball')}>{i + 1}</span>
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {es.slice(0, 3).map((e) => (
                        <li key={e.key} className="truncate rounded bg-table/12 px-1 text-[0.7rem] font-medium">
                          {e.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          <section aria-label={`Eventos de ${monthLabel}`}>
            {evs.length === 0 ? (
              <EmptyState title="Sin eventos este mes">{!portal && 'Agrega controles internos o actividades especiales; los torneos y competencias aparecen solos.'}</EmptyState>
            ) : (
              <ol className="flex flex-col gap-2">
                {evs.map((e) => {
                  const [label, tone] = KIND[e.kind];
                  const content = (
                    <>
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-md bg-muted py-1">
                        <span className="numeral text-[1.35rem] leading-none">{fmtDate(e.date, { day: 'numeric' })}</span>
                        <span className="text-[0.7rem] text-muted-foreground">{fmtDate(e.date, { weekday: 'short' })}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{e.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {e.time ? `${fmtTime(e.time)}, ` : ''}
                          {e.end && e.end !== e.date ? `hasta el ${fmtDate(e.end, { day: 'numeric', month: 'short' })}, ` : ''}
                          {e.location ?? ''}
                        </span>
                      </span>
                      <Chip tone={tone}>{label}</Chip>
                    </>
                  );
                  return (
                    <li key={e.key} className="flex items-center gap-2">
                      {e.href ? (
                        <Link to={e.href} className="flex flex-1 items-center gap-3 rounded-lg border bg-card p-2.5 hover:border-table/50">
                          {content}
                        </Link>
                      ) : (
                        <div className="flex flex-1 items-center gap-3 rounded-lg border bg-card p-2.5">{content}</div>
                      )}
                      {e.deletable && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${e.title}`} onClick={() => setDel(e)}>
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
      {!portal && <EventDialog open={!!params.get('nuevo')} defaultKind={params.get('nuevo') ?? 'control'} onOpenChange={(o) => !o && setParams({})} />}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="¿Eliminar evento?"
        description={`Se quitará “${del?.title}” del calendario.`}
        confirmLabel="Eliminar"
        destructive
        busy={remove.isPending}
        onConfirm={() => {
          if (del) remove.mutate(del.id);
        }}
      />
    </div>
  );
}

function EventDialog({ open, onOpenChange, defaultKind }: { open: boolean; onOpenChange: (o: boolean) => void; defaultKind: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: '', kind: ['control', 'special', 'other'].includes(defaultKind) ? defaultKind : 'control', date: todayISO(), time: '', location: '', notes: '', visible: true });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.from('sport_events').insert({
          title: f.title.trim(),
          kind: f.kind,
          starts_on: f.date,
          start_time: f.time || null,
          location: f.location.trim() || null,
          notes: f.notes.trim() || null,
          visible_in_portals: f.visible,
        }),
      ),
    onSuccess: () => {
      toast.success('Evento agregado al calendario');
      setF({ ...f, title: '', notes: '' });
      onOpenChange(false);
      void qc.invalidateQueries();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar evento deportivo</DialogTitle>
          <DialogDescription>Controles internos y actividades especiales. Los resultados de cada control se registran en la ficha del jugador.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" htmlFor="ev-t" required className="sm:col-span-2">
            <Input id="ev-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej.: Control de saque, Sub-13" />
          </Field>
          <Field label="Tipo">
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger className="w-full" aria-label="Tipo de evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="control">Control interno</SelectItem>
                <SelectItem value="special">Actividad especial</SelectItem>
                <SelectItem value="other">Otro evento deportivo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha" htmlFor="ev-d" required>
            <Input id="ev-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Hora" htmlFor="ev-h">
            <Input id="ev-h" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
          <Field label="Lugar" htmlFor="ev-l">
            <Input id="ev-l" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <Field label="Notas" htmlFor="ev-n" className="sm:col-span-2">
            <Input id="ev-n" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={f.visible} onCheckedChange={(c) => setF({ ...f, visible: c === true })} className="size-5" /> Mostrar en los portales de jugadores y familias
          </label>
        </div>
        {err && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              setErr(null);
              if (!f.title.trim()) return setErr('Escribe un título.');
              save.mutate();
            }}
          >
            Agregar evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

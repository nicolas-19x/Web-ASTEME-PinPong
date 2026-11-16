import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { EmptyState, ErrorState, Field, Loading, PageHeader, Panel, PlayerAvatar } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportRows } from '@/features/export';
import { useAuth } from '@/lib/auth';
import { dateOnly, fmtDate, fullName, isoWeekday, pct, todayISO } from '@/lib/format';
import { useGroups, usePlayers } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Status = 'present' | 'absent' | 'excused';
const OPTIONS: [Status, string, string][] = [
  ['present', 'Presente', 'P'],
  ['absent', 'Ausente', 'A'],
  ['excused', 'Justificado', 'J'],
];

export default function Attendance() {
  const [tab, setTab] = useState('lista');
  return (
    <div>
      <PageHeader title="Asistencia" description="Marca la lista al inicio de cada entrenamiento; cada toque se guarda al instante." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lista" className="min-h-10 px-4">
            Pasar lista
          </TabsTrigger>
          <TabsTrigger value="reportes" className="min-h-10 px-4">
            Reportes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="mt-5">
          <TakeAttendance />
        </TabsContent>
        <TabsContent value="reportes" className="mt-5">
          <AttendanceReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TakeAttendance() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: groups, isLoading } = useGroups();
  const { data: players = [] } = usePlayers();
  const [date, setDate] = useState(todayISO());
  const [groupId, setGroupId] = useState<string>('');
  const active = (groups ?? []).filter((g) => g.active);

  useEffect(() => {
    if (!groupId && active.length) {
      const wd = isoWeekday(date);
      setGroupId((active.find((g) => g.group_schedules.some((s) => s.weekday === wd)) ?? active[0]).id);
    }
  }, [active, groupId, date]);

  const group = active.find((g) => g.id === groupId);
  const { data: marks = [] } = useQuery({
    queryKey: ['attendance', groupId, date],
    enabled: !!groupId,
    queryFn: async () => unwrap(await supabase.from('attendance').select('*').eq('group_id', groupId).eq('on_date', date)),
  });
  const { data: exception } = useQuery({
    queryKey: ['schedule_exceptions', 'day', groupId, date],
    enabled: !!groupId,
    queryFn: async () => unwrap(await supabase.from('schedule_exceptions').select('*').eq('group_id', groupId).eq('on_date', date).maybeSingle()),
  });
  const mark = useMutation({
    mutationFn: async (rows: { player_id: string; status: Status }[]) =>
      unwrap(
        await supabase
          .from('attendance')
          .upsert(rows.map((r) => ({ group_id: groupId, on_date: date, player_id: r.player_id, status: r.status, recorded_by: profile?.id })), { onConflict: 'group_id,player_id,on_date' }),
      ),
    onMutate: async (rows) => {
      const key = ['attendance', groupId, date];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: typeof marks = []) => {
        const map = new Map(old.map((m) => [m.player_id, m]));
        rows.forEach((r) => map.set(r.player_id, { ...(map.get(r.player_id) ?? ({} as (typeof marks)[number])), player_id: r.player_id, status: r.status }));
        return [...map.values()];
      });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(['attendance', groupId, date], ctx?.prev);
      toast.error(`No se guardó: ${e.message}`);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['attendance', groupId, date] }),
  });

  if (isLoading) return <Loading />;
  if (!active.length) return <EmptyState title="No hay grupos activos">Crea un grupo en Horarios y grupos para pasar lista.</EmptyState>;

  // Integrantes vigentes en la fecha elegida (respeta altas y bajas).
  const members = (group?.group_memberships ?? [])
    .filter((m) => !m.end_date || m.end_date >= date)
    .map((m) => players.find((p) => p.id === m.player_id))
    .filter((p): p is NonNullable<typeof p> => !!p && p.status !== 'archived')
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'));
  const status = new Map(marks.map((m) => [m.player_id, m.status as Status]));
  const hasSession = group?.group_schedules.some((s) => s.weekday === isoWeekday(date));
  const counts = { present: 0, absent: 0, excused: 0 } as Record<Status, number>;
  members.forEach((p) => {
    const s = status.get(p.id);
    if (s) counts[s]++;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Grupo">
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="w-full" aria-label="Grupo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {active.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fecha" htmlFor="at-d">
          <Input id="at-d" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {exception?.kind === 'cancelled' && <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">Este entrenamiento figura como cancelado{exception.note ? `: ${exception.note}` : ''}.</p>}
      {!hasSession && !exception && <p className="rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm">Este grupo no tiene entrenamiento fijo los {fmtDate(date, { weekday: 'long' })}. Puedes registrar asistencia igualmente.</p>}

      {members.length === 0 ? (
        <EmptyState title="El grupo no tiene integrantes">Agrégalos en Horarios y grupos.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => mark.mutate(members.filter((p) => !status.get(p.id)).map((p) => ({ player_id: p.id, status: 'present' })))} disabled={members.every((p) => status.get(p.id))}>
              <CheckCheck /> Marcar presentes a los pendientes
            </Button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {counts.present} presentes, {counts.absent} ausentes, {counts.excused} justificados, {members.length - counts.present - counts.absent - counts.excused} sin marcar
            </p>
          </div>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {members.map((p) => {
              const s = status.get(p.id);
              return (
                <li key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <span className="flex flex-1 items-center gap-3">
                    <PlayerAvatar player={p} size={36} />
                    <span className="font-semibold">{fullName(p)}</span>
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 sm:w-[22rem]" role="radiogroup" aria-label={`Asistencia de ${fullName(p)}`}>
                    {OPTIONS.map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={s === v}
                        onClick={() => mark.mutate([{ player_id: p.id, status: v }])}
                        className={cn(
                          'min-h-12 rounded-lg border text-sm font-semibold transition-colors',
                          s === v
                            ? v === 'present'
                              ? 'border-success bg-success text-white dark:text-ink'
                              : v === 'absent'
                                ? 'border-destructive bg-destructive text-white dark:text-ink'
                                : 'border-warning bg-warning text-white dark:text-ink'
                            : 'bg-background hover:bg-accent',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function AttendanceReports() {
  const { data: groups = [] } = useGroups();
  const { data: players = [] } = usePlayers();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [groupId, setGroupId] = useState('all');
  const [playerId, setPlayerId] = useState('all');
  const sixAgo = useMemo(() => {
    const d = dateOnly(`${month}-01`);
    d.setUTCMonth(d.getUTCMonth() - 5);
    return d.toISOString().slice(0, 7);
  }, [month]);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance-report', sixAgo, month],
    queryFn: async () => {
      const end = dateOnly(`${month}-01`);
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
      return unwrap(await supabase.from('attendance').select('player_id, group_id, on_date, status').gte('on_date', `${sixAgo}-01`).lte('on_date', end.toISOString().slice(0, 10)));
    },
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  const rows = (data ?? []).filter((r) => (groupId === 'all' || r.group_id === groupId) && (playerId === 'all' || r.player_id === playerId));
  const inMonth = rows.filter((r) => r.on_date.startsWith(month));
  const byPlayer = new Map<string, Record<Status, number>>();
  inMonth.forEach((r) => {
    const c = byPlayer.get(r.player_id) ?? { present: 0, absent: 0, excused: 0 };
    c[r.status as Status]++;
    byPlayer.set(r.player_id, c);
  });
  const table = [...byPlayer.entries()]
    .map(([id, c]) => {
      const p = players.find((x) => x.id === id);
      const total = c.present + c.absent + c.excused;
      return { id, name: p ? fullName(p) : '—', ...c, total, rate: total ? c.present / total : 0 };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = dateOnly(`${sixAgo}-01`);
    d.setUTCMonth(d.getUTCMonth() + i);
    months.push(d.toISOString().slice(0, 7));
  }
  const trend = months.map((m) => {
    const rs = rows.filter((r) => r.on_date.startsWith(m));
    return { m: fmtDate(`${m}-01`, { month: 'short' }).replace('.', ''), v: rs.length ? Math.round((rs.filter((r) => r.status === 'present').length / rs.length) * 100) : 0, n: rs.length };
  });
  const total = inMonth.length;
  const present = inMonth.filter((r) => r.status === 'present').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mes" htmlFor="ar-m">
          <Input id="ar-m" type="month" value={month} max={todayISO().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </Field>
        <Field label="Grupo">
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="w-full" aria-label="Grupo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Jugador">
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger className="w-full" aria-label="Jugador">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los jugadores</SelectItem>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {fullName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Tendencia (últimos 6 meses)">
          <p className="mb-2">
            <span className="numeral text-[2.4rem] leading-none">{pct(present, total)}</span> <span className="text-sm text-muted-foreground">de asistencia en {fmtDate(`${month}-01`, { month: 'long' })}</span>
          </p>
          <div className="h-44" role="img" aria-label={`Porcentaje de asistencia por mes: ${trend.map((t) => `${t.m} ${t.n ? `${t.v} %` : 'sin datos'}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v, _n, p) => [p.payload.n ? `${v} %` : 'Sin registros', 'Asistencia']} />
                <Bar dataKey="v" fill="var(--brand-table)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Por jugador"
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={!table.length}
              onClick={() =>
                exportRows(
                  `asistencia-${month}`,
                  ['Jugador', 'Presentes', 'Ausentes', 'Justificados', 'Total', '% asistencia'],
                  table.map((r) => [r.name, r.present, r.absent, r.excused, r.total, Math.round(r.rate * 100)]),
                  'csv',
                )
              }
            >
              <Download /> CSV
            </Button>
          }
          bodyClassName="p-0 sm:p-0"
        >
          {table.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin registros en este mes.</p>
          ) : (
            <ul className="divide-y">
              {table.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {r.present} P, {r.absent} A, {r.excused} J
                  </span>
                  <span className="numeral w-14 text-right text-[1.2rem]">{Math.round(r.rate * 100)} %</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

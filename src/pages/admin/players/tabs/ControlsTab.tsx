import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ConfirmDialog, EmptyState, ErrorState, Field, Loading, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDate, todayISO } from '@/lib/format';
import { qk, useControlTests } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';

const NEW = '__new__';

export function ControlsTab({ playerId, admin = true }: { playerId: string; admin?: boolean }) {
  const qc = useQueryClient();
  const { data: tests = [] } = useControlTests();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['controls', playerId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('control_results')
          .select('*, control_tests(id, name, unit, higher_is_better)')
          .eq('player_id', playerId)
          .order('measured_on'),
      ),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('control_results').delete().eq('id', id)),
    onSuccess: () => {
      setDel(null);
      toast.success('Medición eliminada');
      void qc.invalidateQueries({ queryKey: ['controls', playerId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const byTest = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>>();
    for (const r of data ?? []) m.set(r.test_id, [...(m.get(r.test_id) ?? []), r]);
    return [...m.values()];
  }, [data]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      {admin && (
        <Button className="self-start" onClick={() => setOpen(true)}>
          <Plus /> Registrar medición
        </Button>
      )}
      {byTest.length === 0 ? (
        <EmptyState title="Sin controles registrados">
          {admin ? 'Registra la primera medición de una prueba interna; todas las mediciones se conservan para ver la evolución.' : 'El entrenador aún no ha compartido controles.'}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {byTest.map((rows) => {
            const t = rows[0].control_tests!;
            const numeric = rows.filter((r) => r.value != null);
            const last = rows[rows.length - 1];
            return (
              <Panel key={t.id} title={t.name}>
                <p className="mb-3 text-sm text-muted-foreground">
                  Última: <span className="numeral text-[1.3rem] text-foreground">{last.value ?? last.value_text}</span> {t.unit} el {fmtDate(last.measured_on)}
                  {t.higher_is_better ? ' (más es mejor)' : ' (menos es mejor)'}
                </p>
                {numeric.length >= 2 && (
                  <div className="mb-3 h-40" role="img" aria-label={`Evolución de ${t.name}: ${numeric.map((r) => `${fmtDate(r.measured_on)} ${r.value}`).join(', ')}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={numeric.map((r) => ({ d: fmtDate(r.measured_on, { day: 'numeric', month: 'short' }), v: Number(r.value) }))} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="d" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v) => [`${v} ${t.unit ?? ''}`, t.name]} />
                        <Line type="monotone" dataKey="v" stroke="var(--brand-table)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--brand-table)' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <ul className="flex flex-col divide-y text-sm">
                  {[...rows].reverse().map((r) => (
                    <li key={r.id} className="flex min-h-10 items-center gap-3 py-1.5">
                      <span className="w-24 shrink-0 text-muted-foreground">{fmtDate(r.measured_on, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      <span className="numeral text-[1.1rem]">{r.value ?? r.value_text}</span>
                      <span className="flex-1 truncate text-muted-foreground">{r.notes}</span>
                      {admin && !r.shared && <span className="text-xs text-muted-foreground">No compartida</span>}
                      {admin && (
                        <Button variant="ghost" size="icon-sm" aria-label="Eliminar medición" onClick={() => setDel(r.id)}>
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}
      {admin && <ControlDialog open={open} onOpenChange={setOpen} playerId={playerId} tests={tests} />}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="¿Eliminar medición?"
        description="Se borrará del historial de controles. Esta acción no se puede deshacer."
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

function ControlDialog({
  open,
  onOpenChange,
  playerId,
  tests,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  playerId: string;
  tests: { id: string; name: string; unit: string | null; active: boolean }[];
}) {
  const qc = useQueryClient();
  const [testId, setTestId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [higher, setHigher] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [shared, setShared] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      let tid = testId;
      if (testId === NEW) {
        const t = unwrap(await supabase.from('control_tests').insert({ name: newName.trim(), unit: newUnit.trim() || null, higher_is_better: higher }).select('id').single());
        tid = t.id;
      }
      const num = Number(value.replace(',', '.'));
      unwrap(
        await supabase.from('control_results').insert({
          player_id: playerId,
          test_id: tid,
          measured_on: date,
          value: value.trim() !== '' && Number.isFinite(num) ? num : null,
          value_text: value.trim() !== '' && !Number.isFinite(num) ? value.trim() : null,
          notes: notes.trim() || null,
          shared,
        }),
      );
    },
    onSuccess: () => {
      toast.success('Medición registrada');
      setValue('');
      setNotes('');
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ['controls', playerId] });
      void qc.invalidateQueries({ queryKey: qk.controlTests });
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar medición</DialogTitle>
          <DialogDescription>Se conserva junto a las mediciones anteriores.</DialogDescription>
        </DialogHeader>
        <form
          id="ctrl-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            if (!testId) return setErr('Elige la prueba.');
            if (testId === NEW && !newName.trim()) return setErr('Escribe el nombre de la prueba nueva.');
            if (!value.trim()) return setErr('Escribe el resultado.');
            if (date > todayISO()) return setErr('La fecha no puede ser futura.');
            save.mutate();
          }}
        >
          <Field label="Prueba" required>
            <Select value={testId} onValueChange={setTestId}>
              <SelectTrigger className="w-full" aria-label="Prueba">
                <SelectValue placeholder="Elige una prueba" />
              </SelectTrigger>
              <SelectContent>
                {tests
                  .filter((t) => t.active)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.unit ? ` (${t.unit})` : ''}
                    </SelectItem>
                  ))}
                <SelectItem value={NEW}>Nueva prueba…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {testId === NEW && (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <Field label="Nombre de la prueba" htmlFor="ct-n" required>
                <Input id="ct-n" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </Field>
              <Field label="Unidad" htmlFor="ct-u" hint="Ej.: repeticiones, segundos">
                <Input id="ct-u" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={higher} onCheckedChange={(c) => setHigher(c === true)} /> Un valor más alto es mejor
              </label>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha" htmlFor="ct-d" required>
              <Input id="ct-d" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Resultado" htmlFor="ct-v" required hint="Número o texto breve">
              <Input id="ct-v" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
          </div>
          <Field label="Observaciones" htmlFor="ct-o">
            <Input id="ct-o" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={shared} onCheckedChange={(c) => setShared(c === true)} /> Compartir con el jugador y su familia
          </label>
          {err && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {err}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="ctrl-form" disabled={save.isPending}>
            Guardar medición
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

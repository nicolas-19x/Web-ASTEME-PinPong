import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Medal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Chip, EmptyState, ErrorState, Field, Loading, PageHeader } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fmtDate, todayISO } from '@/lib/format';
import { supabase, unwrap, type Tables } from '@/lib/supabase';

export const SCOPE_LABEL: Record<string, string> = { national: 'Nacional', regional: 'Regional', international: 'Internacional', other: 'Otra' };

export default function Competitions() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['competitions'],
    queryFn: async () => unwrap(await supabase.from('competitions').select('*, competition_participants(id, registered, final_position, medal)').order('start_date', { ascending: false })),
  });
  const today = todayISO();
  const upcoming = (data ?? []).filter((c) => (c.end_date ?? c.start_date) >= today).reverse();
  const past = (data ?? []).filter((c) => (c.end_date ?? c.start_date) < today);
  const Item = ({ c }: { c: NonNullable<typeof data>[number] }) => (
    <li>
      <Link to={`/competencias/${c.id}`} className="flex flex-col gap-2 rounded-xl border bg-card p-4 hover:border-table/50 sm:flex-row sm:items-center">
        <span className="min-w-0 flex-1">
          <span className="condensed block text-[1.3rem] font-bold">{c.name}</span>
          <span className="text-sm text-muted-foreground">
            {fmtDate(c.start_date)}
            {c.end_date && c.end_date !== c.start_date ? ` al ${fmtDate(c.end_date)}` : ''}
            {c.location ? `, ${c.location}` : ''}
            {c.organizer ? `. Organiza: ${c.organizer}` : ''}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone="ball">{SCOPE_LABEL[c.scope]}</Chip>
          <Chip>{c.competition_participants.length} convocados</Chip>
          {c.competition_participants.some((p) => p.medal) && (
            <Chip tone="success">
              <Medal className="size-3.5" aria-hidden /> {c.competition_participants.filter((p) => p.medal).length}
            </Chip>
          )}
        </span>
      </Link>
    </li>
  );
  return (
    <div>
      <PageHeader
        title="Competencias externas"
        description="Torneos nacionales y regionales: convocatorias, inscripciones y resultados que pasan a los expedientes."
        actions={
          <Button onClick={() => setParams({ nueva: '1' })}>
            <Plus /> Agregar competencia
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState title="Sin competencias registradas" action={<Button onClick={() => setParams({ nueva: '1' })}><Plus /> Agregar competencia</Button>} />
      ) : (
        <div className="flex flex-col gap-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-[1.4rem]">Próximas y en curso</h2>
              <ul className="flex flex-col gap-3">{upcoming.map((c) => <Item key={c.id} c={c} />)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-[1.4rem]">Anteriores</h2>
              <ul className="flex flex-col gap-3">{past.map((c) => <Item key={c.id} c={c} />)}</ul>
            </section>
          )}
        </div>
      )}
      <CompetitionDialog open={params.get('nueva') === '1'} onOpenChange={(o) => !o && setParams({})} onSaved={(id) => navigate(`/competencias/${id}`)} />
    </div>
  );
}

export function CompetitionDialog({
  open,
  onOpenChange,
  competition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  competition?: Tables<'competitions'>;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({
    name: competition?.name ?? '',
    start_date: competition?.start_date ?? todayISO(),
    end_date: competition?.end_date ?? '',
    location: competition?.location ?? '',
    organizer: competition?.organizer ?? '',
    scope: competition?.scope ?? 'national',
    categories: competition?.categories ?? '',
    notes: competition?.notes ?? '',
  }));
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: f.name.trim(),
        start_date: f.start_date,
        end_date: f.end_date || null,
        location: f.location.trim() || null,
        organizer: f.organizer.trim() || null,
        scope: f.scope,
        categories: f.categories.trim() || null,
        notes: f.notes.trim() || null,
      };
      if (competition) {
        unwrap(await supabase.from('competitions').update(row).eq('id', competition.id));
        return competition.id;
      }
      return unwrap(await supabase.from('competitions').insert(row).select('id').single()).id;
    },
    onSuccess: (id) => {
      toast.success(competition ? 'Competencia actualizada' : 'Competencia agregada');
      void qc.invalidateQueries();
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{competition ? 'Editar competencia' : 'Agregar competencia'}</DialogTitle>
          <DialogDescription>Evento externo: nacional, regional u otro.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="cp-n" required className="sm:col-span-2">
            <Input id="cp-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Fecha de inicio" htmlFor="cp-s" required>
            <Input id="cp-s" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
          </Field>
          <Field label="Fecha de cierre" htmlFor="cp-e">
            <Input id="cp-e" type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          </Field>
          <Field label="Ubicación" htmlFor="cp-l">
            <Input id="cp-l" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <Field label="Organizador" htmlFor="cp-o">
            <Input id="cp-o" value={f.organizer} onChange={(e) => setF({ ...f, organizer: e.target.value })} />
          </Field>
          <Field label="Alcance">
            <Select value={f.scope} onValueChange={(v) => setF({ ...f, scope: v })}>
              <SelectTrigger className="w-full" aria-label="Alcance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCOPE_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Categorías convocadas" htmlFor="cp-c" hint="Ej.: Sub-13, Sub-15">
            <Input id="cp-c" value={f.categories} onChange={(e) => setF({ ...f, categories: e.target.value })} />
          </Field>
          <Field label="Notas" htmlFor="cp-x" className="sm:col-span-2">
            <Textarea id="cp-x" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
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
              if (!f.name.trim()) return setErr('Escribe el nombre.');
              if (!f.start_date) return setErr('Indica la fecha de inicio.');
              if (f.end_date && f.end_date < f.start_date) return setErr('La fecha de cierre no puede ser anterior al inicio.');
              save.mutate();
            }}
          >
            {competition ? 'Guardar cambios' : 'Agregar competencia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

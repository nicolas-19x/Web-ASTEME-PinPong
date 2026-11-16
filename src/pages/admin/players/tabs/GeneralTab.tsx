import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Loader2, Lock, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog, EmptyState, Field, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { addDays, fmtDate, fmtDateTime, HAND_LABEL, pct, playerAge, STATUS_LABEL, todayISO } from '@/lib/format';
import { supabase, unwrap, type Tables } from '@/lib/supabase';

type PlayerRow = Tables<'players'> & { categories: { name: string } | null; levels: { name: string } | null };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-3 border-b py-2.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function GeneralTab({ player }: { player: PlayerRow }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const age = playerAge(player);
  const [rankOpen, setRankOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [note, setNote] = useState('');

  const extra = useQuery({
    queryKey: ['player-general', player.id],
    queryFn: async () => {
      const since = addDays(todayISO(), -90);
      const [att, notes, guardians, groups] = await Promise.all([
        supabase.from('attendance').select('status').eq('player_id', player.id).gte('on_date', since),
        supabase.from('private_notes').select('*').eq('player_id', player.id).eq('entity_type', 'player').order('created_at', { ascending: false }),
        supabase.from('player_guardians').select('id, relationship, authorized, guardians(full_name, phone, email, profile_id)').eq('player_id', player.id),
        supabase.from('group_memberships').select('id, training_groups(id, name)').eq('player_id', player.id).is('end_date', null),
      ]);
      return { att: unwrap(att), notes: unwrap(notes), guardians: unwrap(guardians), groups: unwrap(groups) };
    },
  });

  const addNote = useMutation({
    mutationFn: async () => unwrap(await supabase.from('private_notes').insert({ player_id: player.id, body: note.trim(), created_by: profile?.id })),
    onSuccess: () => {
      setNote('');
      toast.success('Nota guardada');
      void qc.invalidateQueries({ queryKey: ['player-general', player.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async () =>
      unwrap(await supabase.from('players').update({ status: player.status === 'archived' ? 'active' : 'archived' }).eq('id', player.id)),
    onSuccess: () => {
      toast.success(player.status === 'archived' ? 'Expediente reactivado' : 'Expediente archivado. Su historial se conserva.');
      setArchiveOpen(false);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  const att = extra.data?.att ?? [];
  const present = att.filter((a) => a.status === 'present').length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Panel title="Datos del jugador">
          <dl>
            <Row label="Fecha de nacimiento">{player.birth_date ? fmtDate(player.birth_date, { day: 'numeric', month: 'long', year: 'numeric' }) : <span className="text-muted-foreground">Sin registrar</span>}</Row>
            <Row label="Edad">
              {age.label}
              {age.approximate && player.age_reported_on && (
                <span className="block text-xs text-muted-foreground">Edad informada el {fmtDate(player.age_reported_on)}; registra la fecha de nacimiento para calcularla.</span>
              )}
            </Row>
            <Row label="Categoría">{player.categories?.name ?? 'Sin categoría'}</Row>
            <Row label="Nivel">{player.levels?.name ?? <span className="text-muted-foreground">Sin definir</span>}</Row>
            <Row label="Mano dominante">{player.dominant_hand ? HAND_LABEL[player.dominant_hand] : <span className="text-muted-foreground">Sin definir</span>}</Row>
            <Row label="Fecha de ingreso">{player.join_date ? fmtDate(player.join_date) : <span className="text-muted-foreground">Sin registrar</span>}</Row>
            <Row label="Estado">{STATUS_LABEL[player.status]}</Row>
            <Row label="Grupos">
              {extra.data?.groups.length ? extra.data.groups.map((g) => g.training_groups?.name).join(', ') : <span className="text-muted-foreground">Sin grupo</span>}
            </Row>
            <Row label="Foto">{player.photo_path ? 'Autorizada y guardada' : player.photo_authorized ? 'Autorizada, sin foto' : 'Sin autorización'}</Row>
          </dl>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" aria-hidden /> Notas internas
            </span>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">Privadas: no las ven el jugador ni su familia.</p>
          <form
            className="mb-4 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim()) addNote.mutate();
            }}
          >
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Nueva nota interna" placeholder="Escribe una anotación" />
            <Button type="submit" variant="outline" className="self-start" disabled={!note.trim() || addNote.isPending}>
              Guardar nota
            </Button>
          </form>
          {extra.data?.notes.length ? (
            <ul className="flex flex-col gap-3">
              {extra.data.notes.map((n) => (
                <li key={n.id} className="border-l-2 border-table/40 pl-3">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin anotaciones.</p>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel
          title="Ranking interno"
          action={
            <Button size="sm" variant="outline" onClick={() => setRankOpen(true)}>
              <TrendingUp /> Ajustar
            </Button>
          }
        >
          {player.ranking_points == null ? (
            <p className="text-muted-foreground">Sin puntos asignados. En los torneos se ubica por sorteo u orden manual.</p>
          ) : (
            <p>
              <span className="numeral text-[3rem] leading-none">{player.ranking_points}</span> <span className="text-muted-foreground">puntos</span>
            </p>
          )}
          <Link to="?tab=historial" className="mt-2 inline-block text-sm font-semibold underline-offset-4 hover:underline">
            Ver movimientos de ranking
          </Link>
        </Panel>

        <Panel title="Asistencia (últimos 90 días)">
          {att.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros de asistencia en este periodo.</p>
          ) : (
            <div className="flex items-end gap-6">
              <p>
                <span className="numeral text-[2.6rem] leading-none">{pct(present, att.length)}</span>
              </p>
              <p className="pb-1 text-sm text-muted-foreground">
                {present} presentes, {att.filter((a) => a.status === 'excused').length} justificadas, {att.filter((a) => a.status === 'absent').length} ausencias
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Familia y acceso">
          {player.user_id ? <p className="mb-3 text-sm">El jugador tiene cuenta de acceso propia.</p> : <p className="mb-3 text-sm text-muted-foreground">Sin cuenta de acceso propia.</p>}
          {extra.data?.guardians.length ? (
            <ul className="flex flex-col gap-2">
              {extra.data.guardians.map((g) => (
                <li key={g.id} className="text-sm">
                  <span className="font-semibold">{g.guardians?.full_name}</span>
                  {g.relationship ? `, ${g.relationship}` : ''}
                  {!g.authorized && <span className="text-warning"> (vínculo no autorizado)</span>}
                  <span className="block text-muted-foreground">{[g.guardians?.phone, g.guardians?.email].filter(Boolean).join(', ') || 'Sin contacto'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin encargados vinculados">Los vínculos se administran en Configuración, en Cuentas y vínculos.</EmptyState>
          )}
          <Button asChild variant="link" className="mt-2 h-auto px-0">
            <Link to="/configuracion?tab=cuentas">Gestionar cuentas y vínculos</Link>
          </Button>
        </Panel>

        <Button variant="outline" className="self-start" onClick={() => setArchiveOpen(true)}>
          {player.status === 'archived' ? <ArchiveRestore /> : <Archive />}
          {player.status === 'archived' ? 'Reactivar expediente' : 'Archivar expediente'}
        </Button>
      </div>

      <RankingDialog open={rankOpen} onOpenChange={setRankOpen} playerId={player.id} current={player.ranking_points} />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={player.status === 'archived' ? '¿Reactivar expediente?' : '¿Archivar expediente?'}
        description={
          player.status === 'archived'
            ? 'El jugador volverá a aparecer en listados, torneos y asistencia.'
            : 'El jugador dejará de aparecer en listados activos, torneos y asistencia. Su historial completo se conserva y puedes reactivarlo cuando quieras.'
        }
        confirmLabel={player.status === 'archived' ? 'Reactivar' : 'Archivar'}
        onConfirm={() => archive.mutate()}
        busy={archive.isPending}
      />
    </div>
  );
}

export function RankingDialog({
  open,
  onOpenChange,
  playerId,
  current,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  playerId: string;
  current: number | null;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      const v = value.trim() === '' ? null : Number(value.replace(',', '.'));
      unwrap(await supabase.from('ranking_movements').insert({ player_id: playerId, new_value: v, reason: reason.trim() }));
    },
    onSuccess: () => {
      toast.success('Ranking actualizado');
      setValue('');
      setReason('');
      onOpenChange(false);
      void qc.invalidateQueries();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar ranking</DialogTitle>
          <DialogDescription>Valor actual: {current ?? 'sin ranking'}. Se guarda el cambio con su motivo en el historial.</DialogDescription>
        </DialogHeader>
        <form
          id="rank-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            if (value.trim() !== '' && !Number.isFinite(Number(value.replace(',', '.')))) return setErr('Escribe un número válido.');
            if (Number(value.replace(',', '.')) < 0) return setErr('El ranking no puede ser negativo.');
            if (!reason.trim()) return setErr('Indica el motivo del cambio.');
            m.mutate();
          }}
        >
          <Field label="Nuevo valor" htmlFor="rk-v" hint="Déjalo vacío para quitar el ranking.">
            <Input id="rk-v" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Motivo" htmlFor="rk-r" required>
            <Input id="rk-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: resultado del torneo de noviembre" />
          </Field>
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
          <Button type="submit" form="rank-form" disabled={m.isPending}>
            {m.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Guardar ranking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

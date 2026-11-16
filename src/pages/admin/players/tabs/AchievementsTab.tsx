import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Flame, Medal, Plus, Star, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog, EmptyState, ErrorState, Field, Loading } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDate, todayISO } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';

export const ACH_KIND: Record<string, string> = {
  medal: 'Medalla',
  championship: 'Campeonato',
  streak: 'Racha',
  distinction: 'Distinción',
  other: 'Reconocimiento',
};
const MEDAL_COLOR: Record<string, string> = { gold: '#D4A017', silver: '#A7B1BE', bronze: '#B8733C' };

export function AchievementIcon({ kind, medal }: { kind: string; medal?: string | null }) {
  const color = medal ? MEDAL_COLOR[medal] : undefined;
  const cls = 'size-6';
  const icon =
    kind === 'championship' ? <Trophy className={cls} /> : kind === 'medal' ? <Medal className={cls} /> : kind === 'streak' ? <Flame className={cls} /> : kind === 'distinction' ? <Star className={cls} /> : <Award className={cls} />;
  return (
    <span
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: color ? `${color}26` : 'color-mix(in oklab, var(--brand-ball) 16%, transparent)', color: color ?? 'var(--brand-ball)' }}
      aria-hidden
    >
      {icon}
    </span>
  );
}

export function AchievementsTab({ playerId, admin = true }: { playerId: string; admin?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['achievements', playerId],
    queryFn: async () => unwrap(await supabase.from('player_achievements').select('*').eq('player_id', playerId).order('awarded_on', { ascending: false })),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('player_achievements').delete().eq('id', id)),
    onSuccess: () => {
      setDel(null);
      toast.success('Logro eliminado');
      void qc.invalidateQueries({ queryKey: ['achievements', playerId] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  const list = data ?? [];
  return (
    <div className="flex flex-col gap-6">
      {admin && (
        <Button className="self-start" onClick={() => setOpen(true)}>
          <Plus /> Otorgar reconocimiento
        </Button>
      )}
      {list.length === 0 ? (
        <EmptyState title="Sin logros todavía">
          {admin ? 'Las medallas de torneos internos se agregan solas al cerrar el torneo. También puedes otorgar distinciones como jugador del mes.' : 'Aquí aparecerán medallas, campeonatos y distinciones.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <AchievementIcon kind={a.kind} medal={a.medal} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.title}</span>
                <span className="text-sm text-muted-foreground">
                  {ACH_KIND[a.kind]}, {fmtDate(a.awarded_on)}
                  {admin && !a.shared ? ', no visible en portales' : ''}
                </span>
                {a.description && <span className="block text-sm">{a.description}</span>}
              </span>
              {admin && (
                <Button variant="ghost" size="icon-sm" aria-label="Eliminar logro" onClick={() => setDel(a.id)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {admin && <AchievementDialog open={open} onOpenChange={setOpen} playerIds={[playerId]} />}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="¿Eliminar logro?"
        description="Se quitará del expediente y de los portales."
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

export function AchievementDialog({
  open,
  onOpenChange,
  playerIds,
  defaultKind = 'distinction',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  playerIds: string[];
  defaultKind?: string;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState(defaultKind);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayISO());
  const [medal, setMedal] = useState('none');
  const [shared, setShared] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.from('player_achievements').insert(
          playerIds.map((player_id) => ({
            player_id,
            kind,
            title: title.trim(),
            description: desc.trim() || null,
            awarded_on: date,
            medal: medal === 'none' ? null : medal,
            source_type: 'manual',
            shared,
          })),
        ),
      ),
    onSuccess: () => {
      toast.success('Reconocimiento otorgado');
      setTitle('');
      setDesc('');
      onOpenChange(false);
      void qc.invalidateQueries();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Otorgar reconocimiento</DialogTitle>
          <DialogDescription>Distinciones como jugador del mes o mayor esfuerzo, rachas o logros especiales.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Tipo">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-full" aria-label="Tipo de reconocimiento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACH_KIND).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título" htmlFor="ac-t" required>
            <Input id="ac-t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Jugador del mes, noviembre" />
          </Field>
          <Field label="Descripción" htmlFor="ac-d">
            <Input id="ac-d" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha" htmlFor="ac-f">
              <Input id="ac-f" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Medalla">
              <Select value={medal} onValueChange={setMedal}>
                <SelectTrigger className="w-full" aria-label="Medalla">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  <SelectItem value="gold">Oro</SelectItem>
                  <SelectItem value="silver">Plata</SelectItem>
                  <SelectItem value="bronze">Bronce</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={shared} onCheckedChange={(c) => setShared(c === true)} className="size-5" /> Mostrar en el portal del jugador y su familia
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
          <Button
            disabled={save.isPending}
            onClick={() => {
              setErr(null);
              if (!title.trim()) return setErr('Escribe un título.');
              if (!playerIds.length) return setErr('Elige al menos un jugador.');
              save.mutate();
            }}
          >
            Otorgar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

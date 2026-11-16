import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ImagePlus, Megaphone, Pencil, Plus, Save, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Chip, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDate, fullName } from '@/lib/format';
import { usePlayers } from '@/lib/queries';
import { signedUrl, STORAGE, supabase, unwrap, unwrapMaybe, type Tables } from '@/lib/supabase';
import { CompetitionDialog, SCOPE_LABEL } from './Competitions';

type Part = Tables<'competition_participants'> & { players: { id: string; first_name: string; last_names: string | null } | null };

export default function CompetitionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [del, setDel] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['competition', id],
    queryFn: async () => {
      const [c, p, ph] = await Promise.all([
        supabase.from('competitions').select('*').eq('id', id).maybeSingle(),
        supabase.from('competition_participants').select('*, players(id, first_name, last_names)').eq('competition_id', id),
        supabase.from('competition_photos').select('*').eq('competition_id', id).order('created_at'),
      ]);
      return { c: unwrapMaybe(c), parts: unwrap(p) as Part[], photos: unwrap(ph) };
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      const paths = data?.photos.map((p) => p.storage_path) ?? [];
      if (paths.length) await supabase.storage.from(STORAGE.competitionPhotos).remove(paths);
      unwrap(await supabase.from('player_achievements').delete().eq('source_type', 'competition').eq('source_id', id));
      unwrap(await supabase.from('competitions').delete().eq('id', id));
    },
    onSuccess: () => {
      toast.success('Competencia eliminada');
      void qc.invalidateQueries();
      navigate('/competencias');
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  if (!data?.c) return <p>No se encontró la competencia.</p>;
  const c = data.c;
  const parts = [...data.parts].sort((a, b) => (a.final_position ?? 999) - (b.final_position ?? 999) || (a.players?.first_name ?? '').localeCompare(b.players?.first_name ?? ''));

  return (
    <div>
      <Link to="/competencias" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Competencias
      </Link>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Chip tone="ball">{SCOPE_LABEL[c.scope]}</Chip>
          <h1 className="mt-2 text-[2.2rem] sm:text-[2.6rem]">{c.name}</h1>
          <p className="text-muted-foreground">
            {fmtDate(c.start_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {c.end_date && c.end_date !== c.start_date ? ` al ${fmtDate(c.end_date)}` : ''}
            {c.location ? `, ${c.location}` : ''}
          </p>
          {(c.organizer || c.categories) && (
            <p className="text-sm text-muted-foreground">
              {c.organizer ? `Organiza: ${c.organizer}. ` : ''}
              {c.categories ? `Categorías: ${c.categories}.` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/comunicados?nuevo=1&convocatoria=${c.id}`}>
              <Megaphone /> Publicar convocatoria
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setEdit(true)}>
            <Pencil /> Editar
          </Button>
          <Button variant="ghost" onClick={() => setDel(true)} aria-label="Eliminar competencia">
            <Trash2 />
          </Button>
        </div>
      </header>

      <Panel
        title="Convocados y resultados"
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus /> Convocar
          </Button>
        }
        bodyClassName="p-0 sm:p-0"
      >
        {parts.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState title="Sin convocados">Convoca jugadores y marca quiénes quedaron inscritos; después registra sus resultados.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y">
            {parts.map((p) => (
              <ParticipantRow key={p.id} p={p} competition={c} />
            ))}
          </ul>
        )}
      </Panel>

      <Gallery competitionId={c.id} photos={data.photos} />

      {edit && <CompetitionDialog open onOpenChange={setEdit} competition={c} />}
      {addOpen && <AddParticipants competitionId={c.id} existing={parts.map((p) => p.player_id)} onClose={() => setAddOpen(false)} />}
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title="¿Eliminar competencia?"
        description="Se borrarán sus convocados, resultados, medallas asociadas y fotos."
        confirmLabel="Eliminar"
        destructive
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

function ParticipantRow({ p, competition }: { p: Part; competition: Tables<'competitions'> }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    registered: p.registered,
    category_label: p.category_label ?? '',
    final_position: p.final_position?.toString() ?? '',
    matches_won: p.matches_won?.toString() ?? '',
    matches_lost: p.matches_lost?.toString() ?? '',
    sets_won: p.sets_won?.toString() ?? '',
    sets_lost: p.sets_lost?.toString() ?? '',
    medal: p.medal ?? 'none',
    recognition: p.recognition ?? '',
    notes: p.notes ?? '',
  });
  const [dirty, setDirty] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => setDirty(false), [p]);
  const set = (k: keyof typeof f, v: string | boolean) => {
    setF({ ...f, [k]: v });
    setDirty(true);
  };
  const int = (v: string) => (v.trim() === '' ? null : Math.max(0, parseInt(v, 10) || 0));
  const save = useMutation({
    mutationFn: async () => {
      const medal = f.medal === 'none' ? null : f.medal;
      unwrap(
        await supabase
          .from('competition_participants')
          .update({
            registered: f.registered,
            category_label: f.category_label.trim() || null,
            final_position: f.final_position.trim() === '' ? null : Math.max(1, parseInt(f.final_position, 10) || 1),
            matches_won: int(f.matches_won),
            matches_lost: int(f.matches_lost),
            sets_won: int(f.sets_won),
            sets_lost: int(f.sets_lost),
            medal,
            recognition: f.recognition.trim() || null,
            notes: f.notes.trim() || null,
          })
          .eq('id', p.id),
      );
      // Medalla y reconocimiento → logros del expediente, sin duplicar.
      unwrap(await supabase.from('player_achievements').delete().eq('player_id', p.player_id).eq('source_type', 'competition').eq('source_id', competition.id));
      const rows = [];
      if (medal)
        rows.push({
          player_id: p.player_id,
          kind: f.final_position === '1' ? 'championship' : 'medal',
          title: `${medal === 'gold' ? 'Oro' : medal === 'silver' ? 'Plata' : 'Bronce'} en ${competition.name}`,
          awarded_on: competition.end_date ?? competition.start_date,
          medal,
          source_type: 'competition',
          source_id: competition.id,
        });
      if (f.recognition.trim())
        rows.push({
          player_id: p.player_id,
          kind: 'distinction',
          title: `${f.recognition.trim()} (${competition.name})`,
          awarded_on: competition.end_date ?? competition.start_date,
          source_type: 'competition',
          source_id: competition.id,
        });
      if (rows.length) unwrap(await supabase.from('player_achievements').insert(rows));
    },
    onSuccess: () => {
      toast.success('Resultado guardado en el expediente');
      setDirty(false);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      unwrap(await supabase.from('player_achievements').delete().eq('player_id', p.player_id).eq('source_type', 'competition').eq('source_id', competition.id));
      unwrap(await supabase.from('competition_participants').delete().eq('id', p.id));
    },
    onSuccess: () => void qc.invalidateQueries(),
    onError: (e) => toast.error(e.message),
  });
  const name = p.players ? fullName(p.players) : '';
  return (
    <li className="p-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Link to={`/jugadores/${p.player_id}`} className="font-semibold hover:underline">
          {name}
        </Link>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={f.registered} onCheckedChange={(v) => set('registered', v === true)} className="size-5" /> Inscrito
        </label>
        {!f.registered && <Chip>Convocado</Chip>}
        <span className="flex-1" />
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          <Save /> Guardar
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Quitar a ${name}`} onClick={() => setConfirmDel(true)}>
          <Trash2 />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Field label="Categoría" htmlFor={`cl-${p.id}`} className="col-span-2">
          <Input id={`cl-${p.id}`} value={f.category_label} onChange={(e) => set('category_label', e.target.value)} />
        </Field>
        <Field label="Posición" htmlFor={`fp-${p.id}`}>
          <Input id={`fp-${p.id}`} inputMode="numeric" value={f.final_position} onChange={(e) => set('final_position', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Partidos G" htmlFor={`mw-${p.id}`}>
          <Input id={`mw-${p.id}`} inputMode="numeric" value={f.matches_won} onChange={(e) => set('matches_won', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Partidos P" htmlFor={`ml-${p.id}`}>
          <Input id={`ml-${p.id}`} inputMode="numeric" value={f.matches_lost} onChange={(e) => set('matches_lost', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Sets G" htmlFor={`sw-${p.id}`}>
          <Input id={`sw-${p.id}`} inputMode="numeric" value={f.sets_won} onChange={(e) => set('sets_won', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Sets P" htmlFor={`sl-${p.id}`}>
          <Input id={`sl-${p.id}`} inputMode="numeric" value={f.sets_lost} onChange={(e) => set('sets_lost', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Medalla">
          <Select value={f.medal} onValueChange={(v) => set('medal', v)}>
            <SelectTrigger className="w-full" aria-label={`Medalla de ${name}`}>
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
        <Field label="Reconocimiento" htmlFor={`rc-${p.id}`} className="col-span-2 sm:col-span-4">
          <Input id={`rc-${p.id}`} value={f.recognition} onChange={(e) => set('recognition', e.target.value)} placeholder="Ej.: Jugador revelación" />
        </Field>
        <Field label="Observaciones internas" htmlFor={`nt-${p.id}`} className="col-span-2 sm:col-span-4">
          <Input id={`nt-${p.id}`} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`¿Quitar a ${name}?`}
        description="Se borran su convocatoria y su resultado en esta competencia."
        confirmLabel="Quitar"
        destructive
        onConfirm={() => remove.mutate()}
        busy={remove.isPending}
      />
    </li>
  );
}

function AddParticipants({ competitionId, existing, onClose }: { competitionId: string; existing: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: players = [] } = usePlayers();
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const list = players.filter((p) => p.status === 'active' && !existing.includes(p.id) && fullName(p).toLowerCase().includes(q.toLowerCase()));
  const save = useMutation({
    mutationFn: async () => unwrap(await supabase.from('competition_participants').insert(sel.map((player_id) => ({ competition_id: competitionId, player_id, called_up: true })))),
    onSuccess: () => {
      toast.success(`${sel.length} jugador(es) convocado(s)`);
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convocar jugadores</DialogTitle>
          <DialogDescription>Elige a los convocados. Luego podrás marcar quiénes quedaron inscritos.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar jugador" />
        <ul className="flex flex-col divide-y">
          {list.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <Checkbox checked={sel.includes(p.id)} onCheckedChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="size-5" />
                <span className="flex-1">{fullName(p)}</span>
                <span className="text-sm text-muted-foreground">{p.categories?.name}</span>
              </label>
            </li>
          ))}
          {!list.length && <li className="py-4 text-sm text-muted-foreground">No quedan jugadores activos por convocar.</li>}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!sel.length || save.isPending}>
            <Plus /> Convocar {sel.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Gallery({ competitionId, photos }: { competitionId: string; photos: Tables<'competition_photos'>[] }) {
  const qc = useQueryClient();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    void Promise.all(photos.map(async (p) => [p.id, await signedUrl(STORAGE.competitionPhotos, p.storage_path)] as const)).then((pairs) =>
      setUrls(Object.fromEntries(pairs.filter(([, u]) => u) as [string, string][])),
    );
  }, [photos]);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Elige una foto.');
      if (!authorized) throw new Error('Confirma que la foto cuenta con autorización.');
      if (file.size > 8 * 1024 * 1024) throw new Error('La foto supera 8 MB.');
      const path = `${competitionId}/${Date.now()}.${file.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
      const up = await supabase.storage.from(STORAGE.competitionPhotos).upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);
      unwrap(await supabase.from('competition_photos').insert({ competition_id: competitionId, storage_path: path, caption: caption.trim() || null, authorized: true }));
    },
    onSuccess: () => {
      toast.success('Foto agregada a la galería');
      setFile(null);
      setCaption('');
      setAuthorized(false);
      void qc.invalidateQueries({ queryKey: ['competition', competitionId] });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (p: Tables<'competition_photos'>) => {
      await supabase.storage.from(STORAGE.competitionPhotos).remove([p.storage_path]);
      unwrap(await supabase.from('competition_photos').delete().eq('id', p.id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['competition', competitionId] }),
    onError: (e) => toast.error(e.message),
  });
  return (
    <Panel title="Galería (opcional)" className="mt-6">
      <p className="mb-3 text-sm text-muted-foreground">Solo fotografías de menores con autorización de sus familias. Se guardan en almacenamiento privado.</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Foto" htmlFor="gal-f">
          <Input id="gal-f" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="pt-2" />
        </Field>
        <Field label="Descripción" htmlFor="gal-c">
          <Input id="gal-c" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </Field>
        <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
          <ImagePlus /> Subir
        </Button>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <Checkbox checked={authorized} onCheckedChange={(c) => setAuthorized(c === true)} className="size-5" /> Todas las personas menores que aparecen tienen autorización
        </label>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin fotos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border">
              {urls[p.id] ? <img src={urls[p.id]} alt={p.caption ?? 'Foto de la competencia'} className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="aspect-[4/3] bg-muted" />}
              <div className="flex items-center gap-2 p-2">
                <span className="flex-1 truncate text-sm">{p.caption}</span>
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar foto" onClick={() => remove.mutate(p)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

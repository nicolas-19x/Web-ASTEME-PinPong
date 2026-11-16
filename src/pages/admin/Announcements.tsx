import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Chip, ConfirmDialog, EmptyState, ErrorState, Field, Loading, PageHeader } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { useCategories, useGroups } from '@/lib/queries';
import { supabase, unwrap, type Tables } from '@/lib/supabase';

export const KIND_LABEL: Record<string, string> = {
  general: 'Anuncio general',
  schedule_change: 'Cambio de horario',
  call_up: 'Convocatoria',
  result: 'Resultado destacado',
  reminder: 'Recordatorio',
};

type Ann = Tables<'announcements'> & { categories: { name: string } | null; training_groups: { name: string } | null; announcement_reads: { count: number }[] };

export default function Announcements() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Ann | 'new' | null>(null);
  const [del, setDel] = useState<Ann | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['announcements', 'admin'],
    queryFn: async () =>
      unwrap(await supabase.from('announcements').select('*, categories(name), training_groups(name), announcement_reads(count)').order('created_at', { ascending: false })) as Ann[],
  });
  useEffect(() => {
    if (params.get('nuevo') === '1') setEditing('new');
  }, [params]);
  const toggle = useMutation({
    mutationFn: async (a: Ann) => unwrap(await supabase.from('announcements').update({ published: !a.published }).eq('id', a.id)),
    onSuccess: (_, a) => {
      toast.success(a.published ? 'Comunicado retirado de los portales' : 'Comunicado publicado');
      void qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('announcements').delete().eq('id', id)),
    onSuccess: () => {
      setDel(null);
      toast.success('Comunicado eliminado');
      void qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
  const audience = (a: Ann) =>
    `${a.to_players && a.to_guardians ? 'Jugadores y familias' : a.to_players ? 'Solo jugadores' : 'Solo familias'}, ${a.scope === 'all' ? 'toda la academia' : a.scope === 'category' ? `categoría ${a.categories?.name}` : `grupo ${a.training_groups?.name}`}`;

  return (
    <div>
      <PageHeader
        title="Comunicados"
        description="Avisos oficiales de la academia. Solo el entrenador publica; no hay comentarios ni mensajes entre usuarios."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Publicar comunicado
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState icon={<Megaphone />} title="Sin comunicados" action={<Button onClick={() => setEditing('new')}><Plus /> Publicar comunicado</Button>}>
          Cambios de horario, convocatorias, resultados destacados y recordatorios.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((a) => (
            <li key={a.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Chip tone={a.published ? 'success' : 'neutral'}>{a.published ? 'Publicado' : 'Borrador'}</Chip>
                    <Chip tone="info">{KIND_LABEL[a.kind]}</Chip>
                    <span className="text-sm text-muted-foreground">{a.published_at ? fmtDateTime(a.published_at) : `Creado ${fmtDate(a.created_at)}`}</span>
                  </div>
                  <h2 className="text-[1.35rem]">{a.title}</h2>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[0.95rem]">{a.body}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Para: {audience(a)}
                    {a.published ? `. Leído por ${a.announcement_reads[0]?.count ?? 0} cuenta(s).` : '.'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant={a.published ? 'outline' : 'default'} onClick={() => toggle.mutate(a)}>
                    {a.published ? <Undo2 /> : <Send />} {a.published ? 'Retirar' : 'Publicar'}
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Editar comunicado" onClick={() => setEditing(a)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Eliminar comunicado" onClick={() => setDel(a)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <AnnouncementDialog
          ann={editing === 'new' ? null : editing}
          competitionId={editing === 'new' ? params.get('convocatoria') : null}
          onClose={() => {
            setEditing(null);
            if (params.size) setParams({}, { replace: true });
          }}
        />
      )}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="¿Eliminar comunicado?"
        description="Desaparecerá de los portales y no se puede recuperar."
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

function AnnouncementDialog({ ann, competitionId, onClose }: { ann: Ann | null; competitionId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const [f, setF] = useState({
    title: ann?.title ?? '',
    body: ann?.body ?? '',
    kind: ann?.kind ?? 'general',
    scope: ann?.scope ?? 'all',
    category_id: ann?.category_id ?? '',
    group_id: ann?.group_id ?? '',
    to_players: ann?.to_players ?? true,
    to_guardians: ann?.to_guardians ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const comp = useQuery({
    queryKey: ['competition-prefill', competitionId],
    enabled: !!competitionId,
    queryFn: async () => unwrap(await supabase.from('competitions').select('*').eq('id', competitionId!).single()),
  });
  useEffect(() => {
    const c = comp.data;
    if (c && !f.title)
      setF((x) => ({
        ...x,
        kind: 'call_up',
        title: `Convocatoria: ${c.name}`,
        body: `Competencia: ${c.name}\nFecha: ${fmtDate(c.start_date, { weekday: 'long', day: 'numeric', month: 'long' })}${c.end_date && c.end_date !== c.start_date ? ` al ${fmtDate(c.end_date)}` : ''}\n${c.location ? `Lugar: ${c.location}\n` : ''}${c.categories ? `Categorías: ${c.categories}\n` : ''}\nLas familias de los jugadores convocados recibirán los detalles de inscripción.`,
      }));
  }, [comp.data, f.title]);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const row = {
        title: f.title.trim(),
        body: f.body.trim(),
        kind: f.kind,
        scope: f.scope,
        category_id: f.scope === 'category' ? f.category_id : null,
        group_id: f.scope === 'group' ? f.group_id : null,
        to_players: f.to_players,
        to_guardians: f.to_guardians,
        published: publish,
      };
      if (ann) unwrap(await supabase.from('announcements').update(row).eq('id', ann.id));
      else unwrap(await supabase.from('announcements').insert(row));
    },
    onSuccess: (_, publish) => {
      toast.success(publish ? 'Comunicado publicado' : 'Borrador guardado');
      void qc.invalidateQueries({ queryKey: ['announcements'] });
      onClose();
    },
    onError: (e) => setErr(e.message),
  });
  const submit = (publish: boolean) => {
    setErr(null);
    if (!f.title.trim()) return setErr('Escribe un título.');
    if (!f.body.trim()) return setErr('Escribe el contenido.');
    if (!f.to_players && !f.to_guardians) return setErr('Elige al menos un destinatario: jugadores o familias.');
    if (f.scope === 'category' && !f.category_id) return setErr('Elige la categoría.');
    if (f.scope === 'group' && !f.group_id) return setErr('Elige el grupo.');
    save.mutate(publish);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{ann ? 'Editar comunicado' : 'Nuevo comunicado'}</DialogTitle>
          <DialogDescription>Se muestra con título y fecha en los portales de los destinatarios elegidos.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Tipo">
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger className="w-full" aria-label="Tipo de comunicado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título" htmlFor="an-t" required>
            <Input id="an-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Contenido" htmlFor="an-b" required>
            <Textarea id="an-b" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
          <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">Destinatarios</legend>
            <Field label="Alcance">
              <Select value={f.scope} onValueChange={(v) => setF({ ...f, scope: v })}>
                <SelectTrigger className="w-full" aria-label="Alcance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda la academia</SelectItem>
                  <SelectItem value="category">Una categoría</SelectItem>
                  <SelectItem value="group">Un grupo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {f.scope === 'category' && (
              <Field label="Categoría">
                <Select value={f.category_id} onValueChange={(v) => setF({ ...f, category_id: v })}>
                  <SelectTrigger className="w-full" aria-label="Categoría">
                    <SelectValue placeholder="Elige" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {f.scope === 'group' && (
              <Field label="Grupo">
                <Select value={f.group_id} onValueChange={(v) => setF({ ...f, group_id: v })}>
                  <SelectTrigger className="w-full" aria-label="Grupo">
                    <SelectValue placeholder="Elige" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={f.to_players} onCheckedChange={(c) => setF({ ...f, to_players: c === true })} className="size-5" /> Jugadores
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={f.to_guardians} onCheckedChange={(c) => setF({ ...f, to_guardians: c === true })} className="size-5" /> Padres y encargados
            </label>
          </fieldset>
          {err && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={save.isPending}>
            Guardar borrador
          </Button>
          <Button onClick={() => submit(true)} disabled={save.isPending}>
            <Send /> Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

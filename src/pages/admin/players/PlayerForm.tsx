import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Field } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { todayISO } from '@/lib/format';
import { useCategories, useLevels } from '@/lib/queries';
import { STORAGE, supabase, unwrap, type Tables } from '@/lib/supabase';

const NONE = '__none__';

const schema = z
  .object({
    first_name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
    last_names: z.string().trim().max(80).optional(),
    birth_date: z
      .string()
      .optional()
      .refine((v) => !v || v <= todayISO(), 'La fecha de nacimiento no puede ser futura'),
    age_reported: z
      .string()
      .optional()
      .refine((v) => !v || (/^\d+$/.test(v) && +v >= 3 && +v <= 99), 'Edad entre 3 y 99'),
    category_id: z.string().min(1, 'Asigna una categoría'),
    level_id: z.string().optional(),
    dominant_hand: z.string().optional(),
    join_date: z
      .string()
      .optional()
      .refine((v) => !v || v <= todayISO(), 'La fecha de ingreso no puede ser futura'),
    status: z.enum(['active', 'inactive', 'archived']),
    photo_authorized: z.boolean(),
    notes: z.string().max(2000).optional(),
  });
type Values = z.infer<typeof schema>;

export function PlayerFormDialog({
  open,
  onOpenChange,
  player,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  player?: Tables<'players'> | null;
  onSaved?: (id: string) => void;
}) {
  const editing = !!player;
  const { data: categories = [] } = useCategories();
  const { data: levels = [] } = useLevels();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      first_name: player?.first_name ?? '',
      last_names: player?.last_names ?? '',
      birth_date: player?.birth_date ?? '',
      age_reported: player?.age_reported?.toString() ?? '',
      category_id: player?.category_id ?? '',
      level_id: player?.level_id ?? NONE,
      dominant_hand: player?.dominant_hand ?? NONE,
      join_date: player?.join_date ?? '',
      status: (player?.status as Values['status']) ?? 'active',
      photo_authorized: player?.photo_authorized ?? false,
      notes: '',
    },
  });
  const { register, handleSubmit, control, formState, watch } = form;
  const errors = formState.errors;
  const birth = watch('birth_date');

  const submit = handleSubmit(async (v) => {
    if (photo && photo.size > 5 * 1024 * 1024) {
      toast.error('La foto supera 5 MB.');
      return;
    }
    if (photo && !v.photo_authorized) {
      toast.error('Marca que la foto cuenta con autorización antes de subirla.');
      return;
    }
    setBusy(true);
    try {
      const ageChanged = (v.age_reported || null) !== (player?.age_reported?.toString() ?? null);
      const row = {
        first_name: v.first_name.trim(),
        last_names: v.last_names?.trim() || null,
        birth_date: v.birth_date || null,
        age_reported: v.birth_date ? null : v.age_reported ? Number(v.age_reported) : null,
        age_reported_on: v.birth_date || !v.age_reported ? null : ageChanged ? todayISO() : (player?.age_reported_on ?? todayISO()),
        category_id: v.category_id,
        level_id: v.level_id && v.level_id !== NONE ? v.level_id : null,
        dominant_hand: v.dominant_hand && v.dominant_hand !== NONE ? v.dominant_hand : null,
        join_date: v.join_date || null,
        status: v.status,
        photo_authorized: v.photo_authorized,
      };
      let id = player?.id;
      if (editing) {
        unwrap(await supabase.from('players').update(row).eq('id', id!));
      } else {
        const created = unwrap(await supabase.from('players').insert(row).select('id').single());
        id = created.id;
      }
      if (photo && id) {
        const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from(STORAGE.playerPhotos).upload(path, photo, { contentType: photo.type, upsert: false });
        if (up.error) throw new Error(`La ficha se guardó, pero la foto no: ${up.error.message}`);
        if (player?.photo_path) await supabase.storage.from(STORAGE.playerPhotos).remove([player.photo_path]);
        unwrap(await supabase.from('players').update({ photo_path: path }).eq('id', id));
      }
      if (!v.photo_authorized && player?.photo_path) {
        // Si se retira la autorización, se elimina la foto almacenada.
        await supabase.storage.from(STORAGE.playerPhotos).remove([player.photo_path]);
        unwrap(await supabase.from('players').update({ photo_path: null }).eq('id', id!));
      }
      if (v.notes?.trim() && id) {
        unwrap(await supabase.from('private_notes').insert({ player_id: id, body: v.notes.trim(), created_by: profile?.id }));
      }
      await qc.invalidateQueries();
      toast.success(editing ? 'Ficha actualizada' : 'Jugador registrado');
      setPhoto(null);
      onOpenChange(false);
      if (id) onSaved?.(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[1.6rem]">{editing ? 'Editar ficha' : 'Registrar jugador'}</DialogTitle>
          <DialogDescription>Completa solo los datos que conoces. La categoría la asignas tú: no cambia sola con la edad.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate id="player-form">
          <Field label="Nombre" htmlFor="pf-first" required error={errors.first_name?.message}>
            <Input id="pf-first" autoComplete="off" aria-invalid={!!errors.first_name} {...register('first_name')} />
          </Field>
          <Field label="Apellidos" htmlFor="pf-last" error={errors.last_names?.message}>
            <Input id="pf-last" autoComplete="off" {...register('last_names')} />
          </Field>
          <Field label="Fecha de nacimiento" htmlFor="pf-birth" error={errors.birth_date?.message}>
            <Input id="pf-birth" type="date" max={todayISO()} {...register('birth_date')} />
          </Field>
          <Field
            label="Edad informada"
            htmlFor="pf-age"
            error={errors.age_reported?.message}
            hint={birth ? 'Con fecha de nacimiento, la edad se calcula sola.' : 'Úsala solo si no conoces la fecha de nacimiento.'}
          >
            <Input id="pf-age" inputMode="numeric" disabled={!!birth} {...register('age_reported')} />
          </Field>
          <Field label="Categoría" required error={errors.category_id?.message}>
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Categoría" aria-invalid={!!errors.category_id}>
                    <SelectValue placeholder="Elige una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Nivel deportivo">
            <Controller
              control={control}
              name="level_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Nivel deportivo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin definir</SelectItem>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Mano dominante">
            <Controller
              control={control}
              name="dominant_hand"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Mano dominante">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin definir</SelectItem>
                    <SelectItem value="right">Diestro</SelectItem>
                    <SelectItem value="left">Zurdo</SelectItem>
                    <SelectItem value="ambidextrous">Ambidiestro</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Fecha de ingreso" htmlFor="pf-join" error={errors.join_date?.message}>
            <Input id="pf-join" type="date" max={todayISO()} {...register('join_date')} />
          </Field>
          <Field label="Estado">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Fotografía (opcional)" htmlFor="pf-photo" hint="JPG, PNG o WebP, máximo 5 MB. Se guarda en almacenamiento privado.">
            <Input
              id="pf-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="pt-2"
            />
          </Field>
          <div className="flex items-start gap-3 sm:col-span-2">
            <Controller
              control={control}
              name="photo_authorized"
              render={({ field }) => (
                <Checkbox id="pf-auth" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5 size-5" />
              )}
            />
            <label htmlFor="pf-auth" className="text-sm">
              Cuento con autorización de la familia para usar la fotografía de este jugador.
              <span className="block text-muted-foreground">Sin autorización no se guarda ni se muestra ninguna foto.</span>
            </label>
          </div>
          <Field
            label={editing ? 'Agregar observación interna' : 'Observaciones internas'}
            htmlFor="pf-notes"
            className="sm:col-span-2"
            hint="Privadas: solo las ve el entrenador."
          >
            <Textarea id="pf-notes" rows={3} {...register('notes')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="player-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {editing ? 'Guardar cambios' : 'Registrar jugador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

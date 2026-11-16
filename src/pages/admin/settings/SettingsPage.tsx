import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImageUp, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Field, PageHeader, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { qk, useCategories, useControlTests, useLevels, useSkills } from '@/lib/queries';
import { STORAGE, supabase, unwrap, type Json, type Updates } from '@/lib/supabase';
import { applyTheme, contrastRatio, DEFAULT_THEME, readableOn, useTheme, type ThemeSettings } from '@/lib/theme';
import type { TiebreakCriterion } from '@/lib/tournament';
import { AccountsTab } from './AccountsTab';

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'academia';
  const tabs: [string, string][] = [
    ['academia', 'Academia'],
    ['apariencia', 'Apariencia'],
    ['catalogos', 'Categorías y catálogos'],
    ['reglas', 'Reglas deportivas'],
    ['cuentas', 'Cuentas y vínculos'],
    ['portales', 'Portales'],
  ];
  return (
    <div>
      <PageHeader title="Configuración" description="Idioma: español. Zona horaria: America/Costa_Rica." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max">
            {tabs.map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="min-h-10 px-3">
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="academia" className="mt-5">
          <AcademyTab />
        </TabsContent>
        <TabsContent value="apariencia" className="mt-5">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="catalogos" className="mt-5">
          <CatalogsTab />
        </TabsContent>
        <TabsContent value="reglas" className="mt-5">
          <RulesTab />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-5">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="portales" className="mt-5">
          <PortalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Updates<'academy_settings'>) => unwrap(await supabase.from('academy_settings').update(patch).eq('id', true)),
    onSuccess: () => {
      toast.success('Configuración guardada');
      void qc.invalidateQueries({ queryKey: ['academy_settings'] });
    },
    onError: (e) => toast.error(e.message),
  });
}

function AcademyTab() {
  const { settings, logoUrl, bannerUrl } = useTheme();
  const save = useSaveSettings();
  const [name, setName] = useState(settings?.name ?? '');
  const [short, setShort] = useState(settings?.short_name ?? '');
  const [uploading, setUploading] = useState<string | null>(null);
  const upload = async (kind: 'logo' | 'banner', file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('La imagen supera 2 MB.');
    setUploading(kind);
    try {
      const path = `${kind}-${Date.now()}.${file.name.split('.').pop()?.toLowerCase() || 'png'}`;
      const up = await supabase.storage.from(STORAGE.branding).upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);
      const old = kind === 'logo' ? settings?.logo_path : settings?.banner_path;
      if (old) await supabase.storage.from(STORAGE.branding).remove([old]);
      save.mutate(kind === 'logo' ? { logo_path: path } : { banner_path: path });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo subir');
    } finally {
      setUploading(null);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Identidad">
        <div className="flex flex-col gap-4">
          <Field label="Nombre de la academia" htmlFor="st-n" required>
            <Input id="st-n" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Nombre corto" htmlFor="st-s" hint="Opcional, para espacios reducidos.">
            <Input id="st-s" value={short} onChange={(e) => setShort(e.target.value)} />
          </Field>
          <Button className="self-start" disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ name: name.trim(), short_name: short.trim() || null })}>
            <Save /> Guardar
          </Button>
        </div>
      </Panel>
      <Panel title="Logo y banner">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            {logoUrl ? <img src={logoUrl} alt="Logo actual" className="size-16 rounded-lg border bg-white object-contain p-1" /> : <span className="size-16 rounded-full bg-ball" aria-hidden />}
            <Field label="Logo" htmlFor="st-logo" hint="PNG o JPG para que aparezca también en los PDF. Máximo 2 MB.">
              <Input id="st-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="pt-2" onChange={(e) => upload('logo', e.target.files?.[0])} />
            </Field>
            {uploading === 'logo' && <Loader2 className="animate-spin" aria-label="Subiendo" />}
          </div>
          <div className="flex flex-col gap-2">
            {bannerUrl && <img src={bannerUrl} alt="Banner actual" className="h-24 w-full rounded-lg border object-cover" />}
            <Field label="Banner" htmlFor="st-banner" hint="Imagen ancha. Usa ilustraciones o fotos sin menores no autorizados.">
              <Input id="st-banner" type="file" accept="image/png,image/jpeg,image/webp" className="pt-2" onChange={(e) => upload('banner', e.target.files?.[0])} />
            </Field>
            {uploading === 'banner' && <Loader2 className="animate-spin" aria-label="Subiendo" />}
          </div>
          {(settings?.logo_path || settings?.banner_path) && (
            <div className="flex gap-2">
              {settings.logo_path && (
                <Button variant="ghost" size="sm" onClick={() => save.mutate({ logo_path: null })}>
                  <Trash2 /> Quitar logo
                </Button>
              )}
              {settings.banner_path && (
                <Button variant="ghost" size="sm" onClick={() => save.mutate({ banner_path: null })}>
                  <Trash2 /> Quitar banner
                </Button>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode }) {
  const id = `c-${label.replace(/\W/g, '')}`;
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label}: selector`} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-md border bg-card p-1" />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" maxLength={7} />
      </div>
    </Field>
  );
}

function AppearanceTab() {
  const { settings, theme } = useTheme();
  const save = useSaveSettings();
  const [t, setT] = useState<ThemeSettings>({ ...DEFAULT_THEME, ...theme });
  const set = (patch: Partial<ThemeSettings>) => {
    const next = { ...t, ...patch };
    setT(next);
    applyTheme(next); // vista previa en vivo
  };
  const hex = (v?: string) => /^#[0-9a-fA-F]{6}$/.test(v ?? '');
  const accentText = hex(t.accent) && hex(t.primary) ? readableOn(t.accent!, t.primary!) : '#000000';
  const accentContrast = hex(t.accent) ? contrastRatio(t.accent!, accentText) : 0;
  const inkOnPaper = hex(t.primary) ? contrastRatio(t.primary!, hex(t.background) ? t.background! : '#F4F6FA') : 0;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Panel title="Colores y tipografía">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Color principal" value={t.primary ?? ''} onChange={(v) => set({ primary: v })} hint="Barra lateral, títulos y texto." />
          <ColorField label="Color secundario" value={t.secondary ?? ''} onChange={(v) => set({ secondary: v })} hint="Bandas de torneo y marcador." />
          <ColorField label="Color de acento" value={t.accent ?? ''} onChange={(v) => set({ accent: v })} hint="Botones principales y estados en juego." />
          <ColorField label="Acento secundario" value={t.accent2 ?? ''} onChange={(v) => set({ accent2: v })} hint="Ganador en el marcador." />
          <ColorField label="Fondo claro" value={t.background ?? '#F4F6FA'} onChange={(v) => set({ background: v })} />
          <Field label="Tipografía">
            <Select value={t.font} onValueChange={(v) => set({ font: v as ThemeSettings['font'] })}>
              <SelectTrigger className="w-full" aria-label="Tipografía">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archivo">Archivo (deportiva, predeterminada)</SelectItem>
                <SelectItem value="system">Tipografía del sistema</SelectItem>
                <SelectItem value="serif">Serif clásica</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tema predeterminado">
            <Select value={t.mode} onValueChange={(v) => set({ mode: v as ThemeSettings['mode'] })}>
              <SelectTrigger className="w-full" aria-label="Tema predeterminado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Según el dispositivo</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Oscuro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {(accentContrast < 4.5 || inkOnPaper < 4.5) && (
          <p role="alert" className="mt-4 rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm">
            {accentContrast < 4.5 && `El texto sobre el acento tendría contraste ${accentContrast.toFixed(1)}:1 (mínimo recomendado 4.5:1). `}
            {inkOnPaper < 4.5 && `El texto principal sobre el fondo tendría contraste ${inkOnPaper.toFixed(1)}:1.`}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            disabled={save.isPending || ![t.primary, t.secondary, t.accent, t.accent2].every(hex) || (t.background !== undefined && !hex(t.background))}
            onClick={() => save.mutate({ theme: t as unknown as Record<string, Json> })}
          >
            <Save /> Guardar apariencia
          </Button>
          <Button variant="outline" onClick={() => set({ ...DEFAULT_THEME, background: undefined })}>
            <RotateCcw /> Valores originales
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const orig = { ...DEFAULT_THEME, ...((settings?.theme as ThemeSettings) ?? {}) };
              setT(orig);
              applyTheme(orig);
            }}
          >
            Descartar cambios
          </Button>
        </div>
      </Panel>
      <Panel title="Vista previa">
        <div className="flex flex-col gap-4">
          <div className="table-band-h rounded-lg p-4">
            <p className="condensed text-[1.6rem] font-bold">Torneo de ejemplo</p>
            <p className="text-sm text-white/80">Banda con el color secundario</p>
          </div>
          <div className="table-band grid grid-cols-2 rounded-lg py-4 text-center">
            <span className="numeral text-[3.5rem] leading-none">11</span>
            <span className="numeral text-[3.5rem] leading-none text-lime">9</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Acción principal</Button>
            <Button variant="ink">Secundaria</Button>
            <Button variant="outline">Contorno</Button>
          </div>
          <p>
            Texto de ejemplo con el color principal sobre el fondo. <span className="text-muted-foreground">Texto secundario.</span>
          </p>
        </div>
      </Panel>
    </div>
  );
}

type CatalogTable = 'categories' | 'levels' | 'skills' | 'control_tests';

function CatalogEditor({ title, table, rows, hasOrder, hasActive, extra }: { title: string; table: CatalogTable; rows: { id: string; name: string; sort_order?: number; active?: boolean; unit?: string | null }[]; hasOrder?: boolean; hasActive?: boolean; extra?: 'unit' }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const keyOf: Record<CatalogTable, readonly string[]> = { categories: qk.categories, levels: qk.levels, skills: qk.skills, control_tests: qk.controlTests };
  const done = () => void qc.invalidateQueries({ queryKey: keyOf[table] });
  const add = useMutation({
    mutationFn: async () => {
      const row: Record<string, unknown> = { name: name.trim() };
      if (hasOrder) row.sort_order = (rows.at(-1)?.sort_order ?? 0) + 1;
      if (extra === 'unit') row.unit = unit.trim() || null;
      unwrap(await supabase.from(table).insert(row as never));
    },
    onSuccess: () => {
      setName('');
      setUnit('');
      done();
    },
    onError: (e) => toast.error(e.message),
  });
  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => unwrap(await supabase.from(table).update(patch as never).eq('id', id)),
    onSuccess: done,
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from(table).delete().eq('id', id)),
    onSuccess: done,
    onError: () => toast.error('No se puede eliminar porque está en uso. Desactívalo en su lugar.'),
  });
  const move = (i: number, j: number) => {
    const a = rows[i];
    const b = rows[j];
    upd.mutate({ id: a.id, patch: { sort_order: b.sort_order } });
    upd.mutate({ id: b.id, patch: { sort_order: a.sort_order } });
  };
  return (
    <Panel title={title}>
      <ul className="mb-3 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2">
            <Input
              defaultValue={r.name}
              aria-label={`Nombre de ${r.name}`}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.name && upd.mutate({ id: r.id, patch: { name: e.target.value.trim() } })}
            />
            {extra === 'unit' && (
              <Input className="w-28" defaultValue={r.unit ?? ''} placeholder="Unidad" aria-label={`Unidad de ${r.name}`} onBlur={(e) => e.target.value !== (r.unit ?? '') && upd.mutate({ id: r.id, patch: { unit: e.target.value.trim() || null } })} />
            )}
            {hasOrder && (
              <>
                <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown />
                </Button>
              </>
            )}
            {hasActive && <Switch checked={r.active} onCheckedChange={(c) => upd.mutate({ id: r.id, patch: { active: c } })} aria-label={`${r.name} activo`} />}
            <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${r.name}`} onClick={() => del.mutate(r.id)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo" aria-label={`Agregar a ${title}`} />
        {extra === 'unit' && <Input className="w-28" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidad" aria-label="Unidad" />}
        <Button type="submit" variant="outline" disabled={!name.trim()}>
          <Plus /> Agregar
        </Button>
      </form>
    </Panel>
  );
}

function CatalogsTab() {
  const { data: cats = [] } = useCategories();
  const { data: levels = [] } = useLevels();
  const { data: skills = [] } = useSkills();
  const { data: tests = [] } = useControlTests();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CatalogEditor title="Categorías" table="categories" rows={cats} hasOrder hasActive />
      <CatalogEditor title="Niveles deportivos" table="levels" rows={levels} hasOrder />
      <CatalogEditor title="Habilidades evaluables" table="skills" rows={skills} hasOrder hasActive />
      <CatalogEditor title="Pruebas de control" table="control_tests" rows={tests} hasActive extra="unit" />
      <p className="text-sm text-muted-foreground lg:col-span-2">Los grupos de entrenamiento se administran en Horarios y grupos.</p>
    </div>
  );
}

const TB: Record<TiebreakCriterion, string> = {
  wins: 'Partidos ganados',
  head_to_head: 'Resultado directo entre empatados',
  set_diff: 'Diferencia de sets',
  point_diff: 'Diferencia de puntos totales',
  manual: 'Criterio del entrenador',
};

function RulesTab() {
  const { settings } = useTheme();
  const save = useSaveSettings();
  const r = (settings?.default_rules as { pointsPerSet?: number; minLead?: number; bestOf?: number }) ?? {};
  const [rules, setRules] = useState({ pointsPerSet: r.pointsPerSet ?? 11, minLead: r.minLead ?? 2, bestOf: r.bestOf ?? 3 });
  const [tb, setTb] = useState<TiebreakCriterion[]>((settings?.default_tiebreakers as TiebreakCriterion[]) ?? ['wins', 'head_to_head', 'set_diff', 'point_diff', 'manual']);
  const swap = (i: number, j: number) =>
    setTb((x) => {
      const a = x.slice();
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Partido predeterminado">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Puntos por set" htmlFor="rl-p">
            <Input id="rl-p" type="number" min={5} value={rules.pointsPerSet} onChange={(e) => setRules({ ...rules, pointsPerSet: +e.target.value || 11 })} />
          </Field>
          <Field label="Diferencia mínima" htmlFor="rl-m">
            <Input id="rl-m" type="number" min={1} value={rules.minLead} onChange={(e) => setRules({ ...rules, minLead: +e.target.value || 2 })} />
          </Field>
          <Field label="Mejor de">
            <Select value={String(rules.bestOf)} onValueChange={(v) => setRules({ ...rules, bestOf: +v })}>
              <SelectTrigger className="w-full" aria-label="Mejor de">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 3, 5, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} sets
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Cada torneo puede cambiar estas reglas en su asistente.</p>
      </Panel>
      <Panel title="Criterios de desempate predeterminados">
        <ol className="flex flex-col gap-1.5">
          {tb.map((c, i) => (
            <li key={c} className="flex min-h-11 items-center gap-2 rounded-lg border px-3">
              <span className="numeral w-5">{i + 1}</span>
              <span className="flex-1">{TB[c]}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === tb.length - 1} onClick={() => swap(i, i + 1)}>
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ol>
      </Panel>
      <Button className="self-start" disabled={save.isPending || rules.pointsPerSet < 5 || rules.minLead < 1} onClick={() => save.mutate({ default_rules: rules as unknown as Record<string, Json>, default_tiebreakers: tb })}>
        <Save /> Guardar reglas
      </Button>
    </div>
  );
}

const PORTAL_KEYS: [string, string, string][] = [
  ['rankings', 'Ranking interno', 'Muestra a cada jugador sus puntos de ranking.'],
  ['attendance', 'Asistencia', 'Porcentaje y registro de asistencia propio.'],
  ['evaluations', 'Evaluaciones', 'Solo las evaluaciones que marques como compartidas.'],
  ['achievements', 'Logros', 'Medallas, campeonatos y distinciones compartidas.'],
  ['records', 'Estadísticas personales', 'Partidos, victorias y evolución.'],
];

function PortalsTab() {
  const { settings } = useTheme();
  const save = useSaveSettings();
  const [v, setV] = useState<Record<string, boolean>>({ rankings: true, attendance: true, evaluations: true, achievements: true, records: true, ...((settings?.portal_visibility as Record<string, boolean>) ?? {}) });
  return (
    <Panel title="Qué ven jugadores y familias">
      <p className="mb-4 text-sm text-muted-foreground">
        Las notas internas, los datos administrativos y los expedientes de otros jugadores nunca se muestran: lo impide la base de datos, no solo la interfaz.
      </p>
      <ul className="flex flex-col divide-y">
        {PORTAL_KEYS.map(([k, l, h]) => (
          <li key={k} className="flex min-h-14 items-center gap-3 py-2">
            <span className="flex-1">
              <span className="block font-medium">{l}</span>
              <span className="text-sm text-muted-foreground">{h}</span>
            </span>
            <Switch checked={v[k]} onCheckedChange={(c) => setV({ ...v, [k]: c })} aria-label={l} />
          </li>
        ))}
      </ul>
      <Button className="mt-4" disabled={save.isPending} onClick={() => save.mutate({ portal_visibility: v as unknown as Record<string, Json> })}>
        <Save /> Guardar
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        <ImageUp className="inline size-3.5" aria-hidden /> Las fotos de jugadores solo aparecen si su ficha tiene la autorización marcada.
      </p>
    </Panel>
  );
}

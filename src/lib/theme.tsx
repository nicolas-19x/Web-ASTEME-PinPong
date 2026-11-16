import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { publicUrl, STORAGE, supabase, type Tables } from './supabase';

export interface ThemeSettings {
  primary?: string; // azul tinta
  secondary?: string; // azul mesa
  accent?: string; // naranja pelota
  accent2?: string; // lima
  mode?: 'light' | 'dark' | 'system';
  font?: 'archivo' | 'system' | 'serif';
  background?: string; // fondo claro opcional
}

export const DEFAULT_THEME: Required<Omit<ThemeSettings, 'background'>> = {
  primary: '#0C1B33',
  secondary: '#1B4F8C',
  accent: '#FF6B1A',
  accent2: '#B4E33D',
  mode: 'system',
  font: 'archivo',
};

const FONTS: Record<NonNullable<ThemeSettings['font']>, string> = {
  archivo: '"Archivo Variable", "Archivo", system-ui, sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
};

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return 0;
  const [r, g, b] = m.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto legible sobre un color de fondo: tinta o blanco, el que tenga más contraste. */
export function readableOn(bg: string, ink: string): string {
  return contrastRatio(bg, ink) >= contrastRatio(bg, '#FFFFFF') ? ink : '#FFFFFF';
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

export function applyTheme(t: ThemeSettings) {
  const root = document.documentElement;
  const ink = isHex(t.primary) ? t.primary : DEFAULT_THEME.primary;
  const table = isHex(t.secondary) ? t.secondary : DEFAULT_THEME.secondary;
  const ball = isHex(t.accent) ? t.accent : DEFAULT_THEME.accent;
  const lime = isHex(t.accent2) ? t.accent2 : DEFAULT_THEME.accent2;
  root.style.setProperty('--brand-ink', ink);
  root.style.setProperty('--brand-table', table);
  root.style.setProperty('--brand-ball', ball);
  root.style.setProperty('--brand-ball-foreground', readableOn(ball, ink));
  root.style.setProperty('--brand-lime', lime);
  root.style.setProperty('--brand-font', FONTS[t.font ?? 'archivo'] ?? FONTS.archivo);
  if (isHex(t.background)) root.style.setProperty('--background', t.background);
  else root.style.removeProperty('--background');
}

type Mode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  settings: Tables<'academy_settings'> | null;
  theme: ThemeSettings;
  logoUrl: string | null;
  bannerUrl: string | null;
  /** Preferencia de este dispositivo (sobre la de la academia). */
  mode: Mode;
  setMode: (m: Mode) => void;
  resolvedDark: boolean;
}

const Ctx = createContext<ThemeCtx | null>(null);
const MODE_KEY = 'atm-theme-mode';

function readStoredMode(): Mode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery({
    queryKey: ['academy_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('academy_settings').select('*').maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
  });
  const theme = useMemo<ThemeSettings>(() => ({ ...DEFAULT_THEME, ...((settings?.theme as ThemeSettings) ?? {}) }), [settings]);
  const [localMode, setLocalMode] = useState<Mode | null>(readStoredMode);
  const mode: Mode = localMode ?? theme.mode ?? 'system';
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const resolvedDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedDark);
    document.documentElement.style.colorScheme = resolvedDark ? 'dark' : 'light';
  }, [resolvedDark]);
  useEffect(() => {
    if (settings?.name) document.title = settings.name;
  }, [settings?.name]);

  const value: ThemeCtx = {
    settings: settings ?? null,
    theme,
    logoUrl: publicUrl(STORAGE.branding, settings?.logo_path),
    bannerUrl: publicUrl(STORAGE.branding, settings?.banner_path),
    mode,
    setMode: (m) => {
      setLocalMode(m);
      try {
        localStorage.setItem(MODE_KEY, m);
      } catch {
        /* almacenamiento no disponible */
      }
    },
    resolvedDark,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme fuera de ThemeProvider');
  return c;
}

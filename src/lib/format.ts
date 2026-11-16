export const TZ = 'America/Costa_Rica';
export const LOCALE = 'es-CR';

/** Fecha de hoy en Costa Rica como "YYYY-MM-DD". */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Convierte "YYYY-MM-DD" (fecha sin hora) a Date al mediodía UTC para evitar corrimientos de día. */
export function dateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '—';
  const d = iso.length <= 10 ? dateOnly(iso) : new Date(iso);
  return new Intl.DateTimeFormat(LOCALE, { timeZone: iso.length <= 10 ? 'UTC' : TZ, ...opts }).format(d);
}

export function fmtLongDate(iso: string): string {
  return fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function relativeDays(iso: string): string {
  const diff = Math.round((dateOnly(iso).getTime() - dateOnly(todayISO()).getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff < 7) return `En ${diff} días`;
  if (diff < 0 && diff > -7) return `Hace ${-diff} días`;
  return fmtDate(iso, { day: 'numeric', month: 'short' });
}

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Día ISO (1 = lunes) de una fecha "YYYY-MM-DD". */
export function isoWeekday(iso: string): number {
  const d = dateOnly(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(iso: string, days: number): string {
  const d = dateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface AgeSource {
  birth_date: string | null;
  age_reported: number | null;
  age_reported_on: string | null;
}

/**
 * Edad: si hay fecha de nacimiento se calcula; si solo hay edad informada se
 * muestra tal cual con la fecha en que se registró (no se inventa la fecha).
 */
export function playerAge(p: AgeSource): { value: number | null; label: string; approximate: boolean } {
  if (p.birth_date) {
    const today = dateOnly(todayISO());
    const b = dateOnly(p.birth_date);
    let age = today.getUTCFullYear() - b.getUTCFullYear();
    const m = today.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
    return { value: age, label: `${age} años`, approximate: false };
  }
  if (p.age_reported != null) {
    return { value: p.age_reported, label: `${p.age_reported} años`, approximate: true };
  }
  return { value: null, label: 'Edad pendiente', approximate: false };
}

export function fullName(p: { first_name: string; last_names?: string | null }): string {
  return [p.first_name, p.last_names].filter(Boolean).join(' ');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}

export const LEVEL_HINT: Record<string, string> = {
  Recreativo: 'Recreativo',
  Formativo: 'Formativo',
  Competitivo: 'Competitivo',
};

export const STATUS_LABEL: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', archived: 'Archivado' };
export const HAND_LABEL: Record<string, string> = { right: 'Diestro', left: 'Zurdo', ambidextrous: 'Ambidiestro' };
export const MEDAL_LABEL: Record<string, string> = { gold: 'Oro', silver: 'Plata', bronze: 'Bronce' };
export const ATTENDANCE_LABEL: Record<string, string> = { present: 'Presente', absent: 'Ausente', excused: 'Justificado' };

export function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)} %`;
}

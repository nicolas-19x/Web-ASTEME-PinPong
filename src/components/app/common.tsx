import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { fullName, initials } from '@/lib/format';
import { signedUrl, STORAGE } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-[1.95rem] sm:text-[2.45rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-card text-card-foreground', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          {title && <h2 className="text-[1.15rem] sm:text-[1.25rem]">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-4 py-6 sm:px-6">
      {icon && <div className="text-muted-foreground [&_svg]:size-6">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-[60ch] text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="size-4" aria-hidden /> No se pudieron cargar los datos
      </p>
      <p className="text-sm">{msg}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Envoltorio de campo: etiqueta visible, ayuda y error junto al control. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PlayerAvatar({
  player,
  size = 40,
  className,
}: {
  player: { id: string; first_name: string; last_names?: string | null; photo_path?: string | null; photo_authorized?: boolean };
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (player.photo_path && player.photo_authorized) {
      void signedUrl(STORAGE.playerPhotos, player.photo_path).then((u) => alive && setUrl(u));
    } else setUrl(null);
    return () => {
      alive = false;
    };
  }, [player.photo_path, player.photo_authorized]);
  const name = fullName(player);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-table text-white condensed font-bold', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden={!url}
    >
      {url ? <img src={url} alt={`Foto de ${name}`} className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/14 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-table/12 text-table dark:text-[#9cc4f2]',
  ball: 'bg-primary/15 text-[color-mix(in_oklab,var(--brand-ball)_60%,var(--foreground))]',
} as const;

export function Chip({ tone = 'neutral', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, [keyof typeof TONES, string]> = {
    active: ['success', 'Activo'],
    inactive: ['warning', 'Inactivo'],
    archived: ['neutral', 'Archivado'],
  };
  const [tone, label] = map[status] ?? ['neutral', status];
  return <Chip tone={tone}>{label}</Chip>;
}

export function Stat({ value, label, className }: { value: ReactNode; label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="numeral text-[2rem] leading-none">{value}</span>
      <span className="mt-1 text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function MedalDot({ medal }: { medal: string | null | undefined }) {
  if (!medal) return null;
  const color = medal === 'gold' ? '#D4A017' : medal === 'silver' ? '#A7B1BE' : '#B8733C';
  const label = medal === 'gold' ? 'Oro' : medal === 'silver' ? 'Plata' : 'Bronce';
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span className="inline-block size-3 rounded-full ring-2 ring-black/10" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

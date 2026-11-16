import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  Home,
  LogOut,
  Medal,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth';
import { fullName } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './common';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Panel', icon: <Home />, end: true },
  { to: '/jugadores', label: 'Jugadores', icon: <Users /> },
  { to: '/torneos', label: 'Torneos', icon: <Trophy /> },
  { to: '/competencias', label: 'Competencias', icon: <Medal /> },
  { to: '/calendario', label: 'Calendario', icon: <CalendarDays /> },
  { to: '/horarios', label: 'Horarios y grupos', icon: <Clock /> },
  { to: '/asistencia', label: 'Asistencia', icon: <ClipboardCheck /> },
  { to: '/comunicados', label: 'Comunicados', icon: <Bell /> },
  { to: '/estadisticas', label: 'Estadísticas', icon: <BarChart3 /> },
  { to: '/informes', label: 'Informes', icon: <FileText /> },
  { to: '/configuracion', label: 'Configuración', icon: <Settings /> },
];

const ADMIN_BOTTOM = ['/', '/jugadores', '/torneos', '/asistencia'];

export const PORTAL_NAV: NavItem[] = [
  { to: '/portal', label: 'Inicio', icon: <Home />, end: true },
  { to: '/portal/horarios', label: 'Horarios', icon: <Clock /> },
  { to: '/portal/calendario', label: 'Calendario', icon: <CalendarDays /> },
  { to: '/portal/comunicados', label: 'Comunicados', icon: <Bell /> },
];

function Brand({ compact }: { compact?: boolean }) {
  const { settings, logoUrl } = useTheme();
  const name = settings?.name ?? 'Academia';
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-offset-4">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-md bg-white object-contain p-0.5" />
      ) : (
        <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ball" aria-hidden>
          <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-ink/30" />
        </span>
      )}
      {!compact && <span className="condensed truncate text-[1.15rem] leading-tight font-bold">{name}</span>}
    </Link>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedDark, setMode } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setMode(resolvedDark ? 'light' : 'dark')}
      aria-label={resolvedDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {resolvedDark ? <Sun /> : <Moon />}
    </Button>
  );
}

function SideNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-0.5">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-white [&_svg]:size-[1.15rem]',
              isActive && 'bg-sidebar-accent text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-ball',
            )
          }
        >
          {it.icon}
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBlock() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 border-t border-sidebar-border pt-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
        <p className="text-xs text-sidebar-foreground/70">
          {profile?.role === 'admin' ? 'Entrenador' : profile?.role === 'player' ? 'Jugador' : 'Encargado'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        aria-label="Cerrar sesión"
        onClick={async () => {
          await signOut();
          navigate('/login');
        }}
      >
        <LogOut />
      </Button>
    </div>
  );
}

/** Buscador global de jugadores y secciones (Ctrl/⌘ + K). */
function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { data: players = [] } = useQuery({
    queryKey: ['players', 'search-index'],
    queryFn: async () => {
      const { data } = await supabase
        .from('players')
        .select('id, first_name, last_names, photo_path, photo_authorized, status, categories(name)')
        .order('first_name');
      return data ?? [];
    },
    enabled: open,
  });
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const results = useMemo(() => {
    const n = norm(q.trim());
    const ps = players.filter((p) => !n || norm(fullName(p)).includes(n)).slice(0, 8);
    const pages = ADMIN_NAV.filter((p) => n && norm(p.label).includes(n));
    return { ps, pages };
  }, [q, players]);
  const go = (to: string) => {
    onOpenChange(false);
    setQ('');
    navigate(to);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar jugador o sección"
            aria-label="Buscar jugador o sección"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const first = results.ps[0];
                if (first) go(`/jugadores/${first.id}`);
                else if (results.pages[0]) go(results.pages[0].to);
              }
            }}
          />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2" aria-label="Resultados">
          {results.ps.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => go(`/jugadores/${p.id}`)}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-accent focus-visible:bg-accent"
              >
                <PlayerAvatar player={p} size={32} />
                <span className="flex-1 font-medium">{fullName(p)}</span>
                <span className="text-sm text-muted-foreground">{p.categories?.name ?? 'Sin categoría'}</span>
              </button>
            </li>
          ))}
          {results.pages.map((p) => (
            <li key={p.to}>
              <button
                type="button"
                onClick={() => go(p.to)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-accent [&_svg]:size-4"
              >
                {p.icon}
                Ir a {p.label}
              </button>
            </li>
          ))}
          {!results.ps.length && !results.pages.length && (
            <li className="px-2 py-6 text-sm text-muted-foreground">Sin coincidencias para “{q}”.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({ portal = false }: { portal?: boolean }) {
  const nav = portal ? PORTAL_NAV : ADMIN_NAV;
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (portal) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [portal]);

  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const bottom = portal ? nav : nav.filter((n) => ADMIN_BOTTOM.includes(n.to));

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <a href="#main" className="sr-only z-50 rounded bg-ball px-3 py-2 text-ball-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground lg:flex">
        <div className="flex items-center justify-between px-1 pt-1 text-white">
          <Brand />
        </div>
        {!portal && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-sidebar-border px-3 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Buscar jugador</span>
            <kbd className="rounded border border-sidebar-border px-1.5 text-[0.7rem]">Ctrl K</kbd>
          </button>
        )}
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <SideNav items={nav} />
        </div>
        <div className="flex items-center justify-end">
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" />
        </div>
        <UserBlock />
      </aside>

      {/* Barra superior (móvil y tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-sidebar px-3 text-white lg:hidden">
        <Brand />
        <div className="flex-1" />
        {!portal && (
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label="Buscar jugador" onClick={() => setSearchOpen(true)}>
            <Search />
          </Button>
        )}
        <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 pt-5 pb-28 outline-none sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        <Outlet />
      </main>

      {/* Navegación inferior (móvil y tablet) */}
      <nav
        aria-label="Navegación rápida"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}
      >
        {bottom.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold text-muted-foreground [&_svg]:size-5',
                isActive && 'text-foreground [&_svg]:text-ball',
              )
            }
          >
            {it.icon}
            {it.label.split(' ')[0]}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold text-muted-foreground [&_svg]:size-5"
          aria-haspopup="dialog"
        >
          <Menu />
          Más
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="left" className="w-[290px] border-sidebar-border bg-sidebar p-3 text-sidebar-foreground" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <div className="flex h-full flex-col gap-4 pt-8">
            <SideNav items={nav} onNavigate={() => setMoreOpen(false)} />
            <div className="flex-1" />
            <UserBlock />
          </div>
        </SheetContent>
      </Sheet>

      {!portal && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}

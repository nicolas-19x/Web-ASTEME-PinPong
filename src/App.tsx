import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app/AppShell';
import { Loading } from '@/components/app/common';
import { useAuth, type Role } from '@/lib/auth';
import Login from '@/pages/Login';

const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const PlayersList = lazy(() => import('@/pages/admin/players/PlayersList'));
const PlayerDetail = lazy(() => import('@/pages/admin/players/PlayerDetail'));
const TournamentsList = lazy(() => import('@/pages/admin/tournaments/TournamentsList'));
const TournamentWizard = lazy(() => import('@/pages/admin/tournaments/TournamentWizard'));
const TournamentDetail = lazy(() => import('@/pages/admin/tournaments/TournamentDetail'));
const Scoreboard = lazy(() => import('@/pages/admin/tournaments/Scoreboard'));
const Competitions = lazy(() => import('@/pages/admin/Competitions'));
const CompetitionDetail = lazy(() => import('@/pages/admin/CompetitionDetail'));
const CalendarPage = lazy(() => import('@/pages/shared/CalendarPage'));
const Schedules = lazy(() => import('@/pages/admin/Schedules'));
const Attendance = lazy(() => import('@/pages/admin/Attendance'));
const Announcements = lazy(() => import('@/pages/admin/Announcements'));
const Statistics = lazy(() => import('@/pages/admin/Statistics'));
const Reports = lazy(() => import('@/pages/admin/Reports'));
const SettingsPage = lazy(() => import('@/pages/admin/settings/SettingsPage'));
const PortalHome = lazy(() => import('@/pages/portal/PortalHome'));
const PortalPlayer = lazy(() => import('@/pages/portal/PortalPlayer'));
const PortalSchedule = lazy(() => import('@/pages/portal/PortalSchedule'));
const PortalAnnouncements = lazy(() => import('@/pages/portal/PortalAnnouncements'));

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { loading, session, role } = useAuth();
  if (loading) return <Loading label="Verificando sesión…" />;
  if (!session || !role) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={role === 'admin' ? '/' : '/portal'} replace />;
  return <>{children}</>;
}

const page = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireRole roles={['admin']}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={page(<Dashboard />)} />
          <Route path="jugadores" element={page(<PlayersList />)} />
          <Route path="jugadores/:id" element={page(<PlayerDetail />)} />
          <Route path="torneos" element={page(<TournamentsList />)} />
          <Route path="torneos/nuevo" element={page(<TournamentWizard />)} />
          <Route path="torneos/:id" element={page(<TournamentDetail />)} />
          <Route path="torneos/:id/marcador/:matchId" element={page(<Scoreboard />)} />
          <Route path="competencias" element={page(<Competitions />)} />
          <Route path="competencias/:id" element={page(<CompetitionDetail />)} />
          <Route path="calendario" element={page(<CalendarPage />)} />
          <Route path="horarios" element={page(<Schedules />)} />
          <Route path="asistencia" element={page(<Attendance />)} />
          <Route path="comunicados" element={page(<Announcements />)} />
          <Route path="estadisticas" element={page(<Statistics />)} />
          <Route path="informes" element={page(<Reports />)} />
          <Route path="configuracion" element={page(<SettingsPage />)} />
        </Route>
        <Route
          path="/portal"
          element={
            <RequireRole roles={['player', 'guardian']}>
              <AppShell portal />
            </RequireRole>
          }
        >
          <Route index element={page(<PortalHome />)} />
          <Route path="jugador/:id" element={page(<PortalPlayer />)} />
          <Route path="horarios" element={page(<PortalSchedule />)} />
          <Route path="calendario" element={page(<CalendarPage portal />)} />
          <Route path="comunicados" element={page(<PortalAnnouncements />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

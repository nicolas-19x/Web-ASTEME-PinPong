import { useState } from 'react';
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { addDays, todayISO } from '@/lib/format';
import { useGroups } from '@/lib/queries';
import { useExceptions, WeekView, weekStartOf } from '@/pages/admin/Schedules';

export default function PortalSchedule() {
  // RLS solo devuelve los grupos donde entrenan los jugadores vinculados a la cuenta.
  const { data: groups, isLoading, error, refetch } = useGroups();
  const [weekStart, setWeekStart] = useState(weekStartOf(todayISO()));
  const ex = useExceptions(weekStart, addDays(weekStart, 6));
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  return (
    <div>
      <PageHeader title="Horarios" description="Entrenamientos de la semana, con cambios y cancelaciones." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          Semana anterior
        </Button>
        <Button variant="outline" onClick={() => setWeekStart(weekStartOf(todayISO()))}>
          Esta semana
        </Button>
        <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Semana siguiente
        </Button>
      </div>
      {!groups?.length ? (
        <EmptyState title="Sin grupo asignado">Cuando el entrenador te asigne a un grupo de entrenamiento verás aquí sus horarios.</EmptyState>
      ) : (
        <WeekView groups={groups} exceptions={ex.data ?? []} weekStart={weekStart} />
      )}
    </div>
  );
}

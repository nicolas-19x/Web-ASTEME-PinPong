import { useQuery } from '@tanstack/react-query';
import { Plus, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { Chip, EmptyState, ErrorState, Loading, PageHeader } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { STATUS_LABEL } from '@/features/tournaments/data';
import { fmtDate } from '@/lib/format';
import { useCategories } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';

export default function TournamentsList() {
  const { data: cats = [] } = useCategories();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const [t, m] = await Promise.all([
        supabase.from('tournaments').select('*, tournament_participants(count)').order('held_on', { ascending: false }),
        supabase.from('matches').select('tournament_id, status').not('player_a', 'is', null).not('player_b', 'is', null),
      ]);
      const matches = unwrap(m);
      return unwrap(t).map((x) => {
        const ms = matches.filter((y) => y.tournament_id === x.id);
        return { ...x, total: ms.length, done: ms.filter((y) => y.status === 'finished').length };
      });
    },
  });
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader
        title="Torneos internos"
        description="Grupos con siembra en serpentina, marcador, clasificaciones, eliminatoria y documentos imprimibles."
        actions={
          <Button asChild>
            <Link to="/torneos/nuevo">
              <Plus /> Generar torneo
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState
          icon={<Trophy />}
          title="Aún no hay torneos"
          action={
            <Button asChild>
              <Link to="/torneos/nuevo">
                <Plus /> Generar el primero
              </Link>
            </Button>
          }
        >
          El asistente sugiere la estructura según los inscritos y genera grupos, partidos y mesas.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((t) => {
            const live = t.status === 'group_stage' || t.status === 'knockout';
            return (
              <li key={t.id}>
                <Link to={`/torneos/${t.id}`} className="flex flex-col gap-3 rounded-xl border bg-card p-4 hover:border-table/50 sm:flex-row sm:items-center">
                  <span className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
                    <span className="numeral text-[1.7rem] leading-none">{fmtDate(t.held_on, { day: 'numeric' })}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(t.held_on, { month: 'short', year: '2-digit' })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="condensed block text-[1.35rem] font-bold">{t.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {t.tournament_participants[0]?.count ?? 0} participantes
                      {t.category_ids.length ? `, ${t.category_ids.map((c) => catName.get(c)).filter(Boolean).join(' y ')}` : ''}
                      {t.location ? `, ${t.location}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {t.total > 0 && t.status !== 'finished' && (
                      <span className="text-sm text-muted-foreground">
                        {t.done}/{t.total} partidos
                      </span>
                    )}
                    <Chip tone={live ? 'ball' : t.status === 'finished' ? 'success' : 'neutral'}>
                      {live && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
                      {STATUS_LABEL[t.status]}
                    </Chip>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

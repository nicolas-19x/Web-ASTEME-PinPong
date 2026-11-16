import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, Loading, Panel } from '@/components/app/common';
import { fmtDateTime, STATUS_LABEL } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';

const KIND: Record<string, string> = {
  created: 'Alta',
  category: 'Categoría',
  level: 'Nivel',
  status: 'Estado',
  group: 'Grupo',
  milestone: 'Hito',
};

export function HistoryTab({ playerId, admin = true }: { playerId: string; admin?: boolean }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['history', playerId],
    queryFn: async () => {
      const [h, r] = await Promise.all([
        supabase.from('player_history').select('*').eq('player_id', playerId).order('changed_at', { ascending: false }),
        admin
          ? supabase.from('ranking_movements').select('*, tournaments(name)').eq('player_id', playerId).order('changed_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      return { history: unwrap(h), ranking: unwrap(r) as { id: string; old_value: number | null; new_value: number | null; reason: string; changed_at: string; tournaments: { name: string } | null }[] };
    },
  });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} retry={() => refetch()} />;
  const val = (kind: string, v: string | null) => (kind === 'status' && v ? STATUS_LABEL[v] ?? v : v ?? 'Sin definir');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Cambios del expediente">
        {data.history.length === 0 ? (
          <EmptyState title="Sin cambios registrados" />
        ) : (
          <ol className="relative flex flex-col gap-4 border-l-2 border-border pl-5">
            {data.history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-table ring-4 ring-card" aria-hidden />
                <p className="font-semibold">{KIND[h.kind] ?? h.kind}</p>
                <p>
                  {h.kind === 'created' || h.kind === 'group' || h.kind === 'milestone'
                    ? h.new_value ?? h.old_value
                    : `${val(h.kind, h.old_value)} → ${val(h.kind, h.new_value)}`}
                </p>
                {h.note && <p className="text-sm">{h.note}</p>}
                <p className="text-xs text-muted-foreground">{fmtDateTime(h.changed_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {admin && (
        <Panel title="Movimientos de ranking">
          {data.ranking.length === 0 ? (
            <EmptyState title="Sin movimientos de ranking" />
          ) : (
            <ul className="flex flex-col divide-y">
              {data.ranking.map((r) => {
                const delta = r.old_value != null && r.new_value != null ? Number(r.new_value) - Number(r.old_value) : null;
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block">{r.reason}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(r.changed_at)}
                        {r.tournaments ? `, ${r.tournaments.name}` : ''}
                      </span>
                    </span>
                    <span className="numeral text-right text-[1.15rem]">
                      {r.old_value ?? '—'} → {r.new_value ?? '—'}
                      {delta != null && delta !== 0 && (
                        <span className={`ml-2 text-sm ${delta > 0 ? 'text-success' : 'text-destructive'}`}>{delta > 0 ? `+${delta}` : delta}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

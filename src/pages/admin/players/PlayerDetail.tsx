import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, FileDown, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Chip, ErrorState, Loading, PlayerAvatar, StatusChip } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fullName, HAND_LABEL, playerAge } from '@/lib/format';
import { qk } from '@/lib/queries';
import { supabase, unwrapMaybe } from '@/lib/supabase';
import { PlayerFormDialog } from './PlayerForm';
import { AchievementsTab } from './tabs/AchievementsTab';
import { CompetitiveTab } from './tabs/CompetitiveTab';
import { ControlsTab } from './tabs/ControlsTab';
import { EvaluationsTab } from './tabs/EvaluationsTab';
import { GeneralTab } from './tabs/GeneralTab';
import { HistoryTab } from './tabs/HistoryTab';
import { PlanTab } from './tabs/PlanTab';

const TABS = [
  ['general', 'Información general'],
  ['competitivo', 'Historial competitivo'],
  ['controles', 'Controles'],
  ['evaluaciones', 'Evaluaciones'],
  ['plan', 'Plan de desarrollo'],
  ['logros', 'Logros'],
  ['historial', 'Historial de cambios'],
] as const;

export function usePlayer(id: string) {
  return useQuery({
    queryKey: qk.player(id),
    queryFn: async () =>
      unwrapMaybe(await supabase.from('players').select('*, categories(name), levels(name)').eq('id', id).maybeSingle()),
  });
}

export default function PlayerDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'general';
  const { data: player, isLoading, error, refetch } = usePlayer(id);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  if (!player)
    return (
      <div>
        <p className="mb-4">No se encontró este expediente.</p>
        <Button asChild variant="outline">
          <Link to="/jugadores">Volver a jugadores</Link>
        </Button>
      </div>
    );

  const age = playerAge(player);

  return (
    <div>
      <Link to="/jugadores" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Jugadores
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <PlayerAvatar player={player} size={84} className="text-[2rem]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[2.2rem] sm:text-[2.7rem]">{fullName(player)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone="info">{player.categories?.name ?? 'Sin categoría'}</Chip>
            <Chip>{player.levels?.name ?? 'Sin nivel'}</Chip>
            <StatusChip status={player.status} />
            <span className="text-sm text-muted-foreground">
              {age.label}
              {player.dominant_hand ? `, ${HAND_LABEL[player.dominant_hand].toLowerCase()}` : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/informes?jugador=${player.id}`}>
              <FileDown /> Informe PDF
            </Link>
          </Button>
          <Button variant="ink" onClick={() => setEditing(true)}>
            <Pencil /> Editar ficha
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max">
            {TABS.map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="min-h-10 px-3">
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="general" className="mt-5">
          <GeneralTab player={player} />
        </TabsContent>
        <TabsContent value="competitivo" className="mt-5">
          <CompetitiveTab playerId={player.id} />
        </TabsContent>
        <TabsContent value="controles" className="mt-5">
          <ControlsTab playerId={player.id} />
        </TabsContent>
        <TabsContent value="evaluaciones" className="mt-5">
          <EvaluationsTab playerId={player.id} />
        </TabsContent>
        <TabsContent value="plan" className="mt-5">
          <PlanTab playerId={player.id} />
        </TabsContent>
        <TabsContent value="logros" className="mt-5">
          <AchievementsTab playerId={player.id} />
        </TabsContent>
        <TabsContent value="historial" className="mt-5">
          <HistoryTab playerId={player.id} />
        </TabsContent>
      </Tabs>

      <PlayerFormDialog open={editing} onOpenChange={setEditing} player={player} />
    </div>
  );
}

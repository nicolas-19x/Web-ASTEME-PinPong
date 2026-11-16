import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from './supabase';

export const qk = {
  categories: ['categories'] as const,
  levels: ['levels'] as const,
  skills: ['skills'] as const,
  controlTests: ['control_tests'] as const,
  players: ['players'] as const,
  player: (id: string) => ['player', id] as const,
  groups: ['training_groups'] as const,
  tournaments: ['tournaments'] as const,
  tournament: (id: string) => ['tournament', id] as const,
  competitions: ['competitions'] as const,
  events: ['sport_events'] as const,
  announcements: ['announcements'] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => unwrap(await supabase.from('categories').select('*').order('sort_order').order('name')),
    staleTime: 5 * 60_000,
  });
}

export function useLevels() {
  return useQuery({
    queryKey: qk.levels,
    queryFn: async () => unwrap(await supabase.from('levels').select('*').order('sort_order')),
    staleTime: 5 * 60_000,
  });
}

export function useSkills() {
  return useQuery({
    queryKey: qk.skills,
    queryFn: async () => unwrap(await supabase.from('skills').select('*').order('sort_order').order('name')),
    staleTime: 5 * 60_000,
  });
}

export function useControlTests() {
  return useQuery({
    queryKey: qk.controlTests,
    queryFn: async () => unwrap(await supabase.from('control_tests').select('*').order('name')),
    staleTime: 5 * 60_000,
  });
}

export const PLAYER_LIST_SELECT =
  'id, first_name, last_names, photo_path, photo_authorized, birth_date, age_reported, age_reported_on, category_id, level_id, dominant_hand, join_date, status, ranking_points, user_id, created_at, categories(name), levels(name)';

export function usePlayers() {
  return useQuery({
    queryKey: qk.players,
    queryFn: async () => unwrap(await supabase.from('players').select(PLAYER_LIST_SELECT).order('first_name')),
  });
}
export type PlayerListItem = NonNullable<ReturnType<typeof usePlayers>['data']>[number];

export function useGroups() {
  return useQuery({
    queryKey: qk.groups,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('training_groups')
          .select('*, categories(name), levels(name), group_schedules(*), group_memberships(id, player_id, end_date)')
          .order('name'),
      ),
  });
}
export type GroupItem = NonNullable<ReturnType<typeof useGroups>['data']>[number];

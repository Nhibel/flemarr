import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteGameLink, fetchGameLinks, saveGameLink, saveGameLinks } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import type { GameLink, SaveGameLinksRequest } from '@shared/game-link.js';

const NO_LINKS: GameLink[] = [];

/** The files the user attached to a game of the DAT by hand. */
export function useGameLinks(datId: string): GameLink[] {
  const { data } = useQuery({
    queryKey: queryKeys.gameLinks(datId),
    queryFn: () => fetchGameLinks(datId),
  });
  return data ?? NO_LINKS;
}

export function useGameLinkMutations(datId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: queryKeys.gameLinks(datId) });

  const attach = useMutation({
    mutationFn: ({ fileCrc, gameId }: { fileCrc: string; gameId: string }) =>
      saveGameLink(datId, fileCrc, gameId),
    onSuccess,
  });
  const attachMany = useMutation({
    mutationFn: (links: SaveGameLinksRequest['links']) => saveGameLinks(datId, links),
    onSuccess,
  });
  const detach = useMutation({
    mutationFn: (fileCrc: string) => deleteGameLink(datId, fileCrc),
    onSuccess,
  });
  return { attach, attachMany, detach };
}

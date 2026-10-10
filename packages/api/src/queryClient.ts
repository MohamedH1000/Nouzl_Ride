import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults ported from Nouzl_Platform's src/App.tsx:125-141, plus the mobile
 * additions noted in the plan (focus/online managers wired at app boot in
 * each app's own src/lib/queryClient.ts, since those need AppState/NetInfo
 * which are platform APIs this package should not depend on directly).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 min
        gcTime: 1000 * 60 * 5, // 5 min
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
      },
    },
  });
}

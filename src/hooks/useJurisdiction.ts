import {useQuery} from '@tanstack/react-query';
import {
  geoFenceManager,
  type JurisdictionResult,
} from '../modules/geoFence/geoFenceModule';

/** Cached jurisdiction check (fail-open warn on error inside the manager). */
export function useJurisdiction(): {
  result: JurisdictionResult | undefined;
  isLoading: boolean;
} {
  const q = useQuery({
    queryKey: ['jurisdiction'],
    queryFn: () => geoFenceManager.checkJurisdiction(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return {result: q.data, isLoading: q.isLoading};
}

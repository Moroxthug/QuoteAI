import { useQuery } from "@tanstack/react-query";

/**
 * Phase 100: is WhatsApp quoting actually live on this server? The public
 * pages only claim it once it is. `false` until the answer arrives (and on the
 * prerendered HTML), so an unconfigured server never flashes the claim.
 */
export function useWhatsappAvailable(): boolean {
  const { data } = useQuery({
    queryKey: ["whatsapp-available"],
    // Plain fetch: the public bundle should not pull in a dashboard API client for one boolean.
    queryFn: async () => (await fetch("/api/whatsapp/available")).json() as Promise<{ available?: boolean }>,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return data?.available === true;
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Alert, AlertList, AlertUpdate, Filters } from "./types";

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity });
export const useMetrics = () => useQuery({ queryKey: ["metrics"], queryFn: api.metrics, staleTime: Infinity });
export const useZones = () => useQuery({ queryKey: ["layers", "zones"], queryFn: api.zones, staleTime: Infinity });
export const useDistrictLayer = () => useQuery({ queryKey: ["layers", "districts"], queryFn: api.districtsLayer, staleTime: Infinity });
export const useAlerts = (f: Filters) => useQuery({ queryKey: ["alerts", f], queryFn: () => api.alerts(f), placeholderData: keepPreviousData });
export const useAlert = (id: string | null) => useQuery({ queryKey: ["alert", id], queryFn: () => api.alert(id!), enabled: !!id });
export const useTimeseries = (id: string | null) =>
  useQuery({ queryKey: ["timeseries", id], queryFn: () => api.timeseries(id!), enabled: !!id, staleTime: Infinity });
export const useAudit = (id: string | null) => useQuery({ queryKey: ["audit", id], queryFn: () => api.audit(id!), enabled: !!id });
export const useSummary = () => useQuery({ queryKey: ["stats", "summary"], queryFn: api.summary });
export const useDistrictStats = () => useQuery({ queryKey: ["stats", "districts"], queryFn: api.districts });
export const useTimeline = () => useQuery({ queryKey: ["stats", "timeline"], queryFn: api.timeline });
export const useDemoActivity = () => useQuery({ queryKey: ["stats", "demo"], queryFn: api.demoActivity, retry: false });
export const useInspectors = () => useQuery({ queryKey: ["stats", "inspectors"], queryFn: api.inspectors });

/** Optimistic status update: list + detail change instantly, rolled back on error. */
export function useUpdateAlert(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertUpdate) => api.update(id, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["alerts"] });
      const prevAlert = qc.getQueryData<Alert>(["alert", id]);
      const prevLists = qc.getQueriesData<AlertList>({ queryKey: ["alerts"] });
      const patch = (a: Alert): Alert => (a.alert_id === id ? { ...a, status: body.status, note: body.note ?? a.note } : a);
      if (prevAlert) qc.setQueryData(["alert", id], patch(prevAlert));
      for (const [key, list] of prevLists) if (list) qc.setQueryData(key, { ...list, items: list.items.map(patch) });
      return { prevAlert, prevLists };
    },
    onError: (_e, _b, ctx) => {
      if (ctx?.prevAlert) qc.setQueryData(["alert", id], ctx.prevAlert);
      ctx?.prevLists.forEach(([key, list]) => qc.setQueryData(key, list));
    },
    onSuccess: (data) => qc.setQueryData(["alert", id], data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["audit", id] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

/** Bulk status change; returns the previous state of every alert so the caller can offer undo. */
export function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { id: string; body: AlertUpdate }[]) => {
      const out: Alert[] = [];
      for (const r of rows) out.push(await api.update(r.id, r.body));
      return out;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alert"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

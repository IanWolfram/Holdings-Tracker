import useSWR from "swr";
import type { CalibrationStatusResponse } from "@/pages/api/calibration-status";

const fetcher = (url: string): Promise<CalibrationStatusResponse> =>
  fetch(url).then((r) => r.json());

export function useCalibrationStatus() {
  const { data } = useSWR<CalibrationStatusResponse>(
    "/api/calibration-status",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  return {
    updatedAt: data?.updatedAt ? new Date(data.updatedAt) : null,
    totalResolved: data?.totalResolved ?? 0,
  };
}

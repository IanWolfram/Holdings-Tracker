import type { Position } from "@/types/position.types";

export interface IBrokerProvider {
  getPositions(): Promise<Position[]>;
}

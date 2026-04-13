export interface Position {
  ticker: string;
  description: string;
  quantity: number;
  marketValue: number;
  gainLoss: number;
  pricePaid: number;
  currentPrice: number;
  history?: number[];
}

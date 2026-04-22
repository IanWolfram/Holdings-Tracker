export type GlobeFocusTarget =
  | { type: "country"; code: string }
  | { type: "stock"; ticker: string }
  | null;

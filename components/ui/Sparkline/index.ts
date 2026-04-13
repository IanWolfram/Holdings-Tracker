export * from "./types";
export * from "./SparklinePath";
export * from "./YAxis";
export * from "./XAxis";
export * from "./Graph";

// Default export Graph as Sparkline for backward compatibility
import { Graph } from "./Graph";
export default Graph;
export { Graph as Sparkline };

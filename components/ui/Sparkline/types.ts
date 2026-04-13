export interface Point {
  x: number;
  y: number;
}

export interface GraphProps {
  data: number[];
  width?: number;
  height?: number;
}

export interface SparklinePathProps {
  points: Point[];
  isPositive: boolean;
}

export interface YAxisProps {
  pl: number;
  py: number;
  height: number;
  max: number;
  min: number;
}

export interface XAxisProps {
  pl: number;
  pr: number;
  py: number;
  width: number;
  height: number;
  points: Point[];
  dataLength: number;
}

export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxElement {
  id: string;
  name: string;
  dimensions: BoxDimensions;
  position: { x: number; y: number; z: number };
  color: string;
}

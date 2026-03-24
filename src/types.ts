export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxElement {
  id: string;
  name: string;
  type: 'cabinet' | 'shelf' | 'divider';
  cabinetId?: string; // if set, element is locked inside this cabinet
  dimensions: BoxDimensions;
  position: { x: number; y: number; z: number };
  color: string;
}

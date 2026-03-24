export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxElement {
  id: string;
  name: string;
  type: 'cabinet' | 'shelf' | 'divider' | 'front' | 'rod' | 'leg' | 'hdf';
  cabinetId?: string; // if set, element is locked inside this cabinet
  frontSide?: 'left' | 'right'; // only for double-door fronts
  legCorner?: 'FL' | 'FR' | 'BL' | 'BR'; // only for legs: Front-Left, Front-Right, Back-Left, Back-Right
  dimensions: BoxDimensions;
  position: { x: number; y: number; z: number };
  color: string;
}

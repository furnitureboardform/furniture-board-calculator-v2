export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxElement {
  id: string;
  name: string;
  type: 'cabinet' | 'shelf' | 'drawer' | 'drawerbox' | 'divider' | 'front' | 'rod' | 'leg' | 'hdf' | 'blenda' | 'group';
  cabinetId?: string; // if set, element is locked inside this cabinet (or group for groupFront)
  groupId?: string;   // for cabinets: which group they belong to
  frontSide?: 'left' | 'right'; // only for double-door fronts
  legCorner?: 'FL' | 'FR' | 'BL' | 'BR'; // only for legs: Front-Left, Front-Right, Back-Left, Back-Right
  blendaSide?: 'left' | 'right'; // only for blenda elements
  openFronts?: boolean; // only for cabinets: front panels shown open at 90°
  hasBottomPanel?: boolean; // only for drawerbox: whether bottom panel is rendered
  dimensions: BoxDimensions;
  position: { x: number; y: number; z: number };
  color: string;
}

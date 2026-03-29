export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxElement {
  id: string;
  name: string;
  type: 'cabinet' | 'shelf' | 'board' | 'drawer' | 'drawerbox' | 'divider' | 'front' | 'rod' | 'leg' | 'hdf' | 'blenda' | 'plinth' | 'group' | 'maskowanica';
  cabinetId?: string; // if set, element is locked inside this cabinet (or group for groupFront)
  groupId?: string;   // for cabinets: which group they belong to
  frontSide?: 'left' | 'right'; // only for double-door fronts
  legCorner?: 'FL' | 'FR' | 'BL' | 'BR'; // only for legs: Front-Left, Front-Right, Back-Left, Back-Right
  blendaSide?: 'left' | 'right'; // only for blenda elements
  maskownicaSide?: 'left' | 'right'; // only for maskowanica elements
  openFronts?: boolean; // only for cabinets: front panels shown open at 90°
  hasBottomPanel?: boolean; // only for drawerbox: whether bottom panel is rendered
  hasRearHdf?: boolean;     // only for drawerbox: whether rear HDF panel is shown
  hasTopRails?: boolean;    // only for drawerbox: whether two 100mm top rail panels are shown
  hasSidePanels?: boolean;  // only for drawerbox: whether side blenda panels are shown
  adjustedFrontWidth?: number;  // only for drawer: override outer front face width
  adjustedFrontHeight?: number; // only for drawer: auto-calculated height (Dostosuj front switch)
  frontHeight?: number;         // only for drawer: manual front height override
  parentIsDrawerbox?: boolean;  // only for drawer: true when parent is a drawerbox
  pushToOpen?: boolean;         // only for drawer: push-to-open mechanism
  dimensions: BoxDimensions;
  position: { x: number; y: number; z: number };
  color: string;
}

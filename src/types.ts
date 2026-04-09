export interface BoardSize {
  width: number;
  depth: number;
  height: number;
}

export interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxElement {
  id: string;
  name: string;
  type: 'cabinet' | 'shelf' | 'board' | 'drawer' | 'drawerbox' | 'divider' | 'front' | 'rod' | 'leg' | 'hdf' | 'rearboard' | 'blenda' | 'plinth' | 'group' | 'maskowanica' | 'boxkuchenny';
  cabinetId?: string; // if set, element is locked inside this cabinet (or group for groupFront)
  groupIds?: string[];  // for cabinets: which groups they belong to (a cabinet can belong to multiple groups)
  frontSide?: 'left' | 'right'; // only for double-door fronts
  legCorner?: 'FL' | 'FR' | 'BL' | 'BR'; // only for legs: Front-Left, Front-Right, Back-Left, Back-Right
  blendaSide?: 'left' | 'right' | 'top'; // only for blenda elements
  blendaScope?: 'cabinet' | 'group'; // set on standalone cabinet blendas (left/right/top), absent on drawerbox blendas; 'group' for group-level blendas
  maskownicaSide?: 'left' | 'right' | 'bottom' | 'top'; // only for maskowanica elements
  niepelna?: boolean; // only for maskowanica: depth forced to 80mm
  stretchWithLegs?: boolean; // for side maskownica and side blenda: extend height to cover legs/plinth
  openFronts?: boolean; // only for cabinets: front panels shown open at 90°
  noHandle?: boolean;  // only for fronts: do not count handle in report
  hasBottomPanel?: boolean; // only for drawerbox: whether bottom panel is rendered
  hasRearHdf?: boolean;     // only for drawerbox: whether rear HDF panel is shown
  hasTopRails?: boolean;    // only for drawerbox: whether two 100mm top rail panels are shown
  hasSidePanels?: boolean;  // only for drawerbox: whether side blenda panels are shown
  adjustedFrontWidth?: number;  // only for drawer: override outer front face width
  adjustedFrontHeight?: number; // only for drawer: auto-calculated height (Dostosuj front switch)
  frontHeight?: number;         // only for drawer: manual front height override
  parentIsDrawerbox?: boolean;  // only for drawer: true when parent is a drawerbox
  externalFront?: boolean;      // only for drawer: when in normal cabinet, front flush with cabinet face and wider
  pushToOpen?: boolean;         // only for drawer: push-to-open mechanism
  finishId?: string;            // optional: selected finish/veneer from Firebase
  frontFinishId?: string;       // only for drawer: separate finish for the front face panel
  handleId?: string;            // optional: selected handle type from Firebase (for fronts)
  dimensions: BoxDimensions;
  position: { x: number; y: number; z: number };
  color: string;
  rotationY?: 0 | 90 | 180 | 270;
}

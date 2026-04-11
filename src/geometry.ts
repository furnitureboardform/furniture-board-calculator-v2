import type { BoxElement } from './types';
import { PANEL_T, STACK_OVERLAP, SNAP_DIST, DRAWER_RAIL_CLEARANCE, FRONT_INSET } from './constants';
import {
  computeHdfForCabinet,
  computeRearboardForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computeFrontForCabinet,
  computeMaskowanicaForCabinet,
  computeBlendaForCabinet,
  computeCountertopForCabinet,
  recomputeGroups,
} from './computeElements';

/** Returns true if boxes a and b have any XZ footprint overlap. */
export function getBoxOverlap(a: BoxElement, b: BoxElement): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < (a.dimensions.width + b.dimensions.width) / 2 &&
    Math.abs(a.position.z - b.position.z) < (a.dimensions.depth + b.dimensions.depth) / 2
  );
}

/** Returns true when boxes overlap by more than STACK_OVERLAP in BOTH X and Z. */
export function getBoxStackOverlap(a: BoxElement, b: BoxElement): boolean {
  const ox = (a.dimensions.width + b.dimensions.width) / 2 - Math.abs(a.position.x - b.position.x);
  const oz = (a.dimensions.depth + b.dimensions.depth) / 2 - Math.abs(a.position.z - b.position.z);
  return ox > STACK_OVERLAP && oz > STACK_OVERLAP;
}

/** Returns the Y level (bottom) where box should sit, based on overlapping boxes. */
export function computeYForBox(box: BoxElement, allElements: BoxElement[], roomH = Infinity): number {
  let maxTop = 0;
  for (const other of allElements) {
    if (other.id === box.id) continue;
    if (other.type === 'group' || other.type === 'shelf' || other.type === 'board' || other.type === 'drawer' || other.type === 'drawerbox' || other.type === 'blenda' || other.type === 'divider' || other.type === 'front' || other.type === 'rod' || other.type === 'leg' || other.type === 'hdf' || other.type === 'rearboard' || other.type === 'plinth' || other.type === 'maskowanica') continue;
    if (box.groupIds?.length && other.groupIds?.some((g) => box.groupIds!.includes(g))) continue;
    if (getBoxStackOverlap(box, other)) {
      const wouldFitBelow = box.position.y + box.dimensions.height <= other.position.y;
      if (!wouldFitBelow) {
        maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
      }
    }
  }
  const legs = allElements.filter((e) => e.type === 'leg' && e.cabinetId === box.id);
  if (legs.length > 0) {
    maxTop = Math.max(maxTop, maxTop + legs[0].dimensions.height);
  }
  return Math.min(maxTop, Math.max(0, roomH - box.dimensions.height));
}

/** When a cabinet is placed on top of another cabinet, match its width/depth to the lower one. */
export function fitCabinetToBelow(cabinet: BoxElement, allElements: BoxElement[]): BoxElement {
  for (const other of allElements) {
    if (other.id === cabinet.id || other.type !== 'cabinet') continue;
    const otherTop = other.position.y + other.dimensions.height;
    if (Math.abs(cabinet.position.y - otherTop) > 0.001) continue;
    if (Math.abs(cabinet.position.x - other.position.x) > SNAP_DIST) continue;
    if (Math.abs(cabinet.position.z - other.position.z) > SNAP_DIST) continue;
    return {
      ...cabinet,
      dimensions: { ...cabinet.dimensions, width: other.dimensions.width, depth: other.dimensions.depth },
      position: { ...cabinet.position, x: other.position.x, z: other.position.z },
    };
  }
  return cabinet;
}

/** Auto-fit shelf depth (Z) to the inner depth of the cabinet it's inside. */
export function fitShelfDepthToCabinet(shelf: BoxElement, allElements: BoxElement[]): BoxElement {
  for (const other of allElements) {
    if (other.id === shelf.id || other.type !== 'cabinet') continue;
    const yOverlap =
      shelf.position.y < other.position.y + other.dimensions.height &&
      shelf.position.y + shelf.dimensions.height > other.position.y;
    if (!yOverlap) continue;
    const insideX =
      Math.abs(shelf.position.x - other.position.x) < other.dimensions.width / 2;
    const insideZ =
      Math.abs(shelf.position.z - other.position.z) < other.dimensions.depth / 2;
    if (!insideX || !insideZ) continue;
    const innerWidth = other.dimensions.width - 2 * PANEL_T;
    const fullDepth = other.dimensions.depth;
    return {
      ...shelf,
      dimensions: { ...shelf.dimensions, width: Math.max(0.01, innerWidth), depth: Math.max(0.01, fullDepth) },
      position: { ...shelf.position, x: other.position.x, z: other.position.z },
    };
  }
  return shelf;
}

function _getBays(cab: BoxElement, dividers: BoxElement[]): { left: number; right: number }[] {
  const leftWall = cab.position.x - cab.dimensions.width / 2 + PANEL_T;
  const rightWall = cab.position.x + cab.dimensions.width / 2 - PANEL_T;
  const sortedX = [...dividers].map((d) => d.position.x).sort((a, b) => a - b);
  const bays: { left: number; right: number }[] = [];
  let prev = leftWall;
  for (const divX of sortedX) {
    const divLeft = divX - PANEL_T / 2;
    if (divLeft > prev + 0.001) bays.push({ left: prev, right: divLeft });
    prev = divX + PANEL_T / 2;
  }
  if (rightWall > prev + 0.001) bays.push({ left: prev, right: rightWall });
  return bays;
}

/** Fits shelf width/x to the bay (between dividers) whose centre is closest to shelf.position.x. */
export function fitShelfToBay(shelf: BoxElement, allElements: BoxElement[]): BoxElement {
  if (!shelf.cabinetId) return shelf;
  const cab = allElements.find((e) => e.id === shelf.cabinetId && e.type === 'cabinet');
  if (!cab) return shelf;
  const dividers = allElements.filter((e) => e.cabinetId === shelf.cabinetId && e.type === 'divider');
  if (dividers.length === 0) return shelf;
  const bays = _getBays(cab, dividers);
  if (bays.length === 0) return shelf;
  let best = bays[0];
  let bestDist = Math.abs((best.left + best.right) / 2 - shelf.position.x);
  for (const bay of bays) {
    const d = Math.abs((bay.left + bay.right) / 2 - shelf.position.x);
    if (d < bestDist) { bestDist = d; best = bay; }
  }
  return {
    ...shelf,
    dimensions: { ...shelf.dimensions, width: Math.max(0.01, best.right - best.left) },
    position: { ...shelf.position, x: (best.left + best.right) / 2 },
  };
}

/**
 * Like fitShelfToBay but for drawers directly in a cabinet.
 * Sets dimensions.width = bayWidth - 2*DRAWER_RAIL_CLEARANCE and
 * adjustedFrontWidth = bayWidth - 2*FRONT_INSET.
 */
export function fitDrawerToBay(drawer: BoxElement, allElements: BoxElement[]): BoxElement {
  if (!drawer.cabinetId) return drawer;
  const cab = allElements.find((e) => e.id === drawer.cabinetId && e.type === 'cabinet');
  if (!cab) return drawer;
  const dividers = allElements.filter((e) => e.cabinetId === drawer.cabinetId && e.type === 'divider');
  if (dividers.length === 0) return drawer;
  const bays = _getBays(cab, dividers);
  if (bays.length === 0) return drawer;
  let best = bays[0];
  let bestDist = Math.abs((best.left + best.right) / 2 - drawer.position.x);
  for (const bay of bays) {
    const d = Math.abs((bay.left + bay.right) / 2 - drawer.position.x);
    if (d < bestDist) { bestDist = d; best = bay; }
  }
  const bayWidth = best.right - best.left;
  return {
    ...drawer,
    dimensions: { ...drawer.dimensions, width: Math.max(0.01, bayWidth - 2 * DRAWER_RAIL_CLEARANCE) },
    adjustedFrontWidth: Math.max(0.01, bayWidth - 2 * FRONT_INSET),
    position: { ...drawer.position, x: (best.left + best.right) / 2 },
  };
}

/** Moves shelf to the next bay (cycles through all bays). */
export function switchShelfToNextBay(shelf: BoxElement, allElements: BoxElement[]): BoxElement {
  if (!shelf.cabinetId) return shelf;
  const cab = allElements.find((e) => e.id === shelf.cabinetId && e.type === 'cabinet');
  if (!cab) return shelf;
  const dividers = allElements.filter((e) => e.cabinetId === shelf.cabinetId && e.type === 'divider');
  if (dividers.length === 0) return shelf;
  const bays = _getBays(cab, dividers);
  if (bays.length <= 1) return shelf;
  let curIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < bays.length; i++) {
    const d = Math.abs((bays[i].left + bays[i].right) / 2 - shelf.position.x);
    if (d < bestDist) { bestDist = d; curIdx = i; }
  }
  const next = bays[(curIdx + 1) % bays.length];
  return {
    ...shelf,
    dimensions: { ...shelf.dimensions, width: Math.max(0.01, next.right - next.left) },
    position: { ...shelf.position, x: (next.left + next.right) / 2 },
  };
}

/** Like switchShelfToNextBay but for drawers: also updates adjustedFrontWidth. */
export function switchDrawerToNextBay(drawer: BoxElement, allElements: BoxElement[]): BoxElement {
  if (!drawer.cabinetId) return drawer;
  const cab = allElements.find((e) => e.id === drawer.cabinetId && e.type === 'cabinet');
  if (!cab) return drawer;
  const dividers = allElements.filter((e) => e.cabinetId === drawer.cabinetId && e.type === 'divider');
  if (dividers.length === 0) return drawer;
  const bays = _getBays(cab, dividers);
  if (bays.length <= 1) return drawer;
  let curIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < bays.length; i++) {
    const d = Math.abs((bays[i].left + bays[i].right) / 2 - drawer.position.x);
    if (d < bestDist) { bestDist = d; curIdx = i; }
  }
  const next = bays[(curIdx + 1) % bays.length];
  const bayWidth = next.right - next.left;
  return {
    ...drawer,
    dimensions: { ...drawer.dimensions, width: Math.max(0.01, bayWidth - 2 * DRAWER_RAIL_CLEARANCE) },
    adjustedFrontWidth: Math.max(0.01, bayWidth - 2 * FRONT_INSET),
    position: { ...drawer.position, x: (next.left + next.right) / 2 },
  };
}

/**
 * Builds sorted list of slot-boundary Y values for a cabinet:
 * cabinet bottom/top panels + top/bottom edges of all shelves and rods.
 */
function _getDividerSlotBoundaries(cab: BoxElement, allElements: BoxElement[]): number[] {
  const cabBottom = cab.position.y + PANEL_T;
  const cabTop = cab.position.y + cab.dimensions.height - PANEL_T;
  const set = new Set<number>([cabBottom, cabTop]);
  for (const e of allElements) {
    if (e.cabinetId !== cab.id) continue;
    if (e.type !== 'shelf' && e.type !== 'rod') continue;
    set.add(e.position.y);
    set.add(e.position.y + e.dimensions.height);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Returns the Y bottom and height for a divider.
 * Finds the free vertical slot (between shelves/rods/walls) whose midpoint is
 * closest to dividerY, so the divider auto-fits between the nearest obstacles.
 */
export function computeDividerBounds(
  cabinetId: string,
  dividerY: number,
  allElements: BoxElement[]
): { y: number; height: number } {
  const cab = allElements.find((e) => e.id === cabinetId);
  if (!cab) return { y: 0, height: PANEL_T };

  const boundaries = _getDividerSlotBoundaries(cab, allElements);

  let bestY = boundaries[0];
  let bestH = Math.max(PANEL_T, boundaries[1] - boundaries[0]);
  let bestDist = Infinity;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const slotY = boundaries[i];
    const slotH = boundaries[i + 1] - boundaries[i];
    const slotMid = slotY + slotH / 2;
    const dist = Math.abs(slotMid - dividerY);
    if (dist < bestDist) {
      bestDist = dist;
      bestY = slotY;
      bestH = Math.max(PANEL_T, slotH);
    }
  }

  return { y: bestY, height: bestH };
}

/** Moves a divider to the next free vertical slot (cycles upward through slots). */
export function switchDividerToNextSlot(divider: BoxElement, allElements: BoxElement[]): BoxElement {
  if (!divider.cabinetId) return divider;
  const cab = allElements.find((e) => e.id === divider.cabinetId && (e.type === 'cabinet' || e.type === 'boxkuchenny'));
  if (!cab) return divider;

  const boundaries = _getDividerSlotBoundaries(cab, allElements);

  // Build slots (gaps between consecutive boundaries that are taller than a panel)
  const slots: { y: number; height: number }[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const h = boundaries[i + 1] - boundaries[i];
    if (h > PANEL_T + 0.001) slots.push({ y: boundaries[i], height: h });
  }
  if (slots.length <= 1) return divider;

  // Find current slot by closest midpoint
  const curMid = divider.position.y + divider.dimensions.height / 2;
  let curIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const d = Math.abs(slots[i].y + slots[i].height / 2 - curMid);
    if (d < bestDist) { bestDist = d; curIdx = i; }
  }

  const next = slots[(curIdx + 1) % slots.length];
  return {
    ...divider,
    position: { ...divider.position, y: next.y },
    dimensions: { ...divider.dimensions, height: next.height },
  };
}

const STRETCH_BLOCKER_TYPES = new Set<BoxElement['type']>(['cabinet', 'shelf', 'board', 'boxkuchenny']);

/**
 * Returns the maximum allowed dimension when stretching `el` along `axis` in direction `dir`,
 * limited by nearest free-standing element in that direction.
 * position.x / position.z are centers; position.y is bottom edge.
 */
export function computeStretchCollisionMax(
  el: BoxElement,
  axis: 'width' | 'height' | 'depth',
  dir: number,
  elements: BoxElement[]
): number {
  let max = Infinity;
  const EPS = 0.001;

  for (const other of elements) {
    if (other.id === el.id) continue;
    const isMaskowanica = other.type === 'maskowanica';
    if (other.cabinetId && !isMaskowanica) continue;
    if (!isMaskowanica && !STRETCH_BLOCKER_TYPES.has(other.type)) continue;

    if (axis === 'width') {
      const yOverlap =
        el.position.y < other.position.y + other.dimensions.height - EPS &&
        el.position.y + el.dimensions.height > other.position.y + EPS;
      const zOverlap =
        Math.abs(el.position.z - other.position.z) <
        (el.dimensions.depth + other.dimensions.depth) / 2 - EPS;
      if (!yOverlap || !zOverlap) continue;
      const fixedEdge = el.position.x - dir * el.dimensions.width / 2;
      if (dir > 0) {
        const otherLeft = other.position.x - other.dimensions.width / 2;
        if (otherLeft >= el.position.x + el.dimensions.width / 2 - EPS)
          max = Math.min(max, otherLeft - fixedEdge);
      } else {
        const otherRight = other.position.x + other.dimensions.width / 2;
        if (otherRight <= el.position.x - el.dimensions.width / 2 + EPS)
          max = Math.min(max, fixedEdge - otherRight);
      }
    } else if (axis === 'height') {
      const xOverlap =
        Math.abs(el.position.x - other.position.x) <
        (el.dimensions.width + other.dimensions.width) / 2 - EPS;
      const zOverlap =
        Math.abs(el.position.z - other.position.z) <
        (el.dimensions.depth + other.dimensions.depth) / 2 - EPS;
      if (!xOverlap || !zOverlap) continue;
      if (dir > 0) {
        const currentTop = el.position.y + el.dimensions.height;
        if (other.position.y >= currentTop - EPS)
          max = Math.min(max, other.position.y - el.position.y);
      } else {
        const otherTop = other.position.y + other.dimensions.height;
        if (otherTop <= el.position.y + EPS)
          max = Math.min(max, el.position.y + el.dimensions.height - otherTop);
      }
    } else {
      const yOverlap =
        el.position.y < other.position.y + other.dimensions.height - EPS &&
        el.position.y + el.dimensions.height > other.position.y + EPS;
      const xOverlap =
        Math.abs(el.position.x - other.position.x) <
        (el.dimensions.width + other.dimensions.width) / 2 - EPS;
      if (!yOverlap || !xOverlap) continue;
      const fixedEdge = el.position.z - dir * el.dimensions.depth / 2;
      if (dir > 0) {
        const otherNear = other.position.z - other.dimensions.depth / 2;
        if (otherNear >= el.position.z + el.dimensions.depth / 2 - EPS)
          max = Math.min(max, otherNear - fixedEdge);
      } else {
        const otherFar = other.position.z + other.dimensions.depth / 2;
        if (otherFar <= el.position.z - el.dimensions.depth / 2 + EPS)
          max = Math.min(max, fixedEdge - otherFar);
      }
    }
  }

  return max;
}

/** Recomputes Y for all boxes bottom-up (used after dimension changes). */
export function recomputeAllY(elements: BoxElement[], roomH = Infinity, skipDividerRecompute = false): BoxElement[] {
  const originalY = new Map(elements.map((el) => [el.id, el.position.y]));
  const ordered = [...elements].sort(
    (a, b) => (originalY.get(a.id) ?? 0) - (originalY.get(b.id) ?? 0)
  );
  const resultMap = new Map(
    elements.map((el) => [el.id, { ...el, position: { ...el.position } }])
  );
  for (const el of ordered) {
    const box = resultMap.get(el.id)!;
    if (box.type === 'group' || box.type === 'shelf' || box.type === 'board' || box.type === 'drawer' || box.type === 'drawerbox' || box.type === 'blenda' || box.type === 'divider' || box.type === 'front' || box.type === 'rod' || box.type === 'leg' || box.type === 'hdf' || box.type === 'rearboard' || box.type === 'maskowanica') continue;
    const elOriginalY = originalY.get(el.id) ?? 0;
    let maxTop = 0;
    for (const [id, other] of resultMap) {
      if (id === box.id) continue;
      if (other.type === 'group' || other.type === 'shelf' || other.type === 'board' || other.type === 'drawer' || other.type === 'drawerbox' || other.type === 'blenda' || other.type === 'divider' || other.type === 'front' || other.type === 'rod' || other.type === 'leg' || other.type === 'hdf' || other.type === 'rearboard' || other.type === 'plinth' || other.type === 'maskowanica') continue;
      if (box.groupIds?.length && other.groupIds?.some((g) => box.groupIds!.includes(g))) continue;
      if ((originalY.get(id) ?? 0) <= elOriginalY + 0.001) {
        if (getBoxStackOverlap(box, other)) {
          maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
        }
      }
    }
    const legChildren = [...resultMap.values()].filter((e) => e.type === 'leg' && e.cabinetId === box.id);
    if (legChildren.length > 0) {
      maxTop = maxTop + legChildren[0].dimensions.height;
    }
    const withY = { ...box, position: { ...box.position, y: Math.min(Math.max(maxTop, elOriginalY), Math.max(0, roomH - box.dimensions.height)) } };
    const fitted = maxTop > 0 ? fitCabinetToBelow(withY, [...resultMap.values()]) : withY;
    resultMap.set(el.id, fitted);
  }
  // Recompute divider bounds (skip when shelf was resized — dividers should not be affected)
  if (!skipDividerRecompute) {
    const allSettled = [...resultMap.values()];
    for (const el of allSettled) {
      if (el.type !== 'divider' || !el.cabinetId) continue;
      const bounds = computeDividerBounds(el.cabinetId, el.position.y + el.dimensions.height / 2, allSettled);
      const cab = allSettled.find((e) => e.id === el.cabinetId);
      resultMap.set(el.id, {
        ...el,
        dimensions: { ...el.dimensions, height: bounds.height, depth: cab ? cab.dimensions.depth : el.dimensions.depth },
        position: { ...el.position, y: bounds.y },
      });
    }
  }
  // Recompute front panel positions
  const allSettled2 = [...resultMap.values()];
  for (const el of allSettled2) {
    if (el.type !== 'front' || !el.cabinetId) continue;
    const cab = allSettled2.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeFrontForCabinet(el, cab));
  }
  // Recompute leg positions
  const allSettled3 = [...resultMap.values()];
  for (const el of allSettled3) {
    if (el.type !== 'leg' || !el.cabinetId) continue;
    const cab = allSettled3.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeLegsForCabinet(el, cab));
  }
  // Recompute HDF and rearboard positions
  const allSettled4 = [...resultMap.values()];
  for (const el of allSettled4) {
    if (!el.cabinetId) continue;
    const cab = allSettled4.find((e) => e.id === el.cabinetId);
    if (!cab) continue;
    if (el.type === 'hdf') resultMap.set(el.id, computeHdfForCabinet(el, cab));
    else if (el.type === 'rearboard') resultMap.set(el.id, computeRearboardForCabinet(el, cab));
  }
  // Recompute plinth positions
  const allSettled5 = [...resultMap.values()];
  for (const el of allSettled5) {
    if (el.type !== 'plinth' || !el.cabinetId) continue;
    const cab = allSettled5.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computePlinthForCabinet(el, cab, allSettled5));
  }
  // Recompute cabinet blenda positions (top first, then L/R which depend on plinth and top blenda)
  const allSettledB1 = [...resultMap.values()];
  for (const el of allSettledB1) {
    if (el.type !== 'blenda' || el.blendaScope !== 'cabinet' || el.blendaSide !== 'top' || !el.cabinetId) continue;
    const cab = allSettledB1.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeBlendaForCabinet(el, cab, allSettledB1));
  }
  const allSettledB2 = [...resultMap.values()];
  for (const el of allSettledB2) {
    if (el.type !== 'blenda' || el.blendaScope !== 'cabinet' || (el.blendaSide !== 'left' && el.blendaSide !== 'right') || !el.cabinetId) continue;
    const cab = allSettledB2.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeBlendaForCabinet(el, cab, allSettledB2));
  }
  // Recompute maskowanica positions
  const allSettled6 = [...resultMap.values()];
  for (const el of allSettled6) {
    if (el.type !== 'maskowanica' || !el.cabinetId) continue;
    const cab = allSettled6.find((e) => e.id === el.cabinetId && e.type === 'cabinet');
    if (cab) resultMap.set(el.id, computeMaskowanicaForCabinet(el, cab, allSettled6));
  }
  const allSettled7 = [...resultMap.values()];
  for (const el of allSettled7) {
    if (el.type !== 'countertop' || !el.cabinetId) continue;
    const cab = allSettled7.find((e) => e.id === el.cabinetId);
    if (cab && (cab.type === 'cabinet' || cab.type === 'boxkuchenny')) resultMap.set(el.id, computeCountertopForCabinet(el, cab));
  }
  const settled = elements.map((el) => resultMap.get(el.id)!);
  return recomputeGroups(settled);
}

export function clampYBoundsToObstacles(
  obstacles: BoxElement[],
  elemHeight: number,
  proposedY: number,
  mnY: number,
  mxY: number
): { mnY: number; mxY: number } {
  for (const obs of obstacles) {
    if (obs.position.y > proposedY) {
      mxY = Math.min(mxY, obs.position.y - elemHeight);
    } else {
      mnY = Math.max(mnY, obs.position.y + obs.dimensions.height);
    }
  }
  return { mnY, mxY };
}

export const DRAWER_FACE_H_DEFAULT = 0.170;
export const DRAWER_BOX_H = 0.145;
export const DRAWER_EXT_FRONT_H = 0.196;

function elementTopEdge(e: BoxElement): number {
  return e.position.y + (
    e.type === 'drawer'
      ? (e.adjustedFrontHeight ?? e.frontHeight ?? DRAWER_FACE_H_DEFAULT)
      : e.dimensions.height
  );
}

export function computeDrawerYBounds(
  drawer: BoxElement,
  parent: BoxElement,
  allElements: BoxElement[]
): { minY: number; maxY: number } {
  const faceH = drawer.adjustedFrontHeight ?? drawer.frontHeight ?? DRAWER_FACE_H_DEFAULT;
  const isExt = drawer.externalFront === true;
  const boxH = drawer.dimensions.height;
  const bottomOffset = parent.type === 'drawerbox' ? (parent.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
  const extOverhang = isExt ? (faceH - boxH) / 2 : 0;
  const minY = parent.position.y + bottomOffset + extOverhang;
  // external front can overlap the top plate (górna płyta) — use full cabinet height
  const innerTop = isExt
    ? parent.position.y + parent.dimensions.height
    : parent.position.y + parent.dimensions.height - PANEL_T;

  let nearestAbove = Infinity;
  let nearestBelow = -Infinity;
  for (const e of allElements) {
    if (e.cabinetId !== parent.id || e.id === drawer.id) continue;
    if (isExt) {
      if (!(e.type === 'drawer' && e.externalFront === true)) continue;
      if (e.position.y > drawer.position.y) {
        nearestAbove = Math.min(nearestAbove, e.position.y);
      } else if (e.position.y < drawer.position.y) {
        nearestBelow = Math.max(nearestBelow, elementTopEdge(e));
      }
    } else {
      if (e.type !== 'shelf' && e.type !== 'drawer' && e.type !== 'drawerbox') continue;
      if (e.position.y >= drawer.position.y + faceH) {
        nearestAbove = Math.min(nearestAbove, e.position.y);
      } else {
        const top = elementTopEdge(e);
        if (top <= drawer.position.y) nearestBelow = Math.max(nearestBelow, top);
      }
    }
  }

  const computedMinY = Math.max(minY, nearestBelow);
  if (isExt) {
    const cabinetMaxY = innerTop - (boxH + faceH) / 2;
    const elementMaxY = nearestAbove < Infinity ? nearestAbove - faceH : Infinity;
    return { minY: computedMinY, maxY: Math.max(computedMinY, Math.min(cabinetMaxY, elementMaxY)) };
  }
  const topBound = Math.min(innerTop, nearestAbove);
  return { minY: computedMinY, maxY: Math.max(computedMinY, topBound - faceH) };
}

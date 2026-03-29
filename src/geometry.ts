import type { BoxElement } from './types';
import { PANEL_T, STACK_OVERLAP } from './constants';
import {
  computeHdfForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computeFrontForCabinet,
  computeMaskowanicaForCabinet,
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
    if (other.type === 'shelf' || other.type === 'drawer' || other.type === 'drawerbox' || other.type === 'blenda' || other.type === 'divider' || other.type === 'front' || other.type === 'rod' || other.type === 'leg' || other.type === 'hdf' || other.type === 'plinth' || other.type === 'maskowanica') continue;
    if (getBoxStackOverlap(box, other)) {
      maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
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
    if (!getBoxOverlap(cabinet, other)) continue;
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

/** Returns the Y bottom and height for a divider based on shelves above/below in the same cabinet. */
export function computeDividerBounds(
  cabinetId: string,
  dividerY: number,
  allElements: BoxElement[]
): { y: number; height: number } {
  const cab = allElements.find((e) => e.id === cabinetId);
  if (!cab) return { y: 0, height: PANEL_T };

  const cabBottom = cab.position.y + PANEL_T;
  const cabTop = cab.position.y + cab.dimensions.height - PANEL_T;

  const surfaces: number[] = [cabBottom, cabTop];
  for (const el of allElements) {
    if (el.cabinetId !== cabinetId || el.type !== 'shelf') continue;
    surfaces.push(el.position.y);
    surfaces.push(el.position.y + el.dimensions.height);
  }
  surfaces.sort((a, b) => a - b);

  let floorY = cabBottom;
  let ceilY = cabTop;
  for (let i = 0; i < surfaces.length - 1; i++) {
    if (surfaces[i] <= dividerY + 0.001 && dividerY < surfaces[i + 1]) {
      floorY = surfaces[i];
      ceilY = surfaces[i + 1];
      break;
    }
  }

  return { y: floorY, height: Math.max(PANEL_T, ceilY - floorY) };
}

/** Recomputes Y for all boxes bottom-up (used after dimension changes). */
export function recomputeAllY(elements: BoxElement[], roomH = Infinity): BoxElement[] {
  const originalY = new Map(elements.map((el) => [el.id, el.position.y]));
  const ordered = [...elements].sort(
    (a, b) => (originalY.get(a.id) ?? 0) - (originalY.get(b.id) ?? 0)
  );
  const resultMap = new Map(
    elements.map((el) => [el.id, { ...el, position: { ...el.position } }])
  );
  for (const el of ordered) {
    const box = resultMap.get(el.id)!;
    if (box.type === 'shelf' || box.type === 'drawer' || box.type === 'drawerbox' || box.type === 'blenda' || box.type === 'divider' || box.type === 'front' || box.type === 'rod' || box.type === 'leg' || box.type === 'hdf' || box.type === 'maskowanica') continue;
    const elOriginalY = originalY.get(el.id) ?? 0;
    let maxTop = 0;
    for (const [id, other] of resultMap) {
      if (id === box.id) continue;
      if (other.type === 'shelf' || other.type === 'drawer' || other.type === 'drawerbox' || other.type === 'blenda' || other.type === 'divider' || other.type === 'front' || other.type === 'rod' || other.type === 'leg' || other.type === 'hdf' || other.type === 'plinth' || other.type === 'maskowanica') continue;
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
  // Recompute divider bounds
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
  // Recompute HDF positions
  const allSettled4 = [...resultMap.values()];
  for (const el of allSettled4) {
    if (el.type !== 'hdf' || !el.cabinetId) continue;
    const cab = allSettled4.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeHdfForCabinet(el, cab));
  }
  // Recompute plinth positions
  const allSettled5 = [...resultMap.values()];
  for (const el of allSettled5) {
    if (el.type !== 'plinth' || !el.cabinetId) continue;
    const cab = allSettled5.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computePlinthForCabinet(el, cab, allSettled5));
  }
  // Recompute maskowanica positions
  const allSettled6 = [...resultMap.values()];
  for (const el of allSettled6) {
    if (el.type !== 'maskowanica' || !el.cabinetId) continue;
    const cab = allSettled6.find((e) => e.id === el.cabinetId && e.type === 'cabinet');
    if (cab) resultMap.set(el.id, computeMaskowanicaForCabinet(el, cab, allSettled6));
  }
  const settled = elements.map((el) => resultMap.get(el.id)!);
  return recomputeGroups(settled);
}

const DRAWER_FACE_H_DEFAULT = 0.170;

/**
 * Returns the valid Y range for a drawer based on its front face bounds.
 * Front bottom = drawer.position.y, front top = drawer.position.y + faceH.
 * minY: front bottom at inner bottom of parent.
 * maxY: front top just below nearest obstacle above (sibling shelf/drawer) or parent inner top.
 */
export function computeDrawerYBounds(
  drawer: BoxElement,
  parent: BoxElement,
  allElements: BoxElement[]
): { minY: number; maxY: number } {
  const faceH = drawer.adjustedFrontHeight ?? drawer.frontHeight ?? DRAWER_FACE_H_DEFAULT;
  const bottomOffset = parent.type === 'drawerbox' ? (parent.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
  const minY = parent.position.y + bottomOffset;
  const innerTop = parent.position.y + parent.dimensions.height - PANEL_T;

  // Find bottom edge of nearest sibling above current drawer position
  const siblingsAbove = allElements.filter(
    (e) =>
      e.cabinetId === parent.id &&
      e.id !== drawer.id &&
      e.position.y > drawer.position.y &&
      (e.type === 'shelf' || e.type === 'drawer' || e.type === 'drawerbox')
  );
  const nearestObstacle = siblingsAbove.length > 0
    ? Math.min(...siblingsAbove.map((e) => e.position.y))
    : Infinity;

  const topBound = Math.min(innerTop, nearestObstacle);
  const maxY = Math.max(minY, topBound - faceH);
  return { minY, maxY };
}

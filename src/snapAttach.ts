import type { BoxElement } from './types';
import { PANEL_T, SNAP_DIST, STACK_OVERLAP, ATTACH_DIST } from './constants';
import { computeDividerBounds, clampYBoundsToObstacles, effectiveHW as ehw, effectiveHD as ehd } from './geometry';

/** Like findNearCabinet but skips `avoidCabId` until the element has moved past the hysteresis zone. */
export function findNearCabinetHysteresis(
  elem: BoxElement,
  allElements: BoxElement[],
  avoidCabId: string | null
): BoxElement | null {
  for (const other of allElements) {
    if (other.id === elem.id || other.type !== 'cabinet') continue;
    const yOverlap =
      elem.position.y < other.position.y + other.dimensions.height &&
      elem.position.y + elem.dimensions.height > other.position.y;
    if (!yOverlap) continue;
    const inX = Math.abs(elem.position.x - other.position.x) < other.dimensions.width / 2 + ATTACH_DIST;
    const inZ = Math.abs(elem.position.z - other.position.z) < other.dimensions.depth / 2 + ATTACH_DIST;
    if (!inX || !inZ) continue;
    if (other.id === avoidCabId) continue;
    return other;
  }
  return null;
}

/** Attaches a free shelf/divider to the given cabinet and fits its dimensions/position. */
export function attachAndFit(elem: BoxElement, cab: BoxElement, allElements: BoxElement[]): BoxElement {
  if (elem.type === 'shelf') {
    const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
    const depth = cab.dimensions.depth;
    let mnY = cab.position.y;
    let mxY = cab.position.y + cab.dimensions.height - elem.dimensions.height;
    const drawerboxes = allElements.filter((e) => e.cabinetId === cab.id && e.type === 'drawerbox');
    ({ mnY, mxY } = clampYBoundsToObstacles(drawerboxes, elem.dimensions.height, elem.position.y, mnY, mxY));
    const clampedY = Math.min(Math.max(mnY, elem.position.y), Math.max(mnY, mxY));
    return {
      ...elem,
      cabinetId: cab.id,
      dimensions: { ...elem.dimensions, width: innerWidth, depth },
      position: { x: cab.position.x, y: clampedY, z: cab.position.z },
    };
  }
  if (elem.type === 'rod') {
    const ROD_D = 0.025;
    const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
    const minY = cab.position.y + PANEL_T;
    const maxY = cab.position.y + cab.dimensions.height - PANEL_T - ROD_D;
    const clampedY = Math.min(Math.max(minY, elem.position.y), Math.max(minY, maxY));
    return {
      ...elem,
      cabinetId: cab.id,
      dimensions: { ...elem.dimensions, width: innerWidth, height: ROD_D, depth: ROD_D },
      position: { x: cab.position.x, y: clampedY, z: cab.position.z },
    };
  }
  if (elem.type === 'divider') {
    const halfInner = (cab.dimensions.width - 2 * PANEL_T) / 2 - PANEL_T / 2;
    const clampedX = Math.max(cab.position.x - halfInner, Math.min(cab.position.x + halfInner, elem.position.x));
    const attached = { ...elem, cabinetId: cab.id, position: { ...elem.position, x: clampedX, z: cab.position.z } };
    const allWithAttached = allElements.map((e) => e.id === elem.id ? attached : e);
    const bounds = computeDividerBounds(cab.id, attached.position.y + attached.dimensions.height / 2, allWithAttached);
    return {
      ...attached,
      dimensions: { ...attached.dimensions, height: bounds.height, depth: cab.dimensions.depth },
      position: { ...attached.position, y: bounds.y },
    };
  }
  return elem;
}

/** During resize: snap the moving edge of a shelf to a cabinet inner wall. */
export function snapShelfEdgeToCabinet(
  el: BoxElement,
  axis: 'width' | 'depth',
  dir: number,
  allElements: BoxElement[]
): { dim: number; pos: number } | null {
  const posAxis = axis === 'width' ? 'x' : 'z';
  const perpAxis = axis === 'width' ? 'z' : 'x';
  const perpDim = axis === 'width' ? 'depth' : 'width';
  const dim = el.dimensions[axis];
  const pos = el.position[posAxis];
  const movingEdge = pos + (dim / 2) * dir;
  const fixedEdge = pos - (dim / 2) * dir;

  let bestSnap: number | null = null;
  let bestDist = SNAP_DIST;

  for (const other of allElements) {
    if (other.id === el.id || other.type !== 'cabinet') continue;
    const yOverlap =
      el.position.y < other.position.y + other.dimensions.height &&
      el.position.y + el.dimensions.height > other.position.y;
    if (!yOverlap) continue;
    const shelfPerpCenter = el.position[perpAxis as 'x' | 'z'];
    const cabPerpCenter = other.position[perpAxis as 'x' | 'z'];
    const shelfPerpHalf = el.dimensions[perpDim as 'width' | 'depth'] / 2;
    const cabPerpHalf = other.dimensions[perpDim as 'width' | 'depth'] / 2;
    if (Math.abs(shelfPerpCenter - cabPerpCenter) > cabPerpHalf + shelfPerpHalf) continue;

    const otherPos = other.position[posAxis as 'x' | 'z'];
    const otherHalf = other.dimensions[axis] / 2;
    const walls = [
      otherPos + otherHalf - PANEL_T,
      otherPos - otherHalf + PANEL_T,
    ];
    for (const wall of walls) {
      const dist = Math.abs(movingEdge - wall);
      if (dist < bestDist) { bestDist = dist; bestSnap = wall; }
    }
  }

  if (bestSnap === null) return null;
  const newDim = Math.max(0.1, Math.abs(bestSnap - fixedEdge));
  const newPos = (bestSnap + fixedEdge) / 2;
  return { dim: newDim, pos: newPos };
}

/** Snaps box XZ position so its walls touch neighbors when close enough. */
export function snapToNeighbors(box: BoxElement, allElements: BoxElement[]): { x: number; z: number } {
  let { x, z } = box.position;
  const hw = ehw(box);
  const hd = ehd(box);

  for (const other of allElements) {
    if (other.id === box.id) continue;
    if (other.cabinetId) continue;
    const ohw = ehw(other);
    const ohd = ehd(other);

    const yOverlap =
      box.position.y < other.position.y + other.dimensions.height &&
      box.position.y + box.dimensions.height > other.position.y;
    if (!yOverlap) continue;

    const zGap = Math.abs(z - other.position.z) - (hd + ohd);

    // --- X axis ---
    if (zGap < SNAP_DIST) {
      const gapR = (other.position.x - ohw) - (x + hw);
      if (gapR >= -0.001 && gapR < SNAP_DIST) { x += gapR; continue; }
      const gapL = (x - hw) - (other.position.x + ohw);
      if (gapL >= -0.001 && gapL < SNAP_DIST) { x -= gapL; continue; }
      const deltaLL = (other.position.x - ohw) - (x - hw);
      if (Math.abs(deltaLL) < SNAP_DIST) { x += deltaLL; continue; }
      const deltaRR = (other.position.x + ohw) - (x + hw);
      if (Math.abs(deltaRR) < SNAP_DIST) { x += deltaRR; continue; }
      const deltaCX = other.position.x - x;
      if (Math.abs(deltaCX) < SNAP_DIST) { x += deltaCX; continue; }
    }

    // --- Z axis ---
    const xGapUpdated = Math.abs(x - other.position.x) - (hw + ohw);
    if (xGapUpdated < SNAP_DIST) {
      const gapF = (other.position.z - ohd) - (z + hd);
      if (gapF >= -0.001 && gapF < SNAP_DIST) { z += gapF; continue; }
      const gapB = (z - hd) - (other.position.z + ohd);
      if (gapB >= -0.001 && gapB < SNAP_DIST) { z -= gapB; continue; }
      const deltaFF = (other.position.z + ohd) - (z + hd);
      if (Math.abs(deltaFF) < SNAP_DIST) { z += deltaFF; continue; }
      const deltaBB = (other.position.z - ohd) - (z - hd);
      if (Math.abs(deltaBB) < SNAP_DIST) { z += deltaBB; continue; }
      const deltaCZ = other.position.z - z;
      if (Math.abs(deltaCZ) < SNAP_DIST) { z += deltaCZ; continue; }
    }
  }

  return { x, z };
}

const MOVE_BLOCKER_TYPES = new Set<BoxElement['type']>(['cabinet', 'shelf', 'board', 'boxkuchenny']);
const SOLID_CHILD_TYPES = new Set<BoxElement['type']>(['maskowanica', 'blenda', 'plinth']);

/** Returns the effective AABB of el including its solid children (maskowanica, blenda, plinth). */
function getBlockerAABB(
  el: BoxElement,
  allElements: BoxElement[]
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
  let minX = el.position.x - ehw(el);
  let maxX = el.position.x + ehw(el);
  let minY = el.position.y;
  let maxY = el.position.y + el.dimensions.height;
  let minZ = el.position.z - ehd(el);
  let maxZ = el.position.z + ehd(el);
  for (const child of allElements) {
    if (child.cabinetId !== el.id) continue;
    if (!SOLID_CHILD_TYPES.has(child.type)) continue;
    minX = Math.min(minX, child.position.x - child.dimensions.width / 2);
    maxX = Math.max(maxX, child.position.x + child.dimensions.width / 2);
    minY = Math.min(minY, child.position.y);
    maxY = Math.max(maxY, child.position.y + child.dimensions.height);
    minZ = Math.min(minZ, child.position.z - child.dimensions.depth / 2);
    maxZ = Math.max(maxZ, child.position.z + child.dimensions.depth / 2);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Clamps newY so that el doesn't vertically overlap free-standing elements.
 * Uses XZ overlap (including blocker's effective AABB with maskowanica/blenda/plinth children).
 * dy indicates movement direction (<=0 = down, >0 = up).
 */
export function clampYToCollisions(
  el: BoxElement,
  newY: number,
  dy: number,
  allElements: BoxElement[]
): number {
  const elHW = ehw(el);
  const elHD = ehd(el);

  for (const other of allElements) {
    if (other.id === el.id) continue;
    if (other.cabinetId) continue;
    if (!MOVE_BLOCKER_TYPES.has(other.type)) continue;

    const aabb = getBlockerAABB(other, allElements);

    const xOverlap = el.position.x + elHW > aabb.minX && el.position.x - elHW < aabb.maxX;
    const zOverlap = el.position.z + elHD > aabb.minZ && el.position.z - elHD < aabb.maxZ;
    if (!xOverlap || !zOverlap) continue;

    if (dy <= 0) {
      // Moving down: stop at top of blocker
      if (aabb.maxY <= el.position.y + 0.001)
        newY = Math.max(newY, aabb.maxY);
    } else {
      // Moving up: stop at bottom of blocker
      const currentTop = el.position.y + el.dimensions.height;
      if (aabb.minY >= currentTop - 0.001)
        newY = Math.min(newY, aabb.minY - el.dimensions.height);
    }
  }

  return newY;
}

/** Pushes box out of XZ overlaps with all free-standing solid elements (cabinets, shelves, boards, boxkuchenny), accounting for maskowanica/blenda/plinth children of blockers. */
export function pushOutCollisions(box: BoxElement, allElements: BoxElement[]): { x: number; z: number } {
  let x = box.position.x;
  let z = box.position.z;
  const hw = ehw(box);
  const hd = ehd(box);
  const boxMinY = box.position.y;
  const boxMaxY = box.position.y + box.dimensions.height;

  for (const other of allElements) {
    if (other.id === box.id) continue;
    if (other.cabinetId) continue;
    if (!MOVE_BLOCKER_TYPES.has(other.type)) continue;

    const aabb = getBlockerAABB(other, allElements);
    const yOverlap = boxMinY < aabb.maxY && boxMaxY > aabb.minY;
    if (!yOverlap) continue;

    const otherHW = (aabb.maxX - aabb.minX) / 2;
    const otherHD = (aabb.maxZ - aabb.minZ) / 2;
    const otherCX = (aabb.maxX + aabb.minX) / 2;
    const otherCZ = (aabb.maxZ + aabb.minZ) / 2;

    const overlapX = (hw + otherHW) - Math.abs(x - otherCX);
    const overlapZ = (hd + otherHD) - Math.abs(z - otherCZ);
    if (overlapX <= 0 || overlapZ <= 0) continue;

    if (overlapX > STACK_OVERLAP && overlapZ > STACK_OVERLAP) continue;

    if (overlapX <= overlapZ) {
      x += overlapX * (x >= otherCX ? 1 : -1);
    } else {
      z += overlapZ * (z >= otherCZ ? 1 : -1);
    }
  }
  return { x, z };
}

import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { BoxElement, BoxDimensions } from './types';
import { useThreeScene } from './useThreeScene';
import ElementLibrary from './ElementLibrary';
import PropertiesPanel from './PropertiesPanel';
import ModelOverlay from './ModelOverlay';
import './App.css';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
let colorIndex = 0;
let boxCounter = 1;
let shelfCounter = 1;
let dividerCounter = 1;
let frontCounter = 1;
let rodCounter = 1;
let legCounter = 1;
let hdfCounter = 1;
let drawerCounter = 1;
let drawerboxCounter = 1;
let blendaCounter = 1;
let plinthCounter = 1;
let groupCounter = 1;

// Snap / attach constants (must be declared before helpers that use them)
const PANEL_T = 0.018; // panel thickness in metres (~18 mm); must match useThreeScene.ts
const SNAP_DIST = 0.05; // side-by-side wall snap tolerance (5 cm)
const FRONT_INSET = 0.002; // 2 mm gap on each side between front panel and cabinet edge
const HDF_T = 0.003; // HDF back panel thickness 3 mm
const HDF_INSET = 0.002; // 2 mm inset on each side of the HDF panel

// Computes position/dimensions of an HDF back panel bound to its cabinet.
function computeHdfForCabinet(hdf: BoxElement, cab: BoxElement): BoxElement {
  return {
    ...hdf,
    dimensions: {
      width: Math.max(0.001, cab.dimensions.width - 2 * HDF_INSET),
      height: Math.max(0.001, cab.dimensions.height - 2 * HDF_INSET),
      depth: HDF_T,
    },
    position: {
      x: cab.position.x,
      y: cab.position.y + HDF_INSET,
      z: cab.position.z - cab.dimensions.depth / 2 - HDF_T / 2,
    },
  };
}

// Computes position/dimensions of the single legs element (all 4 legs combined) for a cabinet.
// The element stores cabinet-wide dimensions so rebuildLeg can place all 4 cylinders.
function computeLegsForCabinet(legs: BoxElement, cab: BoxElement): BoxElement {
  return {
    ...legs,
    dimensions: {
      width: cab.dimensions.width,
      height: legs.dimensions.height,
      depth: cab.dimensions.depth,
    },
    position: {
      x: cab.position.x,
      z: cab.position.z,
      y: cab.position.y - legs.dimensions.height,
    },
  };
}

// Computes position/dimensions of the plinth (cokoł) at the front of the cabinet, at floor level.
function computePlinthForCabinet(plinth: BoxElement, cab: BoxElement, allElements: BoxElement[]): BoxElement {
  const legs = allElements.filter((e) => e.type === 'leg' && e.cabinetId === cab.id);
  const legHeight = legs.length > 0 ? legs[0].dimensions.height : plinth.dimensions.height || 0.1;
  return {
    ...plinth,
    dimensions: {
      width: cab.dimensions.width,
      height: legHeight,
      depth: PANEL_T,
    },
    position: {
      x: cab.position.x,
      y: cab.position.y - legHeight,
      z: cab.position.z + cab.dimensions.depth / 2 + PANEL_T / 2,
    },
  };
}

// Computes the position/dimensions of a front panel bound to its cabinet.
// For double fronts: each leaf gets 2mm inset on all four of its own edges.
function computeFrontForCabinet(front: BoxElement, cab: BoxElement): BoxElement {
  const z = cab.position.z + cab.dimensions.depth / 2 + PANEL_T / 2;
  const fullH = Math.max(0.001, cab.dimensions.height - 2 * FRONT_INSET);
  const yPos = cab.position.y + FRONT_INSET;
  if (front.frontSide === 'left' || front.frontSide === 'right') {
    // Each leaf: half cabinet width minus 2mm on each of its own sides (outer edge + centre gap)
    const leafW = Math.max(0.001, cab.dimensions.width / 2 - 2 * FRONT_INSET);
    // Leaf centres sit at ±W/4 from cabinet centre (the 2mm insets cancel out symmetrically)
    const leftX  = cab.position.x - cab.dimensions.width / 4;
    const rightX = cab.position.x + cab.dimensions.width / 4;
    return {
      ...front,
      dimensions: { width: leafW, height: fullH, depth: PANEL_T },
      position: {
        x: front.frontSide === 'left' ? leftX : rightX,
        y: yPos,
        z,
      },
    };
  }
  // Single front
  return {
    ...front,
    dimensions: {
      width: Math.max(0.001, cab.dimensions.width - 2 * FRONT_INSET),
      height: fullH,
      depth: PANEL_T,
    },
    position: { x: cab.position.x, y: yPos, z },
  };
}

// Computes the position/dimensions of a front panel that spans all cabinets in a group.
function computeFrontForGroup(front: BoxElement, allElements: BoxElement[]): BoxElement {
  const group = allElements.find((e) => e.id === front.cabinetId);
  if (!group) return front;
  const members = allElements.filter((e) => e.groupId === group.id && e.type === 'cabinet');
  if (members.length === 0) return front;
  const minX = Math.min(...members.map((c) => c.position.x - c.dimensions.width / 2));
  const maxX = Math.max(...members.map((c) => c.position.x + c.dimensions.width / 2));
  const minY = Math.min(...members.map((c) => c.position.y));
  const maxY = Math.max(...members.map((c) => c.position.y + c.dimensions.height));
  const maxFaceZ = Math.max(...members.map((c) => c.position.z + c.dimensions.depth / 2));
  return {
    ...front,
    dimensions: {
      width: Math.max(0.001, (maxX - minX) - 2 * FRONT_INSET),
      height: Math.max(0.001, (maxY - minY) - 2 * FRONT_INSET),
      depth: PANEL_T,
    },
    position: {
      x: (minX + maxX) / 2,
      y: minY + FRONT_INSET,
      z: maxFaceZ + PANEL_T / 2,
    },
  };
}

// Recompute the bounds of a group element from its member cabinets.
function computeGroupBounds(group: BoxElement, allElements: BoxElement[]): BoxElement {
  const members = allElements.filter((e) => e.groupId === group.id && e.type === 'cabinet');
  if (members.length === 0) return group;
  const minX = Math.min(...members.map((c) => c.position.x - c.dimensions.width / 2));
  const maxX = Math.max(...members.map((c) => c.position.x + c.dimensions.width / 2));
  const minY = Math.min(...members.map((c) => c.position.y));
  const maxY = Math.max(...members.map((c) => c.position.y + c.dimensions.height));
  const maxFaceZ = Math.max(...members.map((c) => c.position.z + c.dimensions.depth / 2));
  const avgDepth = members.reduce((s, c) => s + c.dimensions.depth, 0) / members.length;
  return {
    ...group,
    dimensions: { width: maxX - minX, height: maxY - minY, depth: avgDepth },
    position: { x: (minX + maxX) / 2, y: minY, z: maxFaceZ - avgDepth / 2 },
  };
}

// After any mutation, resync all groups and their fronts.
function recomputeGroups(elements: BoxElement[]): BoxElement[] {
  const result = elements.map((e) => {
    if (e.type === 'group') return computeGroupBounds(e, elements);
    return e;
  });
  // Now recompute group fronts using updated group bounds
  const result2 = result.map((e) => {
    if (e.type === 'front' && e.cabinetId) {
      const linked = result.find((g) => g.id === e.cabinetId);
      if (linked?.type === 'group') return computeFrontForGroup(e, result);
    }
    return e;
  });
  return result2;
}

// Returns true if boxes a and b have any XZ footprint overlap (used by fit/snap helpers)
function getBoxOverlap(a: BoxElement, b: BoxElement): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < (a.dimensions.width + b.dimensions.width) / 2 &&
    Math.abs(a.position.z - b.position.z) < (a.dimensions.depth + b.dimensions.depth) / 2
  );
}

// Minimum overlap in each axis to trigger stacking (10 cm)
const STACK_OVERLAP = 0.10;

// Returns true when boxes overlap by more than STACK_OVERLAP in BOTH X and Z
function getBoxStackOverlap(a: BoxElement, b: BoxElement): boolean {
  const ox = (a.dimensions.width + b.dimensions.width) / 2 - Math.abs(a.position.x - b.position.x);
  const oz = (a.dimensions.depth + b.dimensions.depth) / 2 - Math.abs(a.position.z - b.position.z);
  return ox > STACK_OVERLAP && oz > STACK_OVERLAP;
}

// Returns the Y level (bottom) where box should sit, based on overlapping boxes
function computeYForBox(box: BoxElement, allElements: BoxElement[], roomH = Infinity): number {
  let maxTop = 0;
  for (const other of allElements) {
    if (other.id === box.id) continue;
    if (other.type === 'shelf' || other.type === 'drawer' || other.type === 'drawerbox' || other.type === 'blenda' || other.type === 'divider' || other.type === 'front' || other.type === 'rod' || other.type === 'leg' || other.type === 'hdf' || other.type === 'plinth') continue;
    if (getBoxStackOverlap(box, other)) {
      maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
    }
  }
  // If the cabinet has legs, its bottom must sit at least legHeight above the surface below
  const legs = allElements.filter((e) => e.type === 'leg' && e.cabinetId === box.id);
  if (legs.length > 0) {
    maxTop = Math.max(maxTop, maxTop + legs[0].dimensions.height);
  }
  // Clamp so the top of the box doesn't exceed the room height
  return Math.min(maxTop, Math.max(0, roomH - box.dimensions.height));
}

// Recomputes Y for all boxes bottom-up (used after dimension changes)
function recomputeAllY(elements: BoxElement[], roomH = Infinity): BoxElement[] {
  const originalY = new Map(elements.map((el) => [el.id, el.position.y]));
  // Process from lowest to highest so lower boxes are settled first
  const ordered = [...elements].sort(
    (a, b) => (originalY.get(a.id) ?? 0) - (originalY.get(b.id) ?? 0)
  );
  const resultMap = new Map(
    elements.map((el) => [el.id, { ...el, position: { ...el.position } }])
  );
  for (const el of ordered) {
    const box = resultMap.get(el.id)!;
    if (box.type === 'shelf' || box.type === 'drawer' || box.type === 'drawerbox' || box.type === 'blenda' || box.type === 'divider' || box.type === 'front' || box.type === 'rod' || box.type === 'leg' || box.type === 'hdf') continue; // preserve their Y
    const elOriginalY = originalY.get(el.id) ?? 0;
    let maxTop = 0;
    for (const [id, other] of resultMap) {
      if (id === box.id) continue;
      if (other.type === 'shelf' || other.type === 'drawer' || other.type === 'drawerbox' || other.type === 'blenda' || other.type === 'divider' || other.type === 'front' || other.type === 'rod' || other.type === 'leg' || other.type === 'hdf' || other.type === 'plinth') continue;
      // Only stack on boxes that were originally below (or at same level as) this box
      if ((originalY.get(id) ?? 0) <= elOriginalY + 0.001) {
        if (getBoxStackOverlap(box, other)) {
          maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
        }
      }
    }
    // If the cabinet has legs, it must be lifted by their height above whatever surface it sits on
    const legChildren = [...resultMap.values()].filter((e) => e.type === 'leg' && e.cabinetId === box.id);
    if (legChildren.length > 0) {
      maxTop = maxTop + legChildren[0].dimensions.height;
    }
    const withY = { ...box, position: { ...box.position, y: Math.min(maxTop, Math.max(0, roomH - box.dimensions.height)) } };
    // If stacked on another cabinet, match its width/depth
    const fitted = maxTop > 0 ? fitCabinetToBelow(withY, [...resultMap.values()]) : withY;
    resultMap.set(el.id, fitted);
  }
  // Recompute divider bounds based on final shelf positions
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
  // Recompute front panel positions/dims based on updated cabinet positions
  const allSettled2 = [...resultMap.values()];
  for (const el of allSettled2) {
    if (el.type !== 'front' || !el.cabinetId) continue;
    const cab = allSettled2.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeFrontForCabinet(el, cab));
  }
  // Recompute leg positions based on updated cabinet positions
  const allSettled3 = [...resultMap.values()];
  for (const el of allSettled3) {
    if (el.type !== 'leg' || !el.cabinetId) continue;
    const cab = allSettled3.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeLegsForCabinet(el, cab));
  }
  // Recompute HDF back panel positions/dims based on updated cabinet positions
  const allSettled4 = [...resultMap.values()];
  for (const el of allSettled4) {
    if (el.type !== 'hdf' || !el.cabinetId) continue;
    const cab = allSettled4.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computeHdfForCabinet(el, cab));
  }
  // Recompute plinth positions based on updated cabinet and leg positions
  const allSettled5 = [...resultMap.values()];
  for (const el of allSettled5) {
    if (el.type !== 'plinth' || !el.cabinetId) continue;
    const cab = allSettled5.find((e) => e.id === el.cabinetId);
    if (cab) resultMap.set(el.id, computePlinthForCabinet(el, cab, allSettled5));
  }
  const settled = elements.map((el) => resultMap.get(el.id)!);
  return recomputeGroups(settled);
}

// Auto-fit shelf depth (Z) to the inner depth of the cabinet it's inside
function fitShelfDepthToCabinet(shelf: BoxElement, allElements: BoxElement[]): BoxElement {
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
    // Width = inner width (between side panels), depth = full cabinet depth (no back panel)
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

// When a cabinet is placed on top of another cabinet, match its width/depth to the lower one
function fitCabinetToBelow(cabinet: BoxElement, allElements: BoxElement[]): BoxElement {
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

// Maximum distance (m) from a cabinet boundary within which a free shelf/divider auto-attaches
const ATTACH_DIST = SNAP_DIST;
// Straight-line drag displacement (m) required to detach a bound element from its cabinet
const DETACH_DIST = 0.08; // 80 mm
// How far outside the cabinet the element must travel before same-cabinet re-snap is allowed again
const HYSTERESIS_DIST = 0.15; // 150 mm

// Like findNearCabinet but skips `avoidCabId` until the element has moved past the hysteresis zone.
function findNearCabinetHysteresis(
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
    if (other.id === avoidCabId) continue; // still in hysteresis cooldown for this cabinet
    return other;
  }
  return null;
}

// Attaches a free shelf/divider to the given cabinet and fits its dimensions/position.
function attachAndFit(elem: BoxElement, cab: BoxElement, allElements: BoxElement[]): BoxElement {
  if (elem.type === 'shelf') {
    const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
    const depth = cab.dimensions.depth;
    const maxY = cab.position.y + cab.dimensions.height - elem.dimensions.height;
    const clampedY = Math.min(Math.max(cab.position.y, elem.position.y), maxY);
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

// Returns the Y bottom and height for a divider based on shelves above/below in the same cabinet
function computeDividerBounds(
  cabinetId: string,
  dividerY: number, // current vertical center hint (used to find nearest shelf)
  allElements: BoxElement[]
): { y: number; height: number } {
  const cab = allElements.find((e) => e.id === cabinetId);
  if (!cab) return { y: 0, height: PANEL_T };

  const cabBottom = cab.position.y + PANEL_T;          // inner face of bottom panel
  const cabTop = cab.position.y + cab.dimensions.height - PANEL_T; // inner face of top panel

  // Collect horizontal surfaces (shelves in the same cabinet): their top face Y
  const surfaces: number[] = [cabBottom, cabTop];
  for (const el of allElements) {
    if (el.cabinetId !== cabinetId || el.type !== 'shelf') continue;
    surfaces.push(el.position.y); // bottom of shelf
    surfaces.push(el.position.y + el.dimensions.height); // top of shelf
  }
  surfaces.sort((a, b) => a - b);

  // Find the gap that contains dividerY
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

// During resize: if the moving edge of a shelf is close to a cabinet inner wall,
// snap the edge exactly to that wall (fixed edge stays, dimension adjusts)
function snapShelfEdgeToCabinet(
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
    // Y overlap check (shelf is inside cabinet vertically)
    const yOverlap =
      el.position.y < other.position.y + other.dimensions.height &&
      el.position.y + el.dimensions.height > other.position.y;
    if (!yOverlap) continue;
    // Perp axis: shelf should be inside or touching cabinet
    const shelfPerpCenter = el.position[perpAxis as 'x' | 'z'];
    const cabPerpCenter = other.position[perpAxis as 'x' | 'z'];
    const shelfPerpHalf = el.dimensions[perpDim as 'width' | 'depth'] / 2;
    const cabPerpHalf = other.dimensions[perpDim as 'width' | 'depth'] / 2;
    if (Math.abs(shelfPerpCenter - cabPerpCenter) > cabPerpHalf + shelfPerpHalf) continue;

    const otherPos = other.position[posAxis as 'x' | 'z'];
    const otherHalf = other.dimensions[axis] / 2;
    // Two inner walls of the cabinet along this axis
    const walls = [
      otherPos + otherHalf - PANEL_T, // inner right/front
      otherPos - otherHalf + PANEL_T, // inner left/back
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

// Snaps box XZ position so its walls touch neighbors when close enough,
// and also aligns faces (front-to-front, back-to-back, left-to-left, right-to-right)
function snapToNeighbors(box: BoxElement, allElements: BoxElement[]): { x: number; z: number } {
  let { x, z } = box.position;
  const hw = box.dimensions.width / 2;
  const hd = box.dimensions.depth / 2;

  for (const other of allElements) {
    if (other.id === box.id) continue;
    // Skip elements bound to a cabinet — they're interior components, not snappable neighbors
    if (other.cabinetId) continue;
    const ohw = other.dimensions.width / 2;
    const ohd = other.dimensions.depth / 2;

    // Only snap to boxes that share some Y range
    const yOverlap =
      box.position.y < other.position.y + other.dimensions.height &&
      box.position.y + box.dimensions.height > other.position.y;
    if (!yOverlap) continue;

    const zGap = Math.abs(z - other.position.z) - (hd + ohd);

    // --- X axis ---
    if (zGap < SNAP_DIST) {
      // Wall-to-wall
      const gapR = (other.position.x - ohw) - (x + hw);
      if (gapR >= -0.001 && gapR < SNAP_DIST) { x += gapR; continue; }
      const gapL = (x - hw) - (other.position.x + ohw);
      if (gapL >= -0.001 && gapL < SNAP_DIST) { x -= gapL; continue; }
      // Face alignment (left-to-left, right-to-right, center-to-center)
      const deltaLL = (other.position.x - ohw) - (x - hw);
      if (Math.abs(deltaLL) < SNAP_DIST) { x += deltaLL; continue; }
      const deltaRR = (other.position.x + ohw) - (x + hw);
      if (Math.abs(deltaRR) < SNAP_DIST) { x += deltaRR; continue; }
      const deltaCX = other.position.x - x;
      if (Math.abs(deltaCX) < SNAP_DIST) { x += deltaCX; continue; }
    }

    // --- Z axis (use updated x for proximity check) ---
    const xGapUpdated = Math.abs(x - other.position.x) - (hw + ohw);
    if (xGapUpdated < SNAP_DIST) {
      // Wall-to-wall
      const gapF = (other.position.z - ohd) - (z + hd);
      if (gapF >= -0.001 && gapF < SNAP_DIST) { z += gapF; continue; }
      const gapB = (z - hd) - (other.position.z + ohd);
      if (gapB >= -0.001 && gapB < SNAP_DIST) { z -= gapB; continue; }
      // Face alignment (front-to-front, back-to-back, center-to-center)
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

// Pushes box out of XZ overlaps with same-level cabinets.
// Skips pairs that already exceed STACK_OVERLAP threshold (stacking handles those).
function pushOutCollisions(box: BoxElement, allElements: BoxElement[]): { x: number; z: number } {
  let x = box.position.x;
  let z = box.position.z;
  const hw = box.dimensions.width / 2;
  const hd = box.dimensions.depth / 2;

  for (const other of allElements) {
    if (other.id === box.id) continue;
    if (other.type !== 'cabinet') continue;
    const ohw = other.dimensions.width / 2;
    const ohd = other.dimensions.depth / 2;

    const yOverlap =
      box.position.y < other.position.y + other.dimensions.height &&
      box.position.y + box.dimensions.height > other.position.y;
    if (!yOverlap) continue;

    const overlapX = (hw + ohw) - Math.abs(x - other.position.x);
    const overlapZ = (hd + ohd) - Math.abs(z - other.position.z);
    if (overlapX <= 0 || overlapZ <= 0) continue;

    // Deep overlap in both axes → let stacking handle it
    if (overlapX > STACK_OVERLAP && overlapZ > STACK_OVERLAP) continue;

    // Push along the axis with smallest penetration
    if (overlapX <= overlapZ) {
      x += overlapX * (x >= other.position.x ? 1 : -1);
    } else {
      z += overlapZ * (z >= other.position.z ? 1 : -1);
    }
  }
  return { x, z };
}

function createBox(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return {
    id: crypto.randomUUID(),
    name: `Box ${boxCounter++}`,
    type: 'cabinet',
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 0, z: 0 },
    color,
  };
}

function createShelf(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  return {
    id: crypto.randomUUID(),
    name: `Półka ${shelfCounter++}`,
    type: 'shelf',
    dimensions: { width: 0.8, height: 0.018, depth: 0.38 },
    position: { x: 0, y: 0.3, z: 0 },
    color,
  };
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<BoxElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  // Board dimensions in cm (converted to metres when passed to scene)
  const [boardSize, setBoardSize] = useState<{ width: number; depth: number; height: number }>({ width: 6000, depth: 6000, height: 2600 });
  const boardSizeRef = useRef(boardSize);
  useEffect(() => { boardSizeRef.current = boardSize; }, [boardSize]);
  // Tracks accumulated drag Y for dividers so tiny increments build up across frames
  const dividerYHintRef = useRef<Map<string, number>>(new Map());
  // Cumulative XZ pointer delta from drag start (per element) — used for detach displacement check
  const dragDeltaRef = useRef<Map<string, { dx: number; dz: number }>>(new Map());
  // Cabinet id that an element just detached from, prevents immediate re-snap to same cabinet
  const detachedFromRef = useRef<Map<string, string>>(new Map());

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    setMultiSelectedIds([]);
  }, []);

  const handleDimensionDrag = useCallback(
    (id: string, axis: 'width' | 'height' | 'depth', delta: number, dir: number) => {
      // Map dimension axis → position axis
      const posAxis: Record<'width' | 'height' | 'depth', 'x' | 'y' | 'z'> = {
        width: 'x',
        height: 'y',
        depth: 'z',
      };
      setElements((prev) => {
        const updated = prev.map((el) => {
          if (el.id !== id) return el;
          const oldVal = el.dimensions[axis];
          const pa = posAxis[axis];

          // Compute max allowed size from board boundaries BEFORE applying delta,
          // so the resulting position is also correct (no out-of-board centre shift).
          let maxAllowed = Infinity;
          if (!el.cabinetId) {
            const { width: bwMm, depth: bdMm, height: bhMm } = boardSizeRef.current;
            const bw = bwMm / 1000; const bd = bdMm / 1000; const roomH = bhMm / 1000;
            if (axis === 'width') {
              // Fixed edge is the side OPPOSITE to the dragged handle
              const fixedEdge = el.position.x - dir * oldVal / 2;
              maxAllowed = dir > 0 ? (bw / 2 - fixedEdge) : (fixedEdge + bw / 2);
            } else if (axis === 'depth') {
              const fixedEdge = el.position.z - dir * oldVal / 2;
              maxAllowed = dir > 0 ? (bd / 2 - fixedEdge) : (fixedEdge + bd / 2);
            } else if (axis === 'height') {
              // position.y is the bottom of the element
              maxAllowed = dir > 0
                ? roomH - el.position.y        // top handle: can't go above ceiling
                : el.position.y + oldVal;      // bottom handle: can't go below floor
            }
          }

          const newVal = Math.max(0.1, Math.min(maxAllowed, oldVal + delta));
          const actualDelta = newVal - oldVal;
          const newPosVal = el.position[pa] + actualDelta / 2 * dir;
          const withDelta = {
            ...el,
            dimensions: { ...el.dimensions, [axis]: newVal },
            position: { ...el.position, [pa]: newPosVal },
          };
          // Snap shelf edges to cabinet inner walls
          if (el.type === 'shelf' && (axis === 'width' || axis === 'depth')) {
            const snap = snapShelfEdgeToCabinet(withDelta, axis, dir, prev);
            if (snap) {
              return {
                ...withDelta,
                dimensions: { ...withDelta.dimensions, [axis]: snap.dim },
                position: { ...withDelta.position, [pa]: snap.pos },
              };
            }
          }
          return withDelta;
        });
        return recomputeAllY(updated, boardSizeRef.current.height / 1000);
      });
    },
    []
  );

  const handleDimensionInput = useCallback(
    (id: string, dims: BoxDimensions) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id);
        let clampedDims = dims;
        if (el && !el.cabinetId) {
          const { width: bwMm, depth: bdMm, height: bhMm } = boardSizeRef.current;
          const bw = bwMm / 1000; const bd = bdMm / 1000; const roomH = bhMm / 1000;
          const maxW = bw - Math.abs(el.position.x) * 2;
          const maxD = bd - Math.abs(el.position.z) * 2;
          const maxH = roomH - el.position.y;
          clampedDims = {
            width:  Math.min(dims.width,  Math.max(0.1, maxW)),
            depth:  Math.min(dims.depth,  Math.max(0.1, maxD)),
            height: Math.min(dims.height, Math.max(0.1, maxH)),
          };
        }
        const updated = prev.map((e) => {
          if (e.id === id) return { ...e, dimensions: clampedDims };
          return e;
        });
        return recomputeAllY(updated, boardSizeRef.current.height / 1000);
      });
    },
    []
  );

  const handlePositionChange = useCallback(
    (id: string, dx: number, dz: number) => {
      // Board clamping: keep element centre + half its size inside the board (in metres)
      const clampToBoard = (el: BoxElement): { x: number; z: number } => {
        const bw = boardSizeRef.current.width / 1000;
        const bd = boardSizeRef.current.depth / 1000;
        // Half of the available movement range (0 when element >= board size → locked to centre)
        const rx = Math.max(0, (bw - el.dimensions.width) / 2);
        const rz = Math.max(0, (bd - el.dimensions.depth) / 2);
        return {
          x: Math.max(-rx, Math.min(rx, el.position.x)),
          z: Math.max(-rz, Math.min(rz, el.position.z)),
        };
      };
      setElements((prev) => {
        const movedEl = prev.find((e) => e.id === id)!;
        // 1. Apply movement delta
        const afterMove = prev.map((el) =>
          el.id === id
            ? { ...el, position: { ...el.position, x: el.position.x + dx, z: el.position.z + dz } }
            : el
        );
        const movedAfter = afterMove.find((e) => e.id === id)!;

        // Fronts, HDF and cabinet-bound rods/legs are always locked in XZ — block manual movement
        if (movedEl.type === 'front' || movedEl.type === 'hdf' || (movedEl.type === 'rod' && movedEl.cabinetId) || (movedEl.type === 'leg' && movedEl.cabinetId) || (movedEl.type === 'plinth' && movedEl.cabinetId)) return prev;

        if (movedEl.type === 'shelf' || movedEl.type === 'divider') {
          if (movedEl.cabinetId) {
            // Accumulate pointer delta for this drag session
            const d = dragDeltaRef.current.get(id) ?? { dx: 0, dz: 0 };
            const nd = { dx: d.dx + dx, dz: d.dz + dz };
            dragDeltaRef.current.set(id, nd);

            if (movedEl.type === 'divider') {
              // Divider: Z-displacement triggers detach; X-only movement is intentional repositioning
              const zDisp = Math.abs(nd.dz);
              if (zDisp < DETACH_DIST) {
                // Still bound — move only on X, clamped inside cabinet
                const cab = prev.find((e) => e.id === movedEl.cabinetId)!;
                const halfInner = (cab.dimensions.width - 2 * PANEL_T) / 2 - PANEL_T / 2;
                const newX = Math.max(cab.position.x - halfInner, Math.min(cab.position.x + halfInner, movedEl.position.x + dx));
                const moved = { ...movedEl, position: { ...movedEl.position, x: newX } };
                const intermediate = prev.map((e) => (e.id === id ? moved : e));
                const bounds = computeDividerBounds(movedEl.cabinetId, moved.position.y + moved.dimensions.height / 2, intermediate);
                return prev.map((e) => e.id === id ? { ...moved, position: { ...moved.position, y: bounds.y }, dimensions: { ...moved.dimensions, height: bounds.height } } : e);
              }
            } else {
              // Shelf: fully locked until straight-line displacement exceeds threshold
              const disp = Math.sqrt(nd.dx * nd.dx + nd.dz * nd.dz);
              if (disp < DETACH_DIST) return prev;
            }

            // Threshold exceeded — detach
            dividerYHintRef.current.delete(id);
            detachedFromRef.current.set(id, movedEl.cabinetId!);
            const detached = { ...movedAfter, cabinetId: undefined };
            const withDetached = afterMove.map((e) => e.id === id ? detached : e);
            // Re-attach to a *different* nearby cabinet immediately
            const nearCab = findNearCabinetHysteresis(detached, withDetached, movedEl.cabinetId!);
            if (nearCab) {
              detachedFromRef.current.delete(id);
              dragDeltaRef.current.set(id, { dx: 0, dz: 0 });
              return withDetached.map((e) => e.id === id ? attachAndFit(detached, nearCab, withDetached) : e);
            }
            return withDetached;
          }

          // Free element — check hysteresis: reset avoid once far enough away from last cabinet
          let avoidCabId = detachedFromRef.current.get(id) ?? null;
          if (avoidCabId) {
            const avoidCab = afterMove.find((e) => e.id === avoidCabId);
            if (!avoidCab ||
              Math.abs(movedAfter.position.x - avoidCab.position.x) > avoidCab.dimensions.width  / 2 + HYSTERESIS_DIST ||
              Math.abs(movedAfter.position.z - avoidCab.position.z) > avoidCab.dimensions.depth / 2 + HYSTERESIS_DIST) {
              detachedFromRef.current.delete(id);
              avoidCabId = null;
            }
          }

          // Check for nearby cabinet to re-attach (respecting hysteresis)
          const nearCab = findNearCabinetHysteresis(movedAfter, afterMove, avoidCabId);
          if (nearCab) {
            detachedFromRef.current.delete(id);
            dragDeltaRef.current.set(id, { dx: 0, dz: 0 });
            return afterMove.map((e) => e.id === id ? attachAndFit(movedAfter, nearCab, afterMove) : e);
          }
          if (movedEl.type === 'shelf') {
            // Free shelf: snap XZ, fit dims to any cabinet it overlaps
            const snapped = snapToNeighbors(movedAfter, afterMove);
            const shelfWithXZ = { ...movedAfter, position: { ...movedAfter.position, x: snapped.x, z: snapped.z } };
            const fittedShelf = fitShelfDepthToCabinet(shelfWithXZ, afterMove);
            const clampedPos = clampToBoard(fittedShelf);
            return afterMove.map((el) => el.id === id ? { ...fittedShelf, position: { ...fittedShelf.position, x: clampedPos.x, z: clampedPos.z } } : el);
          }
          // Free rod / divider: move freely
          return afterMove;
        }
        // 2. Compute preliminary Y so snap can check Y overlap correctly
        const prelim = afterMove.find((e) => e.id === id)!;
        const roomH = boardSizeRef.current.height / 1000;
        const prelimY = computeYForBox(prelim, afterMove, roomH);
        const prelimWithY = { ...prelim, position: { ...prelim.position, y: prelimY } };
        const withPrelimY = afterMove.map((el) => (el.id === id ? prelimWithY : el));
        // 3. Snap XZ to neighboring walls
        const snapped = snapToNeighbors(prelimWithY, withPrelimY);
        // 4. Apply snapped XZ and recompute Y
        const afterSnap = withPrelimY.map((el) =>
          el.id === id ? { ...el, position: { x: snapped.x, y: 0, z: snapped.z } } : el
        );
        const finalBox = afterSnap.find((e) => e.id === id)!;
        const finalY = computeYForBox(finalBox, afterSnap, roomH);
        const withFinalY = afterSnap.map((el) =>
          el.id === id ? { ...el, position: { ...el.position, y: finalY } } : el
        );
        // If placed on top of another cabinet, match its width/depth
        if (finalY > 0) {
          const movedFinal = withFinalY.find((e) => e.id === id)!;
          const fitted = fitCabinetToBelow(movedFinal, withFinalY);
          if (fitted !== movedFinal) {
            const withFitted = withFinalY.map((el) => (el.id === id ? fitted : el));
          // Move bound elements and recompute fronts/hdf/legs for this cabinet
          const adx = fitted.position.x - movedEl.position.x;
          const ady = fitted.position.y - movedEl.position.y;
          const adz = fitted.position.z - movedEl.position.z;
          return recomputeGroups(withFitted.map((el) => {
            if (el.id === id) return el;
            if (el.cabinetId !== id) return el;
            if (el.type === 'front') return computeFrontForCabinet(el, fitted);
            if (el.type === 'hdf') return computeHdfForCabinet(el, fitted);
              if (el.type === 'leg') return computeLegsForCabinet(el, fitted);
              return { ...el, position: { x: el.position.x + adx, y: el.position.y + ady, z: el.position.z + adz } };
            }));
          }
        }
        // Move bound elements and recompute fronts/hdf/legs for the moved cabinet
        // 5. Collision push-out (same-level only, stacking-level overlaps are excluded)
        const pushedPos = pushOutCollisions(withFinalY.find((e) => e.id === id)!, withFinalY);
        // 6. Clamp to board boundaries
        const clampedEl = { ...withFinalY.find((e) => e.id === id)!, position: { ...withFinalY.find((e) => e.id === id)!.position, x: pushedPos.x, z: pushedPos.z } };
        const clampedPos = clampToBoard(clampedEl);
        const withCollision = withFinalY.map((el) =>
          el.id === id ? { ...el, position: { ...el.position, x: clampedPos.x, z: clampedPos.z } } : el
        );
        const movedFinal2 = withCollision.find((e) => e.id === id)!;
        const adx = movedFinal2.position.x - movedEl.position.x;
        const ady = movedFinal2.position.y - movedEl.position.y;
        const adz = movedFinal2.position.z - movedEl.position.z;
        return recomputeGroups(withCollision.map((el) => {
          if (el.id === id) return el;
          if (el.cabinetId !== id) return el;
          if (el.type === 'front') return computeFrontForCabinet(el, movedFinal2);
          if (el.type === 'hdf') return computeHdfForCabinet(el, movedFinal2);
          if (el.type === 'leg') return computeLegsForCabinet(el, movedFinal2);
          if (el.type === 'plinth') return computePlinthForCabinet(el, movedFinal2, withCollision);
          return { ...el, position: { x: el.position.x + adx, y: el.position.y + ady, z: el.position.z + adz } };
        }));
      });
    },
    []
  );

  const handleYChange = useCallback(
    (id: string, y: number) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id)!;
        const roomH = boardSizeRef.current.height / 1000;
        let newY = Math.max(0, y);
        if (el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (cab) {
            const bottomOffset = cab.type === 'drawerbox' ? (cab.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
            const minY = cab.position.y + bottomOffset;
            const maxY = cab.position.y + cab.dimensions.height - PANEL_T - el.dimensions.height;
            newY = Math.min(Math.max(minY, newY), Math.max(minY, maxY));
          }
        } else {
          // Clamp top of element to room height
          newY = Math.min(newY, Math.max(0, roomH - el.dimensions.height));
        }
        const dy = newY - el.position.y;
        return prev.map((e) => {
          if (e.id === id) return { ...e, position: { ...e.position, y: newY } };
          if (el.type === 'drawerbox' && e.type === 'blenda' && e.cabinetId === el.cabinetId)
            return { ...e, position: { ...e.position, y: e.position.y + dy } };
          if (el.type === 'drawerbox' && e.type === 'drawer' && e.cabinetId === id)
            return { ...e, position: { ...e.position, y: e.position.y + dy } };
          return e;
        });
      });
    },
    []
  );

  const handleYMove = useCallback(
    (id: string, dy: number) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id)!;

        if (el.type === 'divider' && el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (!cab) return prev;
          // Accumulate drag delta into hint (independent of snapped position)
          const currentHint = dividerYHintRef.current.get(id) ?? (el.position.y + el.dimensions.height / 2);
          const newHint = Math.max(cab.position.y + PANEL_T, Math.min(cab.position.y + cab.dimensions.height - PANEL_T, currentHint + dy));
          dividerYHintRef.current.set(id, newHint);
          const bounds = computeDividerBounds(el.cabinetId, newHint, prev);
          return prev.map((e) => e.id === id ? {
            ...e,
            position: { ...e.position, y: bounds.y },
            dimensions: { ...e.dimensions, height: bounds.height },
          } : e);
        }

        let newY = Math.max(0, el.position.y + dy);
        if (el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (cab) {
            const bottomOffset = cab.type === 'drawerbox' ? (cab.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
            const minY = cab.position.y + bottomOffset;
            const maxY = cab.position.y + cab.dimensions.height - PANEL_T - el.dimensions.height;
            newY = Math.min(Math.max(minY, newY), Math.max(minY, maxY));
          }
        } else {
          // Clamp top of element to room height
          const roomH = boardSizeRef.current.height / 1000;
          newY = Math.min(newY, Math.max(0, roomH - el.dimensions.height));
        }
        if (el.type === 'cabinet') {
          const actualDy = newY - el.position.y;
          const movedCab = { ...el, position: { ...el.position, y: newY } };
          return recomputeGroups(prev.map((e) => {
            if (e.id === id) return movedCab;
            if (e.cabinetId !== id) return e;
            if (e.type === 'front') return computeFrontForCabinet(e, movedCab);
            if (e.type === 'hdf') return computeHdfForCabinet(e, movedCab);
            if (e.type === 'leg') return computeLegsForCabinet(e, movedCab);
            if (e.type === 'plinth') return computePlinthForCabinet(e, movedCab, prev);
            return { ...e, position: { ...e.position, y: e.position.y + actualDy } };
          }));
        }
        const moveDy = newY - el.position.y;
        return prev.map((e) => {
          if (e.id === id) return { ...e, position: { ...e.position, y: newY } };
          if (el.type === 'drawerbox' && e.type === 'blenda' && e.cabinetId === el.cabinetId)
            return { ...e, position: { ...e.position, y: e.position.y + moveDy } };
          if (el.type === 'drawerbox' && e.type === 'drawer' && e.cabinetId === id)
            return { ...e, position: { ...e.position, y: e.position.y + moveDy } };
          return e;
        });
      });
    },
    []
  );

  const handleAddShelfToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
      const shelf: BoxElement = {
        id: crypto.randomUUID(),
        name: `Półka ${shelfCounter++}`,
        type: 'shelf',
        cabinetId,
        dimensions: { width: innerWidth, height: PANEL_T, depth: cab.dimensions.depth },
        position: {
          x: cab.position.x,
          z: cab.position.z,
          y: cab.position.y + cab.dimensions.height / 2,
        },
        color: cab.color,
      };
      setSelectedId(cabinetId);
      return [...prev, shelf];
    });
  }, []);

  const handleAddDrawerToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 0.004);
      const drawer: BoxElement = {
        id: crypto.randomUUID(),
        name: `Szuflada ${drawerCounter++}`,
        type: 'drawer',
        cabinetId,
        dimensions: { width: innerWidth, height: 0.145, depth: cab.dimensions.depth },
        position: {
          x: cab.position.x,
          z: cab.position.z,
          y: cab.position.y + cab.dimensions.height / 2,
        },
        color: cab.color,
      };
      setSelectedId(cabinetId);
      return [...prev, drawer];
    });
  }, []);

  const handleAddDrawerboxToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const canonicalWidth = cab.dimensions.width - 2 * PANEL_T;
      const depth = Math.max(0.01, cab.dimensions.depth - 0.04);
      const existingFronts = prev.filter((e) => e.type === 'front' && e.cabinetId === cabinetId);
      const isDouble = existingFronts.length >= 2;
      const isSingle = existingFronts.length === 1;

      let boxWidth = Math.max(0.01, canonicalWidth);
      let boxX = cab.position.x;
      if (isSingle) {
        boxWidth = Math.max(0.01, canonicalWidth - 0.04);
        boxX = cab.position.x + 0.02;
      } else if (isDouble) {
        boxWidth = Math.max(0.01, canonicalWidth - 0.08);
        boxX = cab.position.x;
      }

      const drawerbox: BoxElement = {
        id: crypto.randomUUID(),
        name: `Box szuflady ${drawerboxCounter++}`,
        type: 'drawerbox',
        cabinetId,
        dimensions: { width: boxWidth, height: 0.4, depth },
        position: {
          x: boxX,
          y: cab.position.y + PANEL_T,
          z: cab.position.z - 0.02, // back-aligned: 40mm shallower than cabinet
        },
        color: cab.color,
      };

      const blendas: BoxElement[] = [];
      const blendaZ = cab.position.z - 0.02 + depth / 2 - 0.10;
      if (isSingle || isDouble) {
        blendas.push({
          id: crypto.randomUUID(),
          name: `Blenda ${blendaCounter++}`,
          type: 'blenda' as const,
          cabinetId,
          blendaSide: 'left' as const,
          dimensions: { width: 0.04, height: 0.4, depth: PANEL_T },
          position: {
            x: cab.position.x - cab.dimensions.width / 2 + PANEL_T + 0.02,
            y: drawerbox.position.y,
            z: blendaZ,
          },
          color: cab.color,
        });
      }
      if (isDouble) {
        blendas.push({
          id: crypto.randomUUID(),
          name: `Blenda ${blendaCounter++}`,
          type: 'blenda' as const,
          cabinetId,
          blendaSide: 'right' as const,
          dimensions: { width: 0.04, height: 0.4, depth: PANEL_T },
          position: {
            x: cab.position.x + cab.dimensions.width / 2 - PANEL_T - 0.02,
            y: drawerbox.position.y,
            z: blendaZ,
          },
          color: cab.color,
        });
      }

      setSelectedId(cabinetId);
      return [...prev, drawerbox, ...blendas];
    });
  }, []);

  const handleAddDividerToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const midX = cab.position.x; // start in the center
      const bounds = computeDividerBounds(cabinetId, cab.position.y + cab.dimensions.height / 2, prev);
      const divider: BoxElement = {
        id: crypto.randomUUID(),
        name: `Przegroda ${dividerCounter++}`,
        type: 'divider',
        cabinetId,
        dimensions: { width: PANEL_T, height: bounds.height, depth: cab.dimensions.depth },
        position: { x: midX, z: cab.position.z, y: bounds.y },
        color: cab.color,
      };
      setSelectedId(cabinetId);
      return [...prev, divider];
    });
  }, []);

  const handleAddFrontToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      // Only one single front per cabinet (and no single front if double already exists)
      if (prev.some((e) => e.type === 'front' && e.cabinetId === cabinetId)) return prev;
      const front: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front ${frontCounter++}`,
        type: 'front',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
      // Reset drawerbox to canonical size then shrink by 40mm on the left; add left blenda in the gap
      const drawerbox = prev.find((e) => e.type === 'drawerbox' && e.cabinetId === cabinetId);
      const blendas: BoxElement[] = [];
      let updatedPrev = prev;
      if (drawerbox) {
        const canonicalWidth = cab.dimensions.width - 2 * PANEL_T;
        const newWidth = Math.max(0.01, canonicalWidth - 0.04);
        const newX = cab.position.x + 0.02;
        const updatedDbox = {
          ...drawerbox,
          dimensions: { ...drawerbox.dimensions, width: newWidth },
          position: { ...drawerbox.position, x: newX },
        };
        const drawerWidth = Math.max(0.01, newWidth - 2 * PANEL_T - 0.004);
        updatedPrev = prev.map((e) => {
          if (e.id === drawerbox.id) return updatedDbox;
          if (e.type === 'drawer' && e.cabinetId === drawerbox.id)
            return { ...e, dimensions: { ...e.dimensions, width: drawerWidth }, position: { ...e.position, x: newX } };
          return e;
        });
        blendas.push({
          id: crypto.randomUUID(),
          name: `Blenda ${blendaCounter++}`,
          type: 'blenda' as const,
          cabinetId,
          blendaSide: 'left' as const,
          dimensions: { width: 0.04, height: drawerbox.dimensions.height, depth: PANEL_T },
          position: {
            x: cab.position.x - cab.dimensions.width / 2 + PANEL_T + 0.02,
            y: drawerbox.position.y,
            z: drawerbox.position.z + drawerbox.dimensions.depth / 2 - 0.10,
          },
          color: cab.color,
        });
      }
      return [...updatedPrev, front, ...blendas];
    });
  }, []);

  const handleAddDoubleFrontToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      // Only if no front exists yet
      if (prev.some((e) => e.type === 'front' && e.cabinetId === cabinetId)) return prev;
      const leftLeaf: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front L${frontCounter}`,
        type: 'front',
        frontSide: 'left',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      const rightLeaf: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front R${frontCounter++}`,
        type: 'front',
        frontSide: 'right',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
      // Reset drawerbox to canonical size then shrink 80mm (40mm each side); add blendas on both sides
      const drawerbox = prev.find((e) => e.type === 'drawerbox' && e.cabinetId === cabinetId);
      const blendas: BoxElement[] = [];
      let updatedPrev = prev;
      if (drawerbox) {
        const canonicalWidth = cab.dimensions.width - 2 * PANEL_T;
        const newWidth = Math.max(0.01, canonicalWidth - 0.08);
        const newX = cab.position.x;
        const updatedDbox = {
          ...drawerbox,
          dimensions: { ...drawerbox.dimensions, width: newWidth },
          position: { ...drawerbox.position, x: newX },
        };
        const drawerWidth = Math.max(0.01, newWidth - 2 * PANEL_T - 0.004);
        updatedPrev = prev.map((e) => {
          if (e.id === drawerbox.id) return updatedDbox;
          if (e.type === 'drawer' && e.cabinetId === drawerbox.id)
            return { ...e, dimensions: { ...e.dimensions, width: drawerWidth }, position: { ...e.position, x: newX } };
          return e;
        });
        blendas.push(
          {
            id: crypto.randomUUID(),
            name: `Blenda ${blendaCounter++}`,
            type: 'blenda' as const,
            cabinetId,
            blendaSide: 'left' as const,
            dimensions: { width: 0.04, height: drawerbox.dimensions.height, depth: PANEL_T },
            position: {
              x: cab.position.x - cab.dimensions.width / 2 + PANEL_T + 0.02,
              y: drawerbox.position.y,
              z: drawerbox.position.z + drawerbox.dimensions.depth / 2 - 0.10,
            },
            color: cab.color,
          },
          {
            id: crypto.randomUUID(),
            name: `Blenda ${blendaCounter++}`,
            type: 'blenda' as const,
            cabinetId,
            blendaSide: 'right' as const,
            dimensions: { width: 0.04, height: drawerbox.dimensions.height, depth: PANEL_T },
            position: {
              x: cab.position.x + cab.dimensions.width / 2 - PANEL_T - 0.02,
              y: drawerbox.position.y,
              z: drawerbox.position.z + drawerbox.dimensions.depth / 2 - 0.10,
            },
            color: cab.color,
          },
        );
      }
      return [...updatedPrev, leftLeaf, rightLeaf, ...blendas];
    });
  }, []);

  const handleAddLegsToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'leg' && e.cabinetId === cabinetId)) return prev;
      const h = 0.1; // 10 cm default height
      // Lift the cabinet (and all its bound elements) by leg height
      const liftedCab = { ...cab, position: { ...cab.position, y: cab.position.y + h } };
      const updatedPrev = prev.map((e) => {
        if (e.id === cabinetId) return liftedCab;
        if (e.cabinetId !== cabinetId) return e;
        if (e.type === 'front') return computeFrontForCabinet(e, liftedCab);
        if (e.type === 'hdf') return computeHdfForCabinet(e, liftedCab);
        if (e.type === 'plinth') return computePlinthForCabinet(e, liftedCab, prev);
        return { ...e, position: { ...e.position, y: e.position.y + h } };
      });
      const legsEl = computeLegsForCabinet(
        {
          id: crypto.randomUUID(),
          name: `Nóżki ${legCounter++}`,
          type: 'leg',
          cabinetId,
          dimensions: { width: 0, height: h, depth: 0 },
          position: { x: 0, y: 0, z: 0 },
          color: cab.color,
        },
        liftedCab
      );
      setSelectedId(cabinetId);
      return [...updatedPrev, legsEl];
    });
  }, []);

  const handleAddHdfToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'hdf' && e.cabinetId === cabinetId)) return prev;
      const hdf: BoxElement = computeHdfForCabinet({
        id: crypto.randomUUID(),
        name: `HDF ${hdfCounter++}`,
        type: 'hdf',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
      return [...prev, hdf];
    });
  }, []);

  const handleAddPlinthToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'plinth' && e.cabinetId === cabinetId)) return prev;
      const plinth: BoxElement = computePlinthForCabinet({
        id: crypto.randomUUID(),
        name: `Cokoł ${plinthCounter++}`,
        type: 'plinth',
        cabinetId,
        dimensions: { width: 0, height: 0.1, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab, prev);
      setSelectedId(cabinetId);
      return [...prev, plinth];
    });
  }, []);

  const handleAddRodToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const ROD_D = 0.025;
      const innerWidth = Math.max(0.001, cab.dimensions.width - 2 * PANEL_T);
      const rod: BoxElement = {
        id: crypto.randomUUID(),
        name: `Drążek ${rodCounter++}`,
        type: 'rod',
        cabinetId,
        dimensions: { width: innerWidth, height: ROD_D, depth: ROD_D },
        position: {
          x: cab.position.x,
          z: cab.position.z,
          y: cab.position.y + cab.dimensions.height * 0.75,
        },
        color: cab.color,
      };
      setSelectedId(cabinetId);
      return [...prev, rod];
    });
  }, []);

  const handleAdd = useCallback((type: 'cabinet' | 'shelf') => {
    const raw = type === 'shelf' ? createShelf() : createBox();
    // Spawn at a random position within the moveable board area
    const bw = boardSizeRef.current.width / 1000;
    const bd = boardSizeRef.current.depth / 1000;
    const rx = Math.max(0, (bw - raw.dimensions.width) / 2);
    const rz = Math.max(0, (bd - raw.dimensions.depth) / 2);
    const el = {
      ...raw,
      position: {
        ...raw.position,
        x: (Math.random() * 2 - 1) * rx,
        z: (Math.random() * 2 - 1) * rz,
      },
    };
    setElements((prev) => {
      if (type === 'shelf') return [...prev, el];
      const newY = computeYForBox(el, prev, boardSizeRef.current.height / 1000);
      return [...prev, { ...el, position: { ...el.position, y: newY } }];
    });
    setSelectedId(el.id);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      dividerYHintRef.current.delete(id);
      dragDeltaRef.current.delete(id);
      detachedFromRef.current.delete(id);
      setElements((prev) => {
        const el = prev.find((e) => e.id === id);
        const toRemove = new Set<string>([id]);
        if (el?.type === 'group') {
          // Remove group fronts
          for (const e of prev) {
            if (e.type === 'front' && e.cabinetId === id) toRemove.add(e.id);
          }
          // Remove member cabinets and all their children
          for (const e of prev) {
            if (e.groupId === id) {
              toRemove.add(e.id);
              for (const child of prev) {
                if (child.cabinetId === e.id) toRemove.add(child.id);
              }
            }
          }
        } else {
          // Recursively collect all descendants (handles drawerbox→drawer nesting)
          const collectDescendants = (parentId: string) => {
            for (const e of prev) {
              if (e.cabinetId === parentId && !toRemove.has(e.id)) {
                toRemove.add(e.id);
                collectDescendants(e.id);
              }
            }
          };
          collectDescendants(id);
          // If deleting a front: remove blendas of same cabinet AND restore drawerbox to canonical width
          if (el?.type === 'front' && el.cabinetId) {
            for (const e of prev) {
              if (e.type === 'blenda' && e.cabinetId === el.cabinetId) toRemove.add(e.id);
            }
          }
          // If deleting a drawerbox: remove blendas of parent cabinet
          if (el?.type === 'drawerbox' && el.cabinetId) {
            for (const e of prev) {
              if (e.type === 'blenda' && e.cabinetId === el.cabinetId) toRemove.add(e.id);
            }
          }
        }
        toRemove.forEach((rid) => {
          dividerYHintRef.current.delete(rid);
          dragDeltaRef.current.delete(rid);
          detachedFromRef.current.delete(rid);
        });
        const filtered = prev.filter((e) => !toRemove.has(e.id));
        // After removing a front, restore the cabinet's drawerbox to canonical size/position
        if (el?.type === 'front' && el.cabinetId) {
          const cab = filtered.find((e) => e.id === el.cabinetId);
          const dbox = filtered.find((e) => e.type === 'drawerbox' && e.cabinetId === el.cabinetId);
          if (cab && dbox) {
            const canonicalWidth = cab.dimensions.width - 2 * PANEL_T;
            const canonicalDrawerWidth = Math.max(0.01, canonicalWidth - 2 * PANEL_T - 0.004);
            return filtered.map((e) => {
              if (e.id === dbox.id)
                return { ...e, dimensions: { ...e.dimensions, width: canonicalWidth }, position: { ...e.position, x: cab.position.x } };
              if (e.type === 'drawer' && e.cabinetId === dbox.id)
                return { ...e, dimensions: { ...e.dimensions, width: canonicalDrawerWidth }, position: { ...e.position, x: cab.position.x } };
              return e;
            });
          }
        }
        return filtered;
      });
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    []
  );

  const handleUngroup = useCallback((groupId: string) => {
    setElements((prev) => {
      // Remove the group element and its fronts; free the member cabinets
      const toRemove = new Set<string>([groupId]);
      for (const e of prev) {
        if (e.type === 'front' && e.cabinetId === groupId) toRemove.add(e.id);
      }
      return prev
        .filter((e) => !toRemove.has(e.id))
        .map((e) => e.groupId === groupId ? { ...e, groupId: undefined } : e);
    });
    setSelectedId((prev) => (prev === groupId ? null : prev));
  }, []);

  const handleDragStart = useCallback((id: string) => {
    dragDeltaRef.current.set(id, { dx: 0, dz: 0 });
  }, []);

  const handleMultiSelectToggle = useCallback((id: string) => {
    setMultiSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleGroup = useCallback((ids: string[]) => {
    setElements((prev) => {
      // Only group cabinets that aren't already in a group
      const validIds = ids.filter((id) => {
        const el = prev.find((e) => e.id === id);
        return el?.type === 'cabinet' && !el.groupId;
      });
      if (validIds.length < 2) return prev;
      const groupId = crypto.randomUUID();
      const groupEl: BoxElement = {
        id: groupId,
        name: `Grupa ${groupCounter++}`,
        type: 'group',
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: '#888888',
      };
      const withGroupIds = prev.map((e) =>
        validIds.includes(e.id) ? { ...e, groupId } : e
      );
      const withGroup = [...withGroupIds, groupEl];
      return recomputeGroups(withGroup);
    });
    setMultiSelectedIds([]);
  }, []);

  const handleAddFrontToGroup = useCallback((groupId: string) => {
    setElements((prev) => {
      const group = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!group) return prev;
      if (prev.some((e) => e.type === 'front' && e.cabinetId === groupId)) return prev;
      const front: BoxElement = computeFrontForGroup({
        id: crypto.randomUUID(),
        name: `Front gr. ${frontCounter++}`,
        type: 'front',
        cabinetId: groupId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      }, prev);
      return [...prev, front];
    });
  }, []);

  const handleOpenFrontsChange = useCallback((cabinetId: string, open: boolean) => {
    setElements((prev) => prev.map((e) => e.id === cabinetId ? { ...e, openFronts: open } : e));
  }, []);

  const handleHasBottomPanelChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasBottomPanel: has } : e));
  }, []);

  // Delete selected element with keyboard Delete key (skip when an input is focused)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Delete') {
        if (selectedId) handleDelete(selectedId);
        return;
      }

      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        if (!selectedId) return;
        setElements((prev) => {
          const src = prev.find((el) => el.id === selectedId);
          if (!src || src.type !== 'cabinet') return prev;
          const newCabId = crypto.randomUUID();
          const newCab: BoxElement = {
            ...src,
            id: newCabId,
            name: `${src.name} (kopia)`,
            groupId: undefined,
            position: { ...src.position, x: src.position.x + src.dimensions.width + 0.02 },
          };
          // Clone all children bound to the source cabinet
          const children = prev.filter((el) => el.cabinetId === src.id);
          const newChildren: BoxElement[] = children.map((child) => {
            const newChild: BoxElement = {
              ...child,
              id: crypto.randomUUID(),
              cabinetId: newCabId,
              position: {
                ...child.position,
                x: child.position.x + src.dimensions.width + 0.02,
              },
            };
            if (child.type === 'front') return computeFrontForCabinet(newChild, newCab);
            if (child.type === 'hdf') return computeHdfForCabinet(newChild, newCab);
            if (child.type === 'leg') return computeLegsForCabinet(newChild, newCab);
            return newChild;
          });
          return [...prev, newCab, ...newChildren];
        });
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, handleDelete]);

  useThreeScene(containerRef, {
    elements,
    selectedId,
    boardSize: { width: boardSize.width / 1000, depth: boardSize.depth / 1000 },
    onSelect: handleSelect,
    onDimensionChange: handleDimensionDrag,
    onPositionChange: handlePositionChange,
    onYMove: handleYMove,
    onDragStart: handleDragStart,
  });

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;
  const selectedCabHasFront = selectedElement?.type === 'cabinet' &&
    elements.some((e) => e.type === 'front' && e.cabinetId === selectedElement.id);

  return (
    <div className="app">
      <aside className="sidebar left">
        <ElementLibrary
          elements={elements}
          selectedId={selectedId}
          multiSelectedIds={multiSelectedIds}
          boardSize={boardSize}
          onBoardSizeChange={setBoardSize}
          onSelect={handleSelect}
          onMultiSelectToggle={handleMultiSelectToggle}
          onGroup={handleGroup}
          onAdd={handleAdd}
          onAddShelfToCabinet={handleAddShelfToCabinet}
          onAddDrawerToCabinet={handleAddDrawerToCabinet}
          onAddDrawerboxToCabinet={handleAddDrawerboxToCabinet}
          onAddDividerToCabinet={handleAddDividerToCabinet}
          onAddFrontToCabinet={handleAddFrontToCabinet}
          onAddDoubleFrontToCabinet={handleAddDoubleFrontToCabinet}
          onAddRodToCabinet={handleAddRodToCabinet}
          onAddLegsToCabinet={handleAddLegsToCabinet}
          onAddHdfToCabinet={handleAddHdfToCabinet}
          onAddPlinthToCabinet={handleAddPlinthToCabinet}
          onAddFrontToGroup={handleAddFrontToGroup}
          onUngroup={handleUngroup}
          onDelete={handleDelete}
        />
      </aside>

      <main className="viewport" ref={containerRef}>
        <ModelOverlay elements={elements} />
      </main>

      <aside className="sidebar right">
        <PropertiesPanel
          element={selectedElement}
          onChange={handleDimensionInput}
          onYChange={handleYChange}
          hasFront={selectedCabHasFront}
          onOpenFrontsChange={(open) => selectedElement && handleOpenFrontsChange(selectedElement.id, open)}
          onHasBottomPanelChange={(has) => selectedElement && handleHasBottomPanelChange(selectedElement.id, has)}
        />
      </aside>
    </div>
  );
};

export default App;

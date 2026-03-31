import type { BoxElement } from './types';
import { PANEL_T, FRONT_INSET, HDF_T, HDF_INSET } from './constants';

/** Computes position/dimensions of an HDF back panel bound to its cabinet. */
export function computeHdfForCabinet(hdf: BoxElement, cab: BoxElement): BoxElement {
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

/** Computes position/dimensions of the single legs element (all 4 legs combined) for a cabinet. */
export function computeLegsForCabinet(legs: BoxElement, cab: BoxElement): BoxElement {
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

/** Computes position/dimensions of the plinth (cokoł) at the front of the cabinet, at floor level. */
export function computePlinthForCabinet(plinth: BoxElement, cab: BoxElement, allElements: BoxElement[]): BoxElement {
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

/** Computes the position/dimensions of a front panel bound to its cabinet. */
export function computeFrontForCabinet(front: BoxElement, cab: BoxElement): BoxElement {
  const z = cab.position.z + cab.dimensions.depth / 2 + PANEL_T / 2;
  const fullH = Math.max(0.001, cab.dimensions.height - 2 * FRONT_INSET);
  const yPos = cab.position.y + FRONT_INSET;
  if (front.frontSide === 'left' || front.frontSide === 'right') {
    const leafW = Math.max(0.001, cab.dimensions.width / 2 - 2 * FRONT_INSET);
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

/** Computes the position/dimensions of a front panel that spans all cabinets in a group. */
export function computeFrontForGroup(front: BoxElement, allElements: BoxElement[]): BoxElement {
  const group = allElements.find((e) => e.id === front.cabinetId);
  if (!group) return front;
  const members = allElements.filter((e) => e.groupId === group.id && e.type === 'cabinet');
  if (members.length === 0) return front;
  const minX = Math.min(...members.map((c) => c.position.x - c.dimensions.width / 2));
  const maxX = Math.max(...members.map((c) => c.position.x + c.dimensions.width / 2));
  const minY = Math.min(...members.map((c) => c.position.y));
  const maxY = Math.max(...members.map((c) => c.position.y + c.dimensions.height));
  const maxFaceZ = Math.max(...members.map((c) => c.position.z + c.dimensions.depth / 2));
  const totalW = maxX - minX;
  const fullH = Math.max(0.001, (maxY - minY) - 2 * FRONT_INSET);
  const centerX = (minX + maxX) / 2;
  const z = maxFaceZ + PANEL_T / 2;
  if (front.frontSide === 'left' || front.frontSide === 'right') {
    const leafW = Math.max(0.001, totalW / 2 - 2 * FRONT_INSET);
    return {
      ...front,
      dimensions: { width: leafW, height: fullH, depth: PANEL_T },
      position: {
        x: front.frontSide === 'left' ? centerX - totalW / 4 : centerX + totalW / 4,
        y: minY + FRONT_INSET,
        z,
      },
    };
  }
  return {
    ...front,
    dimensions: {
      width: Math.max(0.001, totalW - 2 * FRONT_INSET),
      height: fullH,
      depth: PANEL_T,
    },
    position: { x: centerX, y: minY + FRONT_INSET, z },
  };
}

const MASK_FRONT_EXT = PANEL_T + 0.002; // 18 mm drzwi + 2 mm szpara
const MASK_BACK_EXT  = HDF_T;            // 3 mm płyta HDF

/** Computes position/dimensions of a maskowanica (side cover panel) bound to a cabinet. */
export function computeMaskowanicaForCabinet(mask: BoxElement, cab: BoxElement, allElements: BoxElement[]): BoxElement {
  const legs = allElements.find((e) => e.type === 'leg' && e.cabinetId === cab.id);
  const legH = legs ? legs.dimensions.height : 0;
  const totalDepth = mask.niepelna ? 0.08 : cab.dimensions.depth + MASK_FRONT_EXT + MASK_BACK_EXT;
  const zPos = mask.niepelna
    ? cab.position.z + cab.dimensions.depth / 2 + MASK_FRONT_EXT - 0.04
    : cab.position.z + (MASK_FRONT_EXT - MASK_BACK_EXT) / 2;
  if (mask.maskownicaSide === 'bottom') {
    return {
      ...mask,
      dimensions: { width: cab.dimensions.width, height: PANEL_T, depth: totalDepth },
      position: { x: cab.position.x, y: cab.position.y - legH - PANEL_T, z: zPos },
    };
  }
  if (mask.maskownicaSide === 'top') {
    return {
      ...mask,
      dimensions: { width: cab.dimensions.width, height: PANEL_T, depth: totalDepth },
      position: { x: cab.position.x, y: cab.position.y + cab.dimensions.height, z: zPos },
    };
  }
  const hasTop    = allElements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'top'    && e.id !== mask.id)
                 || (cab.groupId != null && allElements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.groupId && e.maskownicaSide === 'top'));
  const hasBottom = allElements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'bottom' && e.id !== mask.id)
                 || (cab.groupId != null && allElements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.groupId && e.maskownicaSide === 'bottom'));
  const topExt    = hasTop    ? PANEL_T : 0;
  const bottomExt = hasBottom ? PANEL_T : 0;
  const minY = cab.position.y - legH - bottomExt;
  const maxY = cab.position.y + cab.dimensions.height + topExt;
  const xPos = mask.maskownicaSide === 'left'
    ? cab.position.x - cab.dimensions.width / 2 - PANEL_T / 2
    : cab.position.x + cab.dimensions.width / 2 + PANEL_T / 2;
  const sideEdgeX = mask.maskownicaSide === 'left'
    ? cab.position.x - cab.dimensions.width / 2
    : cab.position.x + cab.dimensions.width / 2;
  const TOUCH_TOL = PANEL_T * 2;
  const adjBoxes = allElements.filter((e) => {
    if (e.id === cab.id || e.cabinetId === cab.id) return false;
    if (e.type !== 'cabinet' && e.type !== 'group') return false;
    const eLX = e.position.x - e.dimensions.width / 2;
    const eRX = e.position.x + e.dimensions.width / 2;
    const touchEdge = mask.maskownicaSide === 'left' ? eRX : eLX;
    if (Math.abs(touchEdge - sideEdgeX) > TOUCH_TOL) return false;
    return e.position.y + e.dimensions.height > minY && e.position.y < maxY;
  });
  let effMinY = minY;
  let effMaxY = maxY;
  if (adjBoxes.length > 0) {
    const adjItems = adjBoxes.flatMap((b) => {
      const bMasks = allElements.filter(
        (e) => e.type === 'maskowanica' && e.cabinetId === b.id &&
               (e.maskownicaSide === 'left' || e.maskownicaSide === 'right')
      );
      return [b, ...bMasks];
    });
    const covered = adjItems
      .map((b) => [Math.max(minY, b.position.y), Math.min(maxY, b.position.y + b.dimensions.height)] as [number, number])
      .filter(([a, b]) => a < b)
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [covered[0]];
    for (let i = 1; i < covered.length; i++) {
      const last = merged[merged.length - 1];
      if (covered[i][0] <= last[1]) last[1] = Math.max(last[1], covered[i][1]);
      else merged.push(covered[i]);
    }
    const breakpoints = [minY, ...merged.flatMap(([a, b]) => [a, b]), maxY];
    let bestSize = -1;
    for (let i = 0; i < breakpoints.length - 1; i += 2) {
      const size = breakpoints[i + 1] - breakpoints[i];
      if (size > bestSize) { bestSize = size; effMinY = breakpoints[i]; effMaxY = breakpoints[i + 1]; }
    }
  }
  const totalH = Math.max(0.001, effMaxY - effMinY);
  return {
    ...mask,
    dimensions: { width: PANEL_T, height: totalH, depth: totalDepth },
    position: { x: xPos, y: effMinY, z: zPos },
  };
}

/** Computes position/dimensions of a maskowanica spanning all cabinets in a group. */
export function computeMaskowanicaForGroup(mask: BoxElement, allElements: BoxElement[]): BoxElement {
  const group = allElements.find((e) => e.id === mask.cabinetId);
  if (!group) return mask;
  const members = allElements.filter((e) => e.groupId === group.id && e.type === 'cabinet');
  if (members.length === 0) return mask;
  const minX = Math.min(...members.map((c) => c.position.x - c.dimensions.width / 2));
  const maxX = Math.max(...members.map((c) => c.position.x + c.dimensions.width / 2));
  const maxFaceZ = Math.max(...members.map((c) => c.position.z + c.dimensions.depth / 2));
  const minBackZ = Math.min(...members.map((c) => c.position.z - c.dimensions.depth / 2));
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cab of members) {
    const legs = allElements.find((e) => e.type === 'leg' && e.cabinetId === cab.id);
    const legH = legs ? legs.dimensions.height : 0;
    const hasTop = allElements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'top');
    const hasBottom = allElements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'bottom');
    const topExt = hasTop ? PANEL_T : 0;
    const bottomExt = hasBottom ? PANEL_T : 0;
    minY = Math.min(minY, cab.position.y - legH - bottomExt);
    maxY = Math.max(maxY, cab.position.y + cab.dimensions.height + topExt);
  }
  if (mask.maskownicaSide === 'top' || mask.maskownicaSide === 'bottom') {
    const totalDepth = mask.niepelna ? 0.08 : (maxFaceZ - minBackZ) + MASK_FRONT_EXT + MASK_BACK_EXT;
    const zPos = mask.niepelna
      ? maxFaceZ + MASK_FRONT_EXT - 0.04
      : (maxFaceZ + MASK_FRONT_EXT + minBackZ - MASK_BACK_EXT) / 2;
    if (mask.maskownicaSide === 'top') {
      const groupTopY = Math.max(...members.map((c) => c.position.y + c.dimensions.height));
      return {
        ...mask,
        dimensions: { width: maxX - minX, height: PANEL_T, depth: totalDepth },
        position: { x: (minX + maxX) / 2, y: groupTopY, z: zPos },
      };
    }
    // bottom
    const groupBottomY = Math.min(...members.map((c) => {
      const legs = allElements.find((e) => e.type === 'leg' && e.cabinetId === c.id);
      return c.position.y - (legs ? legs.dimensions.height : 0);
    }));
    return {
      ...mask,
      dimensions: { width: maxX - minX, height: PANEL_T, depth: totalDepth },
      position: { x: (minX + maxX) / 2, y: groupBottomY - PANEL_T, z: zPos },
    };
  }
  const TOUCH_TOL = PANEL_T * 2;
  const sideEdgeX = mask.maskownicaSide === 'right' ? maxX : minX;
  const adjBoxes = allElements.filter((e) => {
    if (e.groupId === group.id) return false;
    if (e.type !== 'cabinet' && e.type !== 'group') return false;
    const eLX = e.position.x - e.dimensions.width / 2;
    const eRX = e.position.x + e.dimensions.width / 2;
    const touchEdge = mask.maskownicaSide === 'right' ? eLX : eRX;
    if (Math.abs(touchEdge - sideEdgeX) > TOUCH_TOL) return false;
    return e.position.y + e.dimensions.height > minY && e.position.y < maxY;
  });
  let effMinY = minY;
  let effMaxY = maxY;
  if (adjBoxes.length > 0) {
    // Build covered intervals clipped to [minY, maxY], then find largest free gap
    // Also include side maskowanice of adjacent boxes (they may extend further e.g. due to legs)
    const adjItems = adjBoxes.flatMap((b) => {
      const bMasks = allElements.filter(
        (e) => e.type === 'maskowanica' && e.cabinetId === b.id &&
               (e.maskownicaSide === 'left' || e.maskownicaSide === 'right')
      );
      return [b, ...bMasks];
    });
    const covered = adjItems
      .map((b) => [Math.max(minY, b.position.y), Math.min(maxY, b.position.y + b.dimensions.height)] as [number, number])
      .filter(([a, b]) => a < b)
      .sort((a, b) => a[0] - b[0]);
    // Merge overlapping intervals
    const merged: [number, number][] = [covered[0]];
    for (let i = 1; i < covered.length; i++) {
      const last = merged[merged.length - 1];
      if (covered[i][0] <= last[1]) last[1] = Math.max(last[1], covered[i][1]);
      else merged.push(covered[i]);
    }
    // Free segments between minY..maxY
    const breakpoints = [minY, ...merged.flatMap(([a, b]) => [a, b]), maxY];
    let bestSize = -1;
    for (let i = 0; i < breakpoints.length - 1; i += 2) {
      const size = breakpoints[i + 1] - breakpoints[i];
      if (size > bestSize) { bestSize = size; effMinY = breakpoints[i]; effMaxY = breakpoints[i + 1]; }
    }
  }
  const totalH = Math.max(0.001, effMaxY - effMinY);
  const totalDepth = mask.niepelna ? 0.08 : (maxFaceZ - minBackZ) + MASK_FRONT_EXT + MASK_BACK_EXT;
  const zPos = mask.niepelna
    ? maxFaceZ + MASK_FRONT_EXT - 0.04
    : (maxFaceZ + MASK_FRONT_EXT + minBackZ - MASK_BACK_EXT) / 2;
  const xPos = mask.maskownicaSide === 'left'
    ? minX - PANEL_T / 2
    : maxX + PANEL_T / 2;
  return {
    ...mask,
    dimensions: { width: PANEL_T, height: totalH, depth: totalDepth },
    position: { x: xPos, y: effMinY, z: zPos },
  };
}

/** Recompute the bounds of a group element from its member cabinets. */
export function computeGroupBounds(group: BoxElement, allElements: BoxElement[]): BoxElement {
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

/** After any mutation, resync all groups and their fronts and maskowanice. */
export function recomputeGroups(elements: BoxElement[]): BoxElement[] {
  const result = elements.map((e) => {
    if (e.type === 'group') return computeGroupBounds(e, elements);
    return e;
  });
  const result2 = result.map((e) => {
    if (e.type === 'front' && e.cabinetId) {
      const linked = result.find((g) => g.id === e.cabinetId);
      if (linked?.type === 'group') return computeFrontForGroup(e, result);
    }
    return e;
  });
  const result3 = result2.map((e) => {
    if (e.type === 'maskowanica' && e.cabinetId) {
      const linked = result2.find((g) => g.id === e.cabinetId);
      if (linked?.type === 'group') return computeMaskowanicaForGroup(e, result2);
    }
    return e;
  });
  return result3;
}

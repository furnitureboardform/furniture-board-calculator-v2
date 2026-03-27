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

/** After any mutation, resync all groups and their fronts. */
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
  return result2;
}

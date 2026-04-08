import { useCallback } from 'react';
import type React from 'react';
import type { BoxElement, BoxDimensions } from '../types';
import { PANEL_T, DETACH_DIST, HYSTERESIS_DIST, DIVIDER_EDGE_SNAP, DIVIDER_DETACH_DIST, DRAWER_RAIL_CLEARANCE, FRONT_INSET } from '../constants';
import {
  computeHdfForCabinet,
  computeRearboardForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computeFrontForCabinet,
  computeMaskowanicaForCabinet,
  recomputeGroups,
} from '../computeElements';
import {
  computeYForBox,
  recomputeAllY,
  fitShelfDepthToCabinet,
  fitCabinetToBelow,
  computeDividerBounds,
  fitShelfToBay,
  fitDrawerToBay,
  computeDrawerYBounds,
  computeStretchCollisionMax,
  clampYBoundsToObstacles,
} from '../geometry';
import {
  findNearCabinetHysteresis,
  attachAndFit,
  snapShelfEdgeToCabinet,
  snapToNeighbors,
  pushOutCollisions,
  clampYToCollisions,
} from '../snapAttach';

interface Params {
  setElements: React.Dispatch<React.SetStateAction<BoxElement[]>>;
  setElementsRaw: React.Dispatch<React.SetStateAction<BoxElement[]>>;
  snapshotHistory: () => void;
  boardSizeRef: React.MutableRefObject<{ width: number; depth: number; height: number }>;
  dividerYHintRef: React.MutableRefObject<Map<string, number>>;
  dragDeltaRef: React.MutableRefObject<Map<string, { dx: number; dz: number }>>;
  detachedFromRef: React.MutableRefObject<Map<string, string>>;
}

export function useDragHandlers({
  setElements,
  setElementsRaw,
  snapshotHistory,
  boardSizeRef,
  dividerYHintRef,
  dragDeltaRef,
  detachedFromRef,
}: Params) {
  const handleDimensionDrag = useCallback(
    (id: string, axis: 'width' | 'height' | 'depth', delta: number, dir: number) => {
      const posAxis: Record<'width' | 'height' | 'depth', 'x' | 'y' | 'z'> = {
        width: 'x',
        height: 'y',
        depth: 'z',
      };
      setElementsRaw((prev) => {
        const updated = prev.map((el) => {
          if (el.id !== id) return el;
          const oldVal = el.dimensions[axis];
          const pa = posAxis[axis];

          let maxAllowed = Infinity;
          if (!el.cabinetId) {
            const { width: bwMm, depth: bdMm, height: bhMm } = boardSizeRef.current;
            const bw = bwMm / 1000; const bd = bdMm / 1000; const roomH = bhMm / 1000;
            if (axis === 'width') {
              const fixedEdge = el.position.x - dir * oldVal / 2;
              maxAllowed = dir > 0 ? (bw / 2 - fixedEdge) : (fixedEdge + bw / 2);
            } else if (axis === 'depth') {
              const fixedEdge = el.position.z - dir * oldVal / 2;
              maxAllowed = dir > 0 ? (bd / 2 - fixedEdge) : (fixedEdge + bd / 2);
            } else if (axis === 'height') {
              maxAllowed = dir > 0
                ? roomH - el.position.y
                : el.position.y + oldVal;
            }
            maxAllowed = Math.min(maxAllowed, computeStretchCollisionMax(el, axis, dir, prev));
          }

          const newVal = Math.max(0.1, Math.min(maxAllowed, oldVal + delta));
          const actualDelta = newVal - oldVal;
          const newPosVal = axis === 'height'
            ? (dir > 0 ? el.position.y : el.position.y + oldVal - newVal)
            : el.position[pa] + actualDelta / 2 * dir;
          const withDelta = {
            ...el,
            dimensions: { ...el.dimensions, [axis]: newVal },
            position: { ...el.position, [pa]: newPosVal },
          };
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
        const changedEl = updated.find((e) => e.id === id);
        return recomputeAllY(updated, boardSizeRef.current.height / 1000, changedEl?.type === 'shelf');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          if (e.id !== id) return e;
          if (e.type === 'drawerbox' && e.cabinetId && clampedDims.depth !== e.dimensions.depth) {
            const cab = prev.find((c) => c.id === e.cabinetId);
            if (cab) {
              const newZ = cab.position.z + cab.dimensions.depth / 2 - 0.04 - clampedDims.depth / 2;
              return { ...e, dimensions: clampedDims, position: { ...e.position, z: newZ } };
            }
          }
          if (e.type === 'drawer' && e.cabinetId && clampedDims.depth !== e.dimensions.depth) {
            const par = prev.find((c) => c.id === e.cabinetId);
            if (par) {
              const newZ = par.position.z + par.dimensions.depth / 2 - PANEL_T - clampedDims.depth / 2;
              return { ...e, dimensions: clampedDims, position: { ...e.position, z: newZ } };
            }
          }
          return { ...e, dimensions: clampedDims };
        });
        return recomputeAllY(updated, boardSizeRef.current.height / 1000, el?.type === 'shelf');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handlePositionChange = useCallback(
    (id: string, dx: number, dz: number) => {
      const clampToBoard = (el: BoxElement): { x: number; z: number } => {
        const bw = boardSizeRef.current.width / 1000;
        const bd = boardSizeRef.current.depth / 1000;
        const rx = Math.max(0, (bw - el.dimensions.width) / 2);
        const rz = Math.max(0, (bd - el.dimensions.depth) / 2);
        return {
          x: Math.max(-rx, Math.min(rx, el.position.x)),
          z: Math.max(-rz, Math.min(rz, el.position.z)),
        };
      };
      setElementsRaw((prev) => {
        const movedEl = prev.find((e) => e.id === id)!;
        const afterMove = prev.map((el) =>
          el.id === id
            ? { ...el, position: { ...el.position, x: el.position.x + dx, z: el.position.z + dz } }
            : el
        );
        const movedAfter = afterMove.find((e) => e.id === id)!;

        // Fronts, HDF and cabinet-bound rods/legs are always locked in XZ
        if (movedEl.type === 'front' || movedEl.type === 'hdf' || movedEl.type === 'rearboard' || (movedEl.type === 'rod' && movedEl.cabinetId) || (movedEl.type === 'leg' && movedEl.cabinetId) || (movedEl.type === 'plinth' && movedEl.cabinetId) || (movedEl.type === 'maskowanica' && movedEl.cabinetId)) return prev;

        if (movedEl.type === 'shelf' || movedEl.type === 'board' || movedEl.type === 'divider') {
          if (movedEl.cabinetId) {
            const d = dragDeltaRef.current.get(id) ?? { dx: 0, dz: 0 };
            const nd = { dx: d.dx + dx, dz: d.dz + dz };
            dragDeltaRef.current.set(id, nd);

            if (movedEl.type === 'divider') {
              const zDisp = Math.abs(nd.dz);
              if (zDisp < DIVIDER_DETACH_DIST) {
                const cab = prev.find((e) => e.id === movedEl.cabinetId)!;
                const halfInner = (cab.dimensions.width - 2 * PANEL_T) / 2 - PANEL_T / 2;
                const rawX = Math.max(cab.position.x - halfInner, Math.min(cab.position.x + halfInner, movedEl.position.x + dx));
                const leftEdge = cab.position.x - halfInner;
                const rightEdge = cab.position.x + halfInner;
                const newX = Math.abs(rawX - leftEdge) < DIVIDER_EDGE_SNAP ? leftEdge
                           : Math.abs(rawX - rightEdge) < DIVIDER_EDGE_SNAP ? rightEdge
                           : rawX;
                const moved = { ...movedEl, position: { ...movedEl.position, x: newX } };
                const intermediate = prev.map((e) => (e.id === id ? moved : e));
                const bounds = computeDividerBounds(movedEl.cabinetId, moved.position.y + moved.dimensions.height / 2, intermediate);
                return prev.map((e) => e.id === id ? { ...moved, position: { ...moved.position, y: bounds.y }, dimensions: { ...moved.dimensions, height: bounds.height } } : e);
              }
            } else {
              const disp = Math.sqrt(nd.dx * nd.dx + nd.dz * nd.dz);
              if (disp < DETACH_DIST) return prev;
            }

            // Threshold exceeded — detach
            dividerYHintRef.current.delete(id);
            detachedFromRef.current.set(id, movedEl.cabinetId!);
            const detached = { ...movedAfter, cabinetId: undefined };
            const withDetached = afterMove.map((e) => e.id === id ? detached : e);
            const nearCab = findNearCabinetHysteresis(detached, withDetached, movedEl.cabinetId!);
            if (nearCab) {
              detachedFromRef.current.delete(id);
              dragDeltaRef.current.set(id, { dx: 0, dz: 0 });
              return withDetached.map((e) => e.id === id ? attachAndFit(detached, nearCab, withDetached) : e);
            }
            return withDetached;
          }

          // Free element — check hysteresis
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

          const nearCab = findNearCabinetHysteresis(movedAfter, afterMove, avoidCabId);
          if (nearCab) {
            detachedFromRef.current.delete(id);
            dragDeltaRef.current.set(id, { dx: 0, dz: 0 });
            return afterMove.map((e) => e.id === id ? attachAndFit(movedAfter, nearCab, afterMove) : e);
          }
          if (movedEl.type === 'shelf') {
            const snapped = snapToNeighbors(movedAfter, afterMove);
            const shelfWithXZ = { ...movedAfter, position: { ...movedAfter.position, x: snapped.x, z: snapped.z } };
            const fittedShelf = fitShelfDepthToCabinet(shelfWithXZ, afterMove);
            const pushed = pushOutCollisions(fittedShelf, afterMove);
            const pushedEl = { ...fittedShelf, position: { ...fittedShelf.position, x: pushed.x, z: pushed.z } };
            const clampedPos = clampToBoard(pushedEl);
            return afterMove.map((el) => el.id === id ? { ...pushedEl, position: { ...pushedEl.position, x: clampedPos.x, z: clampedPos.z } } : el);
          }
          if (movedEl.type === 'board') {
            const pushed = pushOutCollisions(movedAfter, afterMove);
            const pushedEl = { ...movedAfter, position: { ...movedAfter.position, x: pushed.x, z: pushed.z } };
            const clampedPos = clampToBoard(pushedEl);
            return afterMove.map((el) => el.id === id ? { ...pushedEl, position: { ...pushedEl.position, x: clampedPos.x, z: clampedPos.z } } : el);
          }
          return afterMove;
        }
        // Cabinet movement
        const prelim = afterMove.find((e) => e.id === id)!;
        const roomH = boardSizeRef.current.height / 1000;
        const prelimY = Math.max(computeYForBox(prelim, afterMove, roomH), movedEl.position.y);
        const prelimWithY = { ...prelim, position: { ...prelim.position, y: prelimY } };
        const withPrelimY = afterMove.map((el) => (el.id === id ? prelimWithY : el));
        const snapped = snapToNeighbors(prelimWithY, withPrelimY);
        const afterSnap = withPrelimY.map((el) =>
          el.id === id ? { ...el, position: { x: snapped.x, y: 0, z: snapped.z } } : el
        );
        const finalBox = afterSnap.find((e) => e.id === id)!;
        const finalY = Math.max(computeYForBox(finalBox, afterSnap, roomH), movedEl.position.y);
        const withFinalY = afterSnap.map((el) =>
          el.id === id ? { ...el, position: { ...el.position, y: finalY } } : el
        );
        if (finalY > 0) {
          const movedFinal = withFinalY.find((e) => e.id === id)!;
          const fitted = fitCabinetToBelow(movedFinal, withFinalY);
          if (fitted !== movedFinal) {
            const withFitted = withFinalY.map((el) => (el.id === id ? fitted : el));
            const adx = fitted.position.x - movedEl.position.x;
            const ady = fitted.position.y - movedEl.position.y;
            const adz = fitted.position.z - movedEl.position.z;
            return recomputeGroups(withFitted.map((el) => {
              if (el.id === id) return el;
              if (el.cabinetId !== id) return el;
              if (el.type === 'front') return computeFrontForCabinet(el, fitted);
              if (el.type === 'hdf') return computeHdfForCabinet(el, fitted);
              if (el.type === 'rearboard') return computeRearboardForCabinet(el, fitted);
              if (el.type === 'leg') return computeLegsForCabinet(el, fitted);
              if (el.type === 'maskowanica') return computeMaskowanicaForCabinet(el, fitted, withFitted);
              return { ...el, position: { x: el.position.x + adx, y: el.position.y + ady, z: el.position.z + adz } };
            }));
          }
        }
        // Collision push-out
        const pushedPos = pushOutCollisions(withFinalY.find((e) => e.id === id)!, withFinalY);
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
          if (el.type === 'rearboard') return computeRearboardForCabinet(el, movedFinal2);
          if (el.type === 'leg') return computeLegsForCabinet(el, movedFinal2);
          if (el.type === 'plinth') return computePlinthForCabinet(el, movedFinal2, withCollision);
          if (el.type === 'maskowanica') return computeMaskowanicaForCabinet(el, movedFinal2, withCollision);
          return { ...el, position: { x: el.position.x + adx, y: el.position.y + ady, z: el.position.z + adz } };
        }));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const { minY, maxY } = el.type === 'drawer'
              ? computeDrawerYBounds(el, cab, prev)
              : (() => {
                  const bottomOffset = cab.type === 'drawerbox' ? (cab.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
                  let mxY = cab.position.y + cab.dimensions.height - PANEL_T - el.dimensions.height;
                  let mnY = cab.position.y + bottomOffset;
                  if (el.type === 'shelf' || el.type === 'rod') {
                    const drawerboxes = prev.filter((e) => e.cabinetId === cab.id && e.type === 'drawerbox');
                    ({ mnY, mxY } = clampYBoundsToObstacles(drawerboxes, el.dimensions.height, newY, mnY, mxY));
                  }
                  return { minY: mnY, maxY: mxY };
                })();
            newY = Math.min(Math.max(minY, newY), Math.max(minY, maxY));
          }
        } else {
          newY = Math.min(newY, Math.max(0, roomH - el.dimensions.height));
        }
        let finalEl: BoxElement = { ...el, position: { ...el.position, y: newY } };
        if ((el.type === 'shelf' || el.type === 'rod' || el.type === 'drawer') && el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (cab?.type === 'cabinet' || cab?.type === 'boxkuchenny') {
            const dividers = prev.filter((e) => e.cabinetId === el.cabinetId && e.type === 'divider');
            if (dividers.length > 0) {
              const overlapsDivider = dividers.some((d) =>
                newY < d.position.y + d.dimensions.height && newY + el.dimensions.height > d.position.y
              );
              if (overlapsDivider) {
                finalEl = el.type === 'drawer' ? fitDrawerToBay(finalEl, prev) : fitShelfToBay(finalEl, prev);
              } else if (el.type === 'drawer') {
                const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * DRAWER_RAIL_CLEARANCE);
                const frontWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * FRONT_INSET);
                finalEl = { ...finalEl, dimensions: { ...finalEl.dimensions, width: innerWidth }, adjustedFrontWidth: frontWidth, position: { ...finalEl.position, x: cab.position.x } };
              } else {
                const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
                finalEl = { ...finalEl, dimensions: { ...finalEl.dimensions, width: innerWidth }, position: { ...finalEl.position, x: cab.position.x } };
              }
            }
          }
        }
        const dy = newY - el.position.y;
        return prev.map((e) => {
          if (e.id === id) return finalEl;
          if (el.type === 'drawerbox' && e.type === 'blenda' && e.cabinetId === el.cabinetId)
            return { ...e, position: { ...e.position, y: e.position.y + dy } };
          if (el.type === 'drawerbox' && e.type === 'drawer' && e.cabinetId === id)
            return { ...e, position: { ...e.position, y: e.position.y + dy } };
          return e;
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDividerXChange = useCallback(
    (id: string, x: number) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id)!;
        if (!el.cabinetId) return prev;
        const cab = prev.find((e) => e.id === el.cabinetId)!;
        const halfInner = (cab.dimensions.width - 2 * PANEL_T) / 2 - PANEL_T / 2;
        const clampedX = Math.max(cab.position.x - halfInner, Math.min(cab.position.x + halfInner, x));
        const moved = { ...el, position: { ...el.position, x: clampedX } };
        const intermediate = prev.map((e) => (e.id === id ? moved : e));
        const bounds = computeDividerBounds(el.cabinetId, moved.position.y + moved.dimensions.height / 2, intermediate);
        return prev.map((e) => e.id === id ? { ...moved, position: { ...moved.position, y: bounds.y }, dimensions: { ...moved.dimensions, height: bounds.height } } : e);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleYMove = useCallback(
    (id: string, dy: number) => {
      setElementsRaw((prev) => {
        const el = prev.find((e) => e.id === id)!;

        if (el.type === 'divider' && el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (!cab) return prev;
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
            const { minY, maxY } = el.type === 'drawer'
              ? computeDrawerYBounds(el, cab, prev)
              : (() => {
                  const bottomOffset = cab.type === 'drawerbox' ? (cab.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
                  let mxY = cab.position.y + cab.dimensions.height - PANEL_T - el.dimensions.height;
                  let mnY = cab.position.y + bottomOffset;
                  if (el.type === 'shelf' || el.type === 'rod') {
                    const drawerboxes = prev.filter((e) => e.cabinetId === cab.id && e.type === 'drawerbox');
                    ({ mnY, mxY } = clampYBoundsToObstacles(drawerboxes, el.dimensions.height, newY, mnY, mxY));
                  }
                  if (el.type === 'drawerbox') {
                    const shelves = prev.filter((e) => e.cabinetId === cab.id && (e.type === 'shelf' || e.type === 'rod'));
                    ({ mnY, mxY } = clampYBoundsToObstacles(shelves, el.dimensions.height, newY, mnY, mxY));
                  }
                  return { minY: mnY, maxY: mxY };
                })();
            newY = Math.min(Math.max(minY, newY), Math.max(minY, maxY));
          }
        } else {
          const roomH = boardSizeRef.current.height / 1000;
          newY = Math.min(newY, Math.max(0, roomH - el.dimensions.height));
          newY = clampYToCollisions(el, newY, dy, prev);
        }
        if (el.type === 'cabinet') {
          const actualDy = newY - el.position.y;
          const movedCab = { ...el, position: { ...el.position, y: newY } };
          return recomputeGroups(prev.map((e) => {
            if (e.id === id) return movedCab;
            if (e.cabinetId !== id) return e;
            if (e.type === 'front') return computeFrontForCabinet(e, movedCab);
            if (e.type === 'hdf') return computeHdfForCabinet(e, movedCab);
            if (e.type === 'rearboard') return computeRearboardForCabinet(e, movedCab);
            if (e.type === 'leg') return computeLegsForCabinet(e, movedCab);
            if (e.type === 'plinth') return computePlinthForCabinet(e, movedCab, prev);
            if (e.type === 'maskowanica') return computeMaskowanicaForCabinet(e, movedCab, prev);
            return { ...e, position: { ...e.position, y: e.position.y + actualDy } };
          }));
        }
        let finalElY: BoxElement = { ...el, position: { ...el.position, y: newY } };
        if ((el.type === 'shelf' || el.type === 'rod' || el.type === 'drawer') && el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (cab?.type === 'cabinet' || cab?.type === 'boxkuchenny') {
            const dividers = prev.filter((e) => e.cabinetId === el.cabinetId && e.type === 'divider');
            if (dividers.length > 0) {
              const overlapsDivider = dividers.some((d) =>
                newY < d.position.y + d.dimensions.height && newY + el.dimensions.height > d.position.y
              );
              if (overlapsDivider) {
                finalElY = el.type === 'drawer' ? fitDrawerToBay(finalElY, prev) : fitShelfToBay(finalElY, prev);
              } else if (el.type === 'drawer') {
                const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * DRAWER_RAIL_CLEARANCE);
                const frontWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * FRONT_INSET);
                finalElY = { ...finalElY, dimensions: { ...finalElY.dimensions, width: innerWidth }, adjustedFrontWidth: frontWidth, position: { ...finalElY.position, x: cab.position.x } };
              } else {
                const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
                finalElY = { ...finalElY, dimensions: { ...finalElY.dimensions, width: innerWidth }, position: { ...finalElY.position, x: cab.position.x } };
              }
            }
          }
        }
        const moveDy = newY - el.position.y;
        return prev.map((e) => {
          if (e.id === id) return finalElY;
          if (el.type === 'drawerbox' && e.type === 'blenda' && e.cabinetId === el.cabinetId)
            return { ...e, position: { ...e.position, y: e.position.y + moveDy } };
          if (el.type === 'drawerbox' && e.type === 'drawer' && e.cabinetId === id)
            return { ...e, position: { ...e.position, y: e.position.y + moveDy } };
          return e;
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleMultiPositionChange = useCallback(
    (ids: string[], dx: number, dz: number) => {
      setElementsRaw((prev) => {
        const idSet = new Set(ids);
        const bw = boardSizeRef.current.width / 1000;
        const bd = boardSizeRef.current.depth / 1000;
        // Compute the tightest allowed delta for the whole group so no element exits the board
        let minDx = -Infinity, maxDx = Infinity, minDz = -Infinity, maxDz = Infinity;
        prev.forEach((el) => {
          if (!idSet.has(el.id)) return;
          if (el.type === 'front' || el.type === 'hdf' || el.type === 'rearboard' || (el.cabinetId && !idSet.has(el.cabinetId))) return;
          const hw = el.dimensions.width / 2;
          const hd = el.dimensions.depth / 2;
          minDx = Math.max(minDx, -bw / 2 + hw - el.position.x);
          maxDx = Math.min(maxDx, bw / 2 - hw - el.position.x);
          minDz = Math.max(minDz, -bd / 2 + hd - el.position.z);
          maxDz = Math.min(maxDz, bd / 2 - hd - el.position.z);
        });
        const cdx = Math.max(minDx, Math.min(maxDx, dx));
        const cdz = Math.max(minDz, Math.min(maxDz, dz));
        // First pass: move top-level selected elements
        let updated = prev.map((el) => {
          if (!idSet.has(el.id)) return el;
          if (el.type === 'front' || el.type === 'hdf' || el.type === 'rearboard' || (el.cabinetId && !idSet.has(el.cabinetId))) return el;
          return { ...el, position: { ...el.position, x: el.position.x + cdx, z: el.position.z + cdz } };
        });
        // Second pass: recompute children of moved cabinets
        updated = updated.map((el) => {
          if (!el.cabinetId) return el;
          const parent = updated.find((e) => e.id === el.cabinetId);
          if (!parent || !idSet.has(parent.id)) return el;
          if (el.type === 'front') return computeFrontForCabinet(el, parent);
          if (el.type === 'hdf') return computeHdfForCabinet(el, parent);
          if (el.type === 'rearboard') return computeRearboardForCabinet(el, parent);
          if (el.type === 'leg') return computeLegsForCabinet(el, parent);
          if (el.type === 'plinth') return computePlinthForCabinet(el, parent, updated);
          if (el.type === 'maskowanica') return computeMaskowanicaForCabinet(el, parent, updated);
          return { ...el, position: { ...el.position, x: el.position.x + cdx, z: el.position.z + cdz } };
        });
        return recomputeGroups(updated);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDragStart = useCallback((id: string) => {
    snapshotHistory();
    dragDeltaRef.current.set(id, { dx: 0, dz: 0 });
  }, [snapshotHistory, dragDeltaRef]);

  return {
    handleDimensionDrag,
    handleDimensionInput,
    handlePositionChange,
    handleMultiPositionChange,
    handleYChange,
    handleDividerXChange,
    handleYMove,
    handleDragStart,
  };
}

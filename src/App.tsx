import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { BoxElement, BoxDimensions } from './types';
import { PANEL_T, DETACH_DIST, HYSTERESIS_DIST } from './constants';
import {
  computeHdfForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computeFrontForCabinet,
  computeFrontForGroup,
  recomputeGroups,
} from './computeElements';
import {
  computeYForBox,
  recomputeAllY,
  fitShelfDepthToCabinet,
  fitCabinetToBelow,
  computeDividerBounds,
} from './geometry';
import {
  findNearCabinetHysteresis,
  attachAndFit,
  snapShelfEdgeToCabinet,
  snapToNeighbors,
  pushOutCollisions,
} from './snapAttach';
import {
  createBox,
  createShelf,
  shelfCounter,
  dividerCounter,
  frontCounter,
  rodCounter,
  legCounter,
  hdfCounter,
  drawerCounter,
  drawerboxCounter,
  blendaCounter,
  plinthCounter,
  groupCounter,
} from './factories';
import { useThreeScene } from './useThreeScene';
import ElementLibrary from './ElementLibrary';
import PropertiesPanel from './PropertiesPanel';
import ModelOverlay from './ModelOverlay';
import './App.css';

// Mutable counters — imported as values, so we use local copies that track increments
let _shelfCounter = shelfCounter;
let _dividerCounter = dividerCounter;
let _frontCounter = frontCounter;
let _rodCounter = rodCounter;
let _legCounter = legCounter;
let _hdfCounter = hdfCounter;
let _drawerCounter = drawerCounter;
let _drawerboxCounter = drawerboxCounter;
let _blendaCounter = blendaCounter;
let _plinthCounter = plinthCounter;
let _groupCounter = groupCounter;

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
          }

          const newVal = Math.max(0.1, Math.min(maxAllowed, oldVal + delta));
          const actualDelta = newVal - oldVal;
          const newPosVal = el.position[pa] + actualDelta / 2 * dir;
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
      setElements((prev) => {
        const movedEl = prev.find((e) => e.id === id)!;
        const afterMove = prev.map((el) =>
          el.id === id
            ? { ...el, position: { ...el.position, x: el.position.x + dx, z: el.position.z + dz } }
            : el
        );
        const movedAfter = afterMove.find((e) => e.id === id)!;

        // Fronts, HDF and cabinet-bound rods/legs are always locked in XZ
        if (movedEl.type === 'front' || movedEl.type === 'hdf' || (movedEl.type === 'rod' && movedEl.cabinetId) || (movedEl.type === 'leg' && movedEl.cabinetId) || (movedEl.type === 'plinth' && movedEl.cabinetId)) return prev;

        if (movedEl.type === 'shelf' || movedEl.type === 'divider') {
          if (movedEl.cabinetId) {
            const d = dragDeltaRef.current.get(id) ?? { dx: 0, dz: 0 };
            const nd = { dx: d.dx + dx, dz: d.dz + dz };
            dragDeltaRef.current.set(id, nd);

            if (movedEl.type === 'divider') {
              const zDisp = Math.abs(nd.dz);
              if (zDisp < DETACH_DIST) {
                const cab = prev.find((e) => e.id === movedEl.cabinetId)!;
                const halfInner = (cab.dimensions.width - 2 * PANEL_T) / 2 - PANEL_T / 2;
                const newX = Math.max(cab.position.x - halfInner, Math.min(cab.position.x + halfInner, movedEl.position.x + dx));
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
            const clampedPos = clampToBoard(fittedShelf);
            return afterMove.map((el) => el.id === id ? { ...fittedShelf, position: { ...fittedShelf.position, x: clampedPos.x, z: clampedPos.z } } : el);
          }
          return afterMove;
        }
        // Cabinet movement
        const prelim = afterMove.find((e) => e.id === id)!;
        const roomH = boardSizeRef.current.height / 1000;
        const prelimY = computeYForBox(prelim, afterMove, roomH);
        const prelimWithY = { ...prelim, position: { ...prelim.position, y: prelimY } };
        const withPrelimY = afterMove.map((el) => (el.id === id ? prelimWithY : el));
        const snapped = snapToNeighbors(prelimWithY, withPrelimY);
        const afterSnap = withPrelimY.map((el) =>
          el.id === id ? { ...el, position: { x: snapped.x, y: 0, z: snapped.z } } : el
        );
        const finalBox = afterSnap.find((e) => e.id === id)!;
        const finalY = computeYForBox(finalBox, afterSnap, roomH);
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
              if (el.type === 'leg') return computeLegsForCabinet(el, fitted);
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
        name: `Półka ${_shelfCounter++}`,
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
        name: `Szuflada ${_drawerCounter++}`,
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
        name: `Box szuflady ${_drawerboxCounter++}`,
        type: 'drawerbox',
        cabinetId,
        dimensions: { width: boxWidth, height: 0.4, depth },
        position: {
          x: boxX,
          y: cab.position.y + PANEL_T,
          z: cab.position.z - 0.02,
        },
        color: cab.color,
      };

      const blendas: BoxElement[] = [];
      const blendaZ = cab.position.z - 0.02 + depth / 2 - 0.10;
      if (isSingle || isDouble) {
        blendas.push({
          id: crypto.randomUUID(),
          name: `Blenda ${_blendaCounter++}`,
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
          name: `Blenda ${_blendaCounter++}`,
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
      const midX = cab.position.x;
      const bounds = computeDividerBounds(cabinetId, cab.position.y + cab.dimensions.height / 2, prev);
      const divider: BoxElement = {
        id: crypto.randomUUID(),
        name: `Przegroda ${_dividerCounter++}`,
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
      if (prev.some((e) => e.type === 'front' && e.cabinetId === cabinetId)) return prev;
      const front: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front ${_frontCounter++}`,
        type: 'front',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
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
          name: `Blenda ${_blendaCounter++}`,
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
      if (prev.some((e) => e.type === 'front' && e.cabinetId === cabinetId)) return prev;
      const leftLeaf: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front L${_frontCounter}`,
        type: 'front',
        frontSide: 'left',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      const rightLeaf: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front R${_frontCounter++}`,
        type: 'front',
        frontSide: 'right',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
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
            name: `Blenda ${_blendaCounter++}`,
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
            name: `Blenda ${_blendaCounter++}`,
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
      const h = 0.1;
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
          name: `Nóżki ${_legCounter++}`,
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
        name: `HDF ${_hdfCounter++}`,
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
        name: `Cokoł ${_plinthCounter++}`,
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
        name: `Drążek ${_rodCounter++}`,
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
          for (const e of prev) {
            if (e.type === 'front' && e.cabinetId === id) toRemove.add(e.id);
          }
          for (const e of prev) {
            if (e.groupId === id) {
              toRemove.add(e.id);
              for (const child of prev) {
                if (child.cabinetId === e.id) toRemove.add(child.id);
              }
            }
          }
        } else {
          const collectDescendants = (parentId: string) => {
            for (const e of prev) {
              if (e.cabinetId === parentId && !toRemove.has(e.id)) {
                toRemove.add(e.id);
                collectDescendants(e.id);
              }
            }
          };
          collectDescendants(id);
          if (el?.type === 'front' && el.cabinetId) {
            for (const e of prev) {
              if (e.type === 'blenda' && e.cabinetId === el.cabinetId) toRemove.add(e.id);
            }
          }
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
      const validIds = ids.filter((id) => {
        const el = prev.find((e) => e.id === id);
        return el?.type === 'cabinet' && !el.groupId;
      });
      if (validIds.length < 2) return prev;
      const groupId = crypto.randomUUID();
      const groupEl: BoxElement = {
        id: groupId,
        name: `Grupa ${_groupCounter++}`,
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
        name: `Front gr. ${_frontCounter++}`,
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

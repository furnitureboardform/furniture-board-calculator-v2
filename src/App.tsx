import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { BoxElement, BoxDimensions } from './types';
import { useThreeScene } from './useThreeScene';
import ElementLibrary from './ElementLibrary';
import PropertiesPanel from './PropertiesPanel';
import './App.css';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
let colorIndex = 0;
let boxCounter = 1;
let shelfCounter = 1;
let dividerCounter = 1;

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
function computeYForBox(box: BoxElement, allElements: BoxElement[]): number {
  let maxTop = 0;
  for (const other of allElements) {
    if (other.id === box.id) continue;
    if (other.type === 'shelf' || other.type === 'divider') continue;
    if (getBoxStackOverlap(box, other)) {
      maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
    }
  }
  return maxTop;
}

// Recomputes Y for all boxes bottom-up (used after dimension changes)
function recomputeAllY(elements: BoxElement[]): BoxElement[] {
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
    if (box.type === 'shelf' || box.type === 'divider') continue; // preserve their Y
    const elOriginalY = originalY.get(el.id) ?? 0;
    let maxTop = 0;
    for (const [id, other] of resultMap) {
      if (id === box.id) continue;
      if (other.type === 'shelf' || other.type === 'divider') continue;
      // Only stack on boxes that were originally below (or at same level as) this box
      if ((originalY.get(id) ?? 0) <= elOriginalY + 0.001) {
        if (getBoxStackOverlap(box, other)) {
          maxTop = Math.max(maxTop, other.position.y + other.dimensions.height);
        }
      }
    }
    const withY = { ...box, position: { ...box.position, y: maxTop } };
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
  return elements.map((el) => resultMap.get(el.id)!);
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

// Returns the Y bottom and height for a divider based on shelves above/below in the same cabinet
function computeDividerBounds(
  cabinetId: string,
  dividerY: number, // current vertical center hint (used to find nearest shelf)
  allElements: BoxElement[]
): { y: number; height: number } {
  const cab = allElements.find((e) => e.id === cabinetId);
  if (!cab) return { y: 0, height: PANEL_T };

  const cabBottom = cab.position.y;
  const cabTop = cab.position.y + cab.dimensions.height;

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

// Snap tolerance for side-by-side wall snap (5 cm)
const SNAP_DIST = 0.05;
const PANEL_T = 0.018; // must match useThreeScene.ts

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

function createBox(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return {
    id: crypto.randomUUID(),
    name: `Box ${boxCounter++}`,
    type: 'cabinet',
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: (Math.random() - 0.5) * 4, y: 0, z: (Math.random() - 0.5) * 4 },
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
  // Tracks accumulated drag Y for dividers so tiny increments build up across frames
  const dividerYHintRef = useRef<Map<string, number>>(new Map());

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
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
          const newVal = Math.max(0.1, oldVal + delta);
          const actualDelta = newVal - oldVal;
          const pa = posAxis[axis];
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
        return recomputeAllY(updated);
      });
    },
    []
  );

  const handleDimensionInput = useCallback(
    (id: string, dims: BoxDimensions) => {
      setElements((prev) => {
        const updated = prev.map((el) => (el.id === id ? { ...el, dimensions: dims } : el));
        return recomputeAllY(updated);
      });
    },
    []
  );

  const handlePositionChange = useCallback(
    (id: string, dx: number, dz: number) => {
      setElements((prev) => {
        const movedEl = prev.find((e) => e.id === id)!;
        // 1. Apply movement delta
        const afterMove = prev.map((el) =>
          el.id === id
            ? { ...el, position: { ...el.position, x: el.position.x + dx, z: el.position.z + dz } }
            : el
        );
        if (movedEl.type === 'divider' && movedEl.cabinetId) {
          // Divider: move only on X axis, clamp inside cabinet inner walls
          const cab = prev.find((e) => e.id === movedEl.cabinetId);
          if (!cab) return prev;
          const halfInner = (cab.dimensions.width - 2 * PANEL_T) / 2 - PANEL_T / 2;
          const newX = Math.max(cab.position.x - halfInner, Math.min(cab.position.x + halfInner, movedEl.position.x + dx));
          const moved = { ...movedEl, position: { ...movedEl.position, x: newX } };
          // Recompute height based on shelves above/below
          const intermediate = prev.map((e) => (e.id === id ? moved : e));
          const bounds = computeDividerBounds(movedEl.cabinetId, moved.position.y + moved.dimensions.height / 2, intermediate);
          return prev.map((e) => e.id === id ? { ...moved, position: { ...moved.position, y: bounds.y }, dimensions: { ...moved.dimensions, height: bounds.height } } : e);
        }

        if (movedEl.type === 'shelf') {
          // Shelf bound to a cabinet: block XZ movement entirely
          if (movedEl.cabinetId) return prev;
          // Free shelf: snap XZ but keep their set Y
          const prelim = afterMove.find((e) => e.id === id)!;;
          const snapped = snapToNeighbors(prelim, afterMove);
          const shelfWithXZ = { ...prelim, position: { ...prelim.position, x: snapped.x, z: snapped.z } };
          // Auto-fit depth to the cabinet the shelf is inside of
          const fittedShelf = fitShelfDepthToCabinet(shelfWithXZ, afterMove);
          return afterMove.map((el) =>
            el.id === id ? fittedShelf : el
          );
        }
        // 2. Compute preliminary Y so snap can check Y overlap correctly
        const prelim = afterMove.find((e) => e.id === id)!;
        const prelimY = computeYForBox(prelim, afterMove);
        const prelimWithY = { ...prelim, position: { ...prelim.position, y: prelimY } };
        const withPrelimY = afterMove.map((el) => (el.id === id ? prelimWithY : el));
        // 3. Snap XZ to neighboring walls
        const snapped = snapToNeighbors(prelimWithY, withPrelimY);
        // 4. Apply snapped XZ and recompute Y
        const afterSnap = withPrelimY.map((el) =>
          el.id === id ? { ...el, position: { x: snapped.x, y: 0, z: snapped.z } } : el
        );
        const finalBox = afterSnap.find((e) => e.id === id)!;
        const finalY = computeYForBox(finalBox, afterSnap);
        const withFinalY = afterSnap.map((el) =>
          el.id === id ? { ...el, position: { ...el.position, y: finalY } } : el
        );
        // If placed on top of another cabinet, match its width/depth
        if (finalY > 0) {
          const movedFinal = withFinalY.find((e) => e.id === id)!;
          const fitted = fitCabinetToBelow(movedFinal, withFinalY);
          if (fitted !== movedFinal) {
            return withFinalY.map((el) => (el.id === id ? fitted : el));
          }
        }
        return withFinalY;
      });
    },
    []
  );

  const handleYChange = useCallback(
    (id: string, y: number) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id)!;
        let newY = Math.max(0, y);
        if (el.cabinetId) {
          const cab = prev.find((e) => e.id === el.cabinetId);
          if (cab) {
            const maxY = cab.position.y + cab.dimensions.height - el.dimensions.height;
            newY = Math.min(Math.max(cab.position.y, newY), maxY);
          }
        }
        return prev.map((e) => (e.id === id ? { ...e, position: { ...e.position, y: newY } } : e));
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
          const newHint = Math.max(cab.position.y, Math.min(cab.position.y + cab.dimensions.height, currentHint + dy));
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
            const maxY = cab.position.y + cab.dimensions.height - el.dimensions.height;
            newY = Math.min(Math.max(cab.position.y, newY), maxY);
          }
        }
        return prev.map((e) => (e.id === id ? { ...e, position: { ...e.position, y: newY } } : e));
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

  const handleAdd = useCallback((type: 'cabinet' | 'shelf') => {
    const el = type === 'shelf' ? createShelf() : createBox();
    setElements((prev) => {
      if (type === 'shelf') return [...prev, el];
      const newY = computeYForBox(el, prev);
      return [...prev, { ...el, position: { ...el.position, y: newY } }];
    });
    setSelectedId(el.id);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      dividerYHintRef.current.delete(id);
      setElements((prev) => {
        const toRemove = new Set<string>([id]);
        // Also remove all children (shelves/dividers) belonging to this cabinet
        for (const el of prev) {
          if (el.cabinetId === id) toRemove.add(el.id);
        }
        toRemove.forEach((rid) => dividerYHintRef.current.delete(rid));
        return prev.filter((el) => !toRemove.has(el.id));
      });
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    []
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      setSelectedId((prev) => {
        if (prev) handleDelete(prev);
        return null;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDelete]);

  useThreeScene(containerRef, {
    elements,
    selectedId,
    onSelect: handleSelect,
    onDimensionChange: handleDimensionDrag,
    onPositionChange: handlePositionChange,
    onYMove: handleYMove,
  });

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="app">
      <aside className="sidebar left">
        <ElementLibrary
          elements={elements}
          selectedId={selectedId}
          onSelect={handleSelect}
          onAdd={handleAdd}
          onAddShelfToCabinet={handleAddShelfToCabinet}
          onAddDividerToCabinet={handleAddDividerToCabinet}
          onDelete={handleDelete}
        />
      </aside>

      <main className="viewport" ref={containerRef} />

      <aside className="sidebar right">
        <PropertiesPanel element={selectedElement} onChange={handleDimensionInput} onYChange={handleYChange} />
      </aside>
    </div>
  );
};

export default App;

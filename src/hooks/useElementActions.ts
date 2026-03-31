import { useCallback } from 'react';
import type React from 'react';
import type { BoxElement } from '../types';
import { PANEL_T, DRAWER_RAIL_CLEARANCE, FRONT_INSET } from '../constants';
import {
  computeHdfForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computeBlendaForCabinet,
  computeFrontForCabinet,
  computeFrontForGroup,
  computeMaskowanicaForCabinet,
  computeMaskowanicaForGroup,
  recomputeGroups,
} from '../computeElements';
import { computeDividerBounds, computeYForBox, switchShelfToNextBay } from '../geometry';
import { createBox, createShelf, createBoard, createBoxKuchenny } from '../factories';
import { counters } from '../elementCounters';

interface Params {
  setElements: React.Dispatch<React.SetStateAction<BoxElement[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setMultiSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  boardSizeRef: React.MutableRefObject<{ width: number; depth: number; height: number }>;
  dividerYHintRef: React.MutableRefObject<Map<string, number>>;
  dragDeltaRef: React.MutableRefObject<Map<string, { dx: number; dz: number }>>;
  detachedFromRef: React.MutableRefObject<Map<string, string>>;
}

export function useElementActions({
  setElements,
  setSelectedId,
  setMultiSelectedIds,
  boardSizeRef,
  dividerYHintRef,
  dragDeltaRef,
  detachedFromRef,
}: Params) {
  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    setMultiSelectedIds([]);
  }, [setSelectedId, setMultiSelectedIds]);

  const handleMultiSelectToggle = useCallback((id: string) => {
    setMultiSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, [setMultiSelectedIds]);

  const handleAddShelfToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
      const shelf: BoxElement = {
        id: crypto.randomUUID(),
        name: `Półka ${counters.shelf++}`,
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
  }, [setElements, setSelectedId]);

  const handleAddDrawerToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * DRAWER_RAIL_CLEARANCE);
      const isDrawerbox = cab.type === 'drawerbox';
      const faceW = isDrawerbox
        ? Math.max(0.01, cab.dimensions.width - 2 * FRONT_INSET)
        : Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * FRONT_INSET);
      const depth = isDrawerbox
        ? cab.dimensions.depth
        : Math.max(0.01, cab.dimensions.depth - PANEL_T - 0.01);
      const posZ = isDrawerbox
        ? cab.position.z
        : cab.position.z - PANEL_T / 2 + 0.005;
      const drawer: BoxElement = {
        id: crypto.randomUUID(),
        name: `Szuflada ${counters.drawer++}`,
        type: 'drawer',
        cabinetId,
        parentIsDrawerbox: isDrawerbox,
        adjustedFrontWidth: faceW,
        dimensions: { width: innerWidth, height: 0.145, depth },
        position: {
          x: cab.position.x,
          z: posZ,
          y: cab.position.y + cab.dimensions.height / 2,
        },
        color: cab.color,
      };
      setSelectedId(cabinetId);
      return [...prev, drawer];
    });
  }, [setElements, setSelectedId]);

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
        name: `Box szuflady ${counters.drawerbox++}`,
        type: 'drawerbox',
        cabinetId,
        hasSidePanels: isSingle || isDouble,
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
          name: `Blenda ${counters.blenda++}`,
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
          name: `Blenda ${counters.blenda++}`,
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
  }, [setElements, setSelectedId]);

  const handleAddDividerToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const midX = cab.position.x;
      const bounds = computeDividerBounds(cabinetId, cab.position.y + cab.dimensions.height / 2, prev);
      const divider: BoxElement = {
        id: crypto.randomUUID(),
        name: `Przegroda ${counters.divider++}`,
        type: 'divider',
        cabinetId,
        dimensions: { width: PANEL_T, height: bounds.height, depth: cab.dimensions.depth },
        position: { x: midX, z: cab.position.z, y: bounds.y },
        color: cab.color,
      };
      setSelectedId(cabinetId);
      return [...prev, divider];
    });
  }, [setElements, setSelectedId]);

  const handleAddFrontToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'front' && e.cabinetId === cabinetId)) return prev;
      const front: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front ${counters.front++}`,
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
          name: `Blenda ${counters.blenda++}`,
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
  }, [setElements, setSelectedId]);

  const handleAddDoubleFrontToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'front' && e.cabinetId === cabinetId)) return prev;
      const leftLeaf: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front lewy ${counters.front}`,
        type: 'front',
        frontSide: 'left',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      const rightLeaf: BoxElement = computeFrontForCabinet({
        id: crypto.randomUUID(),
        name: `Front prawy ${counters.front++}`,
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
            name: `Blenda ${counters.blenda++}`,
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
            name: `Blenda ${counters.blenda++}`,
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
  }, [setElements, setSelectedId]);

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
          name: `Nóżki ${counters.leg++}`,
          type: 'leg',
          cabinetId,
          dimensions: { width: 0, height: h, depth: 0 },
          position: { x: 0, y: 0, z: 0 },
          color: cab.color,
        },
        liftedCab
      );
      const withLeg = [...updatedPrev, legsEl];
      setSelectedId(cabinetId);
      return withLeg.map((e) =>
        e.type === 'maskowanica' && e.cabinetId === cabinetId
          ? computeMaskowanicaForCabinet(e, liftedCab, withLeg)
          : e
      );
    });
  }, [setElements, setSelectedId]);

  const handleAddLegsToBoxKuchenny = useCallback((boxId: string) => {
    setElements((prev) => {
      const box = prev.find((e) => e.id === boxId);
      if (!box) return prev;
      if (prev.some((e) => e.type === 'leg' && e.cabinetId === boxId)) return prev;
      const h = 0.1;
      const lifted = { ...box, position: { ...box.position, y: box.position.y + h } };
      const updatedPrev = prev.map((e) => e.id === boxId ? lifted : e);
      const legsEl = computeLegsForCabinet(
        {
          id: crypto.randomUUID(),
          name: `Nóżki ${counters.leg++}`,
          type: 'leg',
          cabinetId: boxId,
          dimensions: { width: 0, height: h, depth: 0 },
          position: { x: 0, y: 0, z: 0 },
          color: box.color,
        },
        lifted
      );
      setSelectedId(boxId);
      return [...updatedPrev, legsEl];
    });
  }, [setElements, setSelectedId]);

  const handleAddHdfToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'hdf' && e.cabinetId === cabinetId)) return prev;
      const hdf: BoxElement = computeHdfForCabinet({
        id: crypto.randomUUID(),
        name: `HDF ${counters.hdf++}`,
        type: 'hdf',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
      return [...prev, hdf];
    });
  }, [setElements, setSelectedId]);

  const handleAddPlinthToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'plinth' && e.cabinetId === cabinetId)) return prev;
      const plinth: BoxElement = computePlinthForCabinet({
        id: crypto.randomUUID(),
        name: `Cokoł ${counters.plinth++}`,
        type: 'plinth',
        cabinetId,
        dimensions: { width: 0, height: 0.1, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab, prev);
      setSelectedId(cabinetId);
      const withPlinth = [...prev, plinth];
      return withPlinth.map((e) =>
        e.type === 'blenda' && e.cabinetId === cabinetId &&
        (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'cabinet'
          ? computeBlendaForCabinet(e, cab, withPlinth)
          : e
      );
    });
  }, [setElements, setSelectedId]);

  const handleAddBlendaToCabinet = useCallback((cabinetId: string, side: 'left' | 'right' | 'top') => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'blenda' && e.cabinetId === cabinetId && e.blendaSide === side && e.blendaScope === 'cabinet')) return prev;
      const label = side === 'left' ? 'lewa' : side === 'right' ? 'prawa' : 'górna';
      const blenda: BoxElement = computeBlendaForCabinet({
        id: crypto.randomUUID(),
        name: `Blenda ${label} ${counters.blenda++}`,
        type: 'blenda',
        cabinetId,
        blendaSide: side,
        blendaScope: 'cabinet',
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab, prev);
      setSelectedId(cabinetId);
      const withBlenda = [...prev, blenda];
      if (side === 'top') {
        return withBlenda.map((e) =>
          e.type === 'blenda' && e.cabinetId === cabinetId &&
          (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'cabinet'
            ? computeBlendaForCabinet(e, cab, withBlenda)
            : e
        );
      }
      return withBlenda;
    });
  }, [setElements, setSelectedId]);

  const handleAddMaskowanicaToCabinet = useCallback((cabinetId: string, side: 'left' | 'right' | 'bottom' | 'top') => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'maskowanica' && e.cabinetId === cabinetId && e.maskownicaSide === side)) return prev;
      const name = side === 'left' ? `Maskowanica L${counters.maskowanica++}` : side === 'right' ? `Maskowanica P${counters.maskowanica++}` : side === 'bottom' ? `Maskowanica dół${counters.maskowanica++}` : `Maskowanica góra${counters.maskowanica++}`;
      const mask: BoxElement = computeMaskowanicaForCabinet({
        id: crypto.randomUUID(),
        name,
        type: 'maskowanica',
        cabinetId,
        maskownicaSide: side,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab, prev);
      setSelectedId(cabinetId);
      if (side === 'bottom' || side === 'top') {
        const withNewMask = [...prev, mask];
        return withNewMask.map((e) =>
          e.type === 'maskowanica' && e.cabinetId === cabinetId &&
          (e.maskownicaSide === 'left' || e.maskownicaSide === 'right')
            ? computeMaskowanicaForCabinet(e, cab, withNewMask)
            : e
        );
      }
      const bw = boardSizeRef.current.width / 1000;
      const maskLeft = mask.position.x - mask.dimensions.width / 2;
      const maskRight = mask.position.x + mask.dimensions.width / 2;
      let shift = 0;
      if (maskLeft < -bw / 2) shift = -bw / 2 - maskLeft;
      else if (maskRight > bw / 2) shift = bw / 2 - maskRight;
      const shiftedCab = shift !== 0 ? { ...cab, position: { ...cab.position, x: cab.position.x + shift } } : cab;
      const shiftedMask = shift !== 0 ? computeMaskowanicaForCabinet(mask, shiftedCab, prev) : mask;
      if (shift !== 0) {
        return prev
          .map((e) => {
            if (e.id === cabinetId) return shiftedCab;
            if (e.cabinetId === cabinetId) return { ...e, position: { ...e.position, x: e.position.x + shift } };
            return e;
          })
          .concat(shiftedMask);
      }
      return [...prev, mask];
    });
  }, [setElements, setSelectedId, boardSizeRef]);

  const handleAddMaskowanicaToGroup = useCallback((groupId: string, side: 'left' | 'right' | 'top' | 'bottom') => {
    setElements((prev) => {
      const group = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!group) return prev;
      if (prev.some((e) => e.type === 'maskowanica' && e.cabinetId === groupId && e.maskownicaSide === side)) return prev;
      const sideLabel = side === 'left' ? 'L' : side === 'right' ? 'P' : side === 'top' ? 'G' : 'D';
      const mask: BoxElement = computeMaskowanicaForGroup({
        id: crypto.randomUUID(),
        name: `Maskowanica gr. ${sideLabel}${counters.maskowanica++}`,
        type: 'maskowanica',
        cabinetId: groupId,
        maskownicaSide: side,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      }, prev);
      if (side === 'top' || side === 'bottom') return recomputeGroups([...prev, mask]);
      const bw = boardSizeRef.current.width / 1000;
      const maskLeft = mask.position.x - mask.dimensions.width / 2;
      const maskRight = mask.position.x + mask.dimensions.width / 2;
      let shift = 0;
      if (maskLeft < -bw / 2) shift = -bw / 2 - maskLeft;
      else if (maskRight > bw / 2) shift = bw / 2 - maskRight;
      if (shift !== 0) {
        const shifted = prev.map((e) => {
          if (e.id === groupId || e.groupIds?.includes(groupId) || e.cabinetId === groupId)
            return { ...e, position: { ...e.position, x: e.position.x + shift } };
          return e;
        });
        return [...shifted, computeMaskowanicaForGroup(mask, shifted)];
      }
      return [...prev, mask];
    });
  }, [setElements, boardSizeRef]);

  const handleAddRodToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      const ROD_D = 0.025;
      const innerWidth = Math.max(0.001, cab.dimensions.width - 2 * PANEL_T);
      const rod: BoxElement = {
        id: crypto.randomUUID(),
        name: `Drążek ${counters.rod++}`,
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
  }, [setElements, setSelectedId]);

  const handleAdd = useCallback((type: 'cabinet' | 'shelf' | 'board' | 'boxkuchenny') => {
    const raw = type === 'shelf' ? createShelf() : type === 'board' ? createBoard() : type === 'boxkuchenny' ? createBoxKuchenny() : createBox();
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
      if (type === 'shelf' || type === 'board') return [...prev, el];
      const newY = computeYForBox(el, prev, boardSizeRef.current.height / 1000);
      return [...prev, { ...el, position: { ...el.position, y: newY } }];
    });
    setSelectedId(el.id);
  }, [setElements, setSelectedId, boardSizeRef]);

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
            if (e.type === 'maskowanica' && e.cabinetId === id) toRemove.add(e.id);
          }
          for (const e of prev) {
            if (e.groupIds?.includes(id) && (e.groupIds.length === 1)) {
              // only in this group — remove it and its children
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
        if (el?.type === 'group') {
          // Remove deleted group id from surviving cabinets that belonged to multiple groups
          return filtered.map((e) =>
            e.groupIds?.includes(id)
              ? { ...e, groupIds: e.groupIds.filter((gid) => gid !== id) }
              : e
          );
        }
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
        if (el?.type === 'leg' && el.cabinetId) {
          const h = el.dimensions.height;
          const cabId = el.cabinetId;
          const origCab = filtered.find((c) => c.id === cabId);
          if (origCab) {
            const loweredCab = { ...origCab, position: { ...origCab.position, y: origCab.position.y - h } };
            return filtered.map((e) => {
              if (e.id === cabId) return loweredCab;
              if (e.cabinetId === cabId) {
                const lowered = { ...e, position: { ...e.position, y: e.position.y - h } };
                if (e.type === 'front') return computeFrontForCabinet(lowered, loweredCab);
                if (e.type === 'hdf') return computeHdfForCabinet(lowered, loweredCab);
                if (e.type === 'plinth') return computePlinthForCabinet(lowered, loweredCab, filtered);
                if (e.type === 'maskowanica') return computeMaskowanicaForCabinet(e, loweredCab, filtered);
                return lowered;
              }
              return e;
            });
          }
        }
        if (
          el?.type === 'maskowanica' &&
          el.cabinetId &&
          (el.maskownicaSide === 'top' || el.maskownicaSide === 'bottom')
        ) {
          const cab = filtered.find((e) => e.id === el.cabinetId && e.type === 'cabinet');
          if (cab) {
            return filtered.map((e) =>
              e.type === 'maskowanica' && e.cabinetId === cab.id &&
              (e.maskownicaSide === 'left' || e.maskownicaSide === 'right')
                ? computeMaskowanicaForCabinet(e, cab, filtered)
                : e
            );
          }
          const group = filtered.find((e) => e.id === el.cabinetId && e.type === 'group');
          if (group) {
            return recomputeGroups(filtered);
          }
        }
        if (el?.type === 'blenda' && el.blendaSide === 'top' && el.blendaScope === 'cabinet' && el.cabinetId) {
          const cab = filtered.find((e) => e.id === el.cabinetId && e.type === 'cabinet');
          if (cab) {
            return filtered.map((e) =>
              e.type === 'blenda' && e.cabinetId === cab.id &&
              (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'cabinet'
                ? computeBlendaForCabinet(e, cab, filtered)
                : e
            );
          }
        }
        if (el?.type === 'plinth' && el.cabinetId) {
          const cab = filtered.find((e) => e.id === el.cabinetId && e.type === 'cabinet');
          if (cab) {
            return filtered.map((e) =>
              e.type === 'blenda' && e.cabinetId === cab.id &&
              (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'cabinet'
                ? computeBlendaForCabinet(e, cab, filtered)
                : e
            );
          }
        }
        return filtered;
      });
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [setElements, setSelectedId, dividerYHintRef, dragDeltaRef, detachedFromRef]
  );

  const handleUngroup = useCallback((groupId: string) => {
    setElements((prev) => {
      const toRemove = new Set<string>([groupId]);
      for (const e of prev) {
        if (e.type === 'front' && e.cabinetId === groupId) toRemove.add(e.id);
        if (e.type === 'maskowanica' && e.cabinetId === groupId) toRemove.add(e.id);
      }
      return prev
        .filter((e) => !toRemove.has(e.id))
        .map((e) => e.groupIds?.includes(groupId) ? { ...e, groupIds: e.groupIds.filter((gid) => gid !== groupId) } : e);
    });
    setSelectedId((prev) => (prev === groupId ? null : prev));
  }, [setElements, setSelectedId]);

  const handleRemoveFromGroup = useCallback((cabinetId: string, groupId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab?.groupIds?.includes(groupId)) return prev;
      const remaining = prev.filter((e) => e.groupIds?.includes(groupId) && e.id !== cabinetId);
      if (remaining.length < 2) {
        // dissolve group — same as ungroup
        const toRemove = new Set<string>([groupId]);
        for (const e of prev) {
          if (e.type === 'front' && e.cabinetId === groupId) toRemove.add(e.id);
          if (e.type === 'maskowanica' && e.cabinetId === groupId) toRemove.add(e.id);
        }
        return prev
          .filter((e) => !toRemove.has(e.id))
          .map((e) => e.groupIds?.includes(groupId) ? { ...e, groupIds: e.groupIds.filter((gid) => gid !== groupId) } : e);
      }
      const updated = prev.map((e) => e.id === cabinetId ? { ...e, groupIds: e.groupIds!.filter((gid) => gid !== groupId) } : e);
      return recomputeGroups(updated);
    });
  }, [setElements]);

  const handleGroup = useCallback((ids: string[]) => {
    setElements((prev) => {
      const validIds = ids.filter((id) => {
        const el = prev.find((e) => e.id === id);
        return el?.type === 'cabinet';
      });
      if (validIds.length < 2) return prev;
      const groupId = crypto.randomUUID();
      const groupEl: BoxElement = {
        id: groupId,
        name: `Grupa ${counters.group++}`,
        type: 'group',
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: '#888888',
      };
      const withGroupIds = prev.map((e) =>
        validIds.includes(e.id) ? { ...e, groupIds: [...(e.groupIds ?? []), groupId] } : e
      );
      const withGroup = [...withGroupIds, groupEl];
      return recomputeGroups(withGroup);
    });
    setMultiSelectedIds([]);
  }, [setElements, setMultiSelectedIds]);

  const handleAddFrontToGroup = useCallback((groupId: string) => {
    setElements((prev) => {
      const group = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!group) return prev;
      if (prev.some((e) => e.type === 'front' && e.cabinetId === groupId)) return prev;
      const front: BoxElement = computeFrontForGroup({
        id: crypto.randomUUID(),
        name: `Front gr. ${counters.front++}`,
        type: 'front',
        cabinetId: groupId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      }, prev);
      return [...prev, front];
    });
  }, [setElements]);

  const handleAddDoubleFrontToGroup = useCallback((groupId: string) => {
    setElements((prev) => {
      const group = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!group) return prev;
      if (prev.some((e) => e.type === 'front' && e.cabinetId === groupId)) return prev;
      const leftLeaf: BoxElement = computeFrontForGroup({
        id: crypto.randomUUID(),
        name: `Front gr. lewy ${counters.front}`,
        type: 'front',
        frontSide: 'left',
        cabinetId: groupId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      }, prev);
      const rightLeaf: BoxElement = computeFrontForGroup({
        id: crypto.randomUUID(),
        name: `Front gr. prawy ${counters.front++}`,
        type: 'front',
        frontSide: 'right',
        cabinetId: groupId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      }, prev);
      return [...prev, leftLeaf, rightLeaf];
    });
  }, [setElements]);

  const handleOpenFrontsChange = useCallback((cabinetId: string, open: boolean) => {
    setElements((prev) => prev.map((e) => e.id === cabinetId ? { ...e, openFronts: open } : e));
  }, [setElements]);

  const handleHasSidePanelsChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => {
      const dbox = prev.find((e) => e.id === drawerboxId);
      if (!dbox || dbox.type !== 'drawerbox' || !dbox.cabinetId) return prev;
      const cab = prev.find((e) => e.id === dbox.cabinetId);
      if (!cab) return prev;
      const fronts = prev.filter((e) => e.type === 'front' && e.cabinetId === dbox.cabinetId);
      const isSingle = fronts.length === 1;
      const isDouble = fronts.length >= 2;
      const canonicalWidth = cab.dimensions.width - 2 * PANEL_T;

      if (!has) {
        const blendaOffset = isSingle ? 0.04 : isDouble ? 0.08 : 0;
        const newBoxWidth = Math.max(0.01, dbox.dimensions.width + blendaOffset);
        const newBoxX = cab.position.x;
        const deltaX = newBoxX - dbox.position.x;
        const deltaW = newBoxWidth - dbox.dimensions.width;
        return prev
          .filter((e) => !(e.type === 'blenda' && e.cabinetId === dbox.cabinetId))
          .map((e) => {
            if (e.id === drawerboxId)
              return { ...e, dimensions: { ...e.dimensions, width: newBoxWidth }, position: { ...e.position, x: newBoxX }, hasSidePanels: false };
            if (e.cabinetId === drawerboxId)
              return { ...e, dimensions: { ...e.dimensions, width: Math.max(0.01, e.dimensions.width + deltaW) }, position: { ...e.position, x: e.position.x + deltaX } };
            return e;
          });
      } else {
        if (!isSingle && !isDouble) return prev;
        let newBoxWidth = isSingle ? Math.max(0.01, canonicalWidth - 0.04) : Math.max(0.01, canonicalWidth - 0.08);
        let newBoxX = isSingle ? cab.position.x + 0.02 : cab.position.x;
        const deltaX = newBoxX - dbox.position.x;
        const deltaW = newBoxWidth - dbox.dimensions.width;
        const blendaZ = dbox.position.z + dbox.dimensions.depth / 2 - 0.10;
        const blendas: BoxElement[] = [];
        blendas.push({
          id: crypto.randomUUID(),
          name: `Blenda ${counters.blenda++}`,
          type: 'blenda' as const,
          cabinetId: dbox.cabinetId,
          blendaSide: 'left' as const,
          dimensions: { width: 0.04, height: dbox.dimensions.height, depth: PANEL_T },
          position: { x: cab.position.x - cab.dimensions.width / 2 + PANEL_T + 0.02, y: dbox.position.y, z: blendaZ },
          color: cab.color,
        });
        if (isDouble) {
          blendas.push({
            id: crypto.randomUUID(),
            name: `Blenda ${counters.blenda++}`,
            type: 'blenda' as const,
            cabinetId: dbox.cabinetId,
            blendaSide: 'right' as const,
            dimensions: { width: 0.04, height: dbox.dimensions.height, depth: PANEL_T },
            position: { x: cab.position.x + cab.dimensions.width / 2 - PANEL_T - 0.02, y: dbox.position.y, z: blendaZ },
            color: cab.color,
          });
        }
        const mapped = prev.map((e) => {
          if (e.id === drawerboxId)
            return { ...e, dimensions: { ...e.dimensions, width: newBoxWidth }, position: { ...e.position, x: newBoxX }, hasSidePanels: true };
          if (e.cabinetId === drawerboxId)
            return { ...e, dimensions: { ...e.dimensions, width: Math.max(0.01, e.dimensions.width + deltaW) }, position: { ...e.position, x: e.position.x + deltaX } };
          return e;
        });
        return [...mapped, ...blendas];
      }
    });
  }, [setElements]);

  const handleDrawerAdjustFrontChange = useCallback((drawerId: string, adjust: boolean) => {
    setElements((prev) => {
      const drawer = prev.find((e) => e.id === drawerId);
      if (!drawer || drawer.type !== 'drawer' || !drawer.cabinetId) return prev;
      const parent = prev.find((e) => e.id === drawer.cabinetId);
      if (!parent) return prev;
      if (!adjust) {
        return prev.map((e) => e.id === drawerId ? { ...e, adjustedFrontHeight: undefined } : e);
      }
      const GAP = 0.002;
      const bottomOffset = parent.type === 'drawerbox' ? (parent.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
      const bottomBound = parent.position.y + bottomOffset;
      const innerTop = parent.position.y + parent.dimensions.height - PANEL_T;
      const newPositionY = bottomBound + GAP;
      const siblingsAbove = prev.filter(
        (e) =>
          e.cabinetId === parent.id &&
          e.id !== drawerId &&
          e.position.y > newPositionY &&
          (e.type === 'shelf' || e.type === 'drawer' || e.type === 'drawerbox')
      );
      const nearestObstacle = siblingsAbove.length > 0
        ? Math.min(...siblingsAbove.map((e) => e.position.y))
        : Infinity;
      const topBound = Math.min(innerTop, nearestObstacle);
      const faceH = Math.max(0.001, topBound - GAP - newPositionY);
      return prev.map((e) => e.id === drawerId
        ? { ...e, adjustedFrontHeight: faceH, position: { ...e.position, y: newPositionY } }
        : e
      );
    });
  }, [setElements]);

  const handleDrawerFrontHeightChange = useCallback((drawerId: string, faceH: number) => {
    setElements((prev) => prev.map((e) => e.id === drawerId ? { ...e, frontHeight: faceH } : e));
  }, [setElements]);

  const handleDrawerPushToOpenChange = useCallback((drawerId: string, value: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerId ? { ...e, pushToOpen: value } : e));
  }, [setElements]);

  const handleHasTopRailsChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasTopRails: has } : e));
  }, [setElements]);

  const handleHasRearHdfChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasRearHdf: has } : e));
  }, [setElements]);

  const handleHasBottomPanelChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasBottomPanel: has } : e));
  }, [setElements]);

  const handleMaskownicaNiepelnaChange = useCallback((maskId: string, value: boolean) => {
    setElements((prev) => {
      const updated = prev.map((e) => e.id === maskId ? { ...e, niepelna: value } : e);
      return updated.map((e) => {
        if (e.id !== maskId || e.type !== 'maskowanica' || !e.cabinetId) return e;
        const parent = updated.find((p) => p.id === e.cabinetId);
        if (!parent) return e;
        if (parent.type === 'cabinet') return computeMaskowanicaForCabinet(e, parent, updated);
        if (parent.type === 'group') return computeMaskowanicaForGroup(e, updated);
        return e;
      });
    });
  }, [setElements]);

  const handleShelfSwitchBay = useCallback((shelfId: string) => {
    setElements((prev) => {
      const shelf = prev.find((e) => e.id === shelfId);
      if (!shelf || (shelf.type !== 'shelf' && shelf.type !== 'rod')) return prev;
      const switched = switchShelfToNextBay(shelf, prev);
      return prev.map((e) => (e.id === shelfId ? switched : e));
    });
  }, [setElements]);

  const handleClearAll = useCallback(() => {
    dividerYHintRef.current.clear();
    dragDeltaRef.current.clear();
    detachedFromRef.current.clear();
    setElements([]);
    setSelectedId(null);
    setMultiSelectedIds([]);
  }, [setElements, setSelectedId, setMultiSelectedIds, dividerYHintRef, dragDeltaRef, detachedFromRef]);

  return {
    handleSelect,
    handleMultiSelectToggle,
    handleAddShelfToCabinet,
    handleAddDrawerToCabinet,
    handleAddDrawerboxToCabinet,
    handleAddDividerToCabinet,
    handleAddFrontToCabinet,
    handleAddDoubleFrontToCabinet,
    handleAddLegsToCabinet,
    handleAddLegsToBoxKuchenny,
    handleAddHdfToCabinet,
    handleAddPlinthToCabinet,
    handleAddBlendaToCabinet,
    handleAddMaskowanicaToCabinet,
    handleAddMaskowanicaToGroup,
    handleAddRodToCabinet,
    handleAdd,
    handleDelete,
    handleUngroup,
    handleRemoveFromGroup,
    handleGroup,
    handleAddFrontToGroup,
    handleAddDoubleFrontToGroup,
    handleOpenFrontsChange,
    handleHasBottomPanelChange,
    handleHasRearHdfChange,
    handleHasTopRailsChange,
    handleHasSidePanelsChange,
    handleDrawerAdjustFrontChange,
    handleDrawerFrontHeightChange,
    handleDrawerPushToOpenChange,
    handleMaskownicaNiepelnaChange,
    handleShelfSwitchBay,
    handleClearAll,
  };
}

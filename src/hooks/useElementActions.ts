import { useCallback } from 'react';
import type React from 'react';
import type { BoxElement, DrawerSystemOption, CargoOption } from '../types';
import { DRAWER_SYSTEM_FRONT_EXTRA } from '../types';
import { PANEL_T, DRAWER_RAIL_CLEARANCE, FRONT_INSET, DEFAULT_COUNTERTOP_THICKNESS_MM } from '../constants';
import { HDF_GRAY } from '../builders';
import {
  computeHdfForCabinet,
  computeRearboardForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computePlinthsForGroup,
  computeBlendaForCabinet,
  computeBlendaForGroup,
  computeBlendaTopForGroup,
  computeFrontForCabinet,
  computeFrontForGroup,
  computeMaskowanicaForCabinet,
  computeMaskowanicaForGroup,
  computeMaskowanicasHorizForGroup,
  recomputeHorizMaskGeometry,
  recomputeGroups,
  computeCountertopForCabinet,
  computeCountertopForGroup,
} from '../computeElements';
import { computeDividerBounds, computeYForBox, fitDrawerToBay, switchShelfToNextBay, switchDrawerToNextBay, switchDividerToNextSlot, DRAWER_FACE_H_DEFAULT, DRAWER_EXT_FRONT_H } from '../geometry';
import { createBox, createBoxKuchenny, createShelf, createBoard, createSzafkaDolna } from '../factories';
import { counters } from '../elementCounters';

interface Params {
  setElements: React.Dispatch<React.SetStateAction<BoxElement[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setMultiSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  boardSizeRef: React.MutableRefObject<{ width: number; depth: number; height: number }>;
  dividerYHintRef: React.MutableRefObject<Map<string, number>>;
  dragDeltaRef: React.MutableRefObject<Map<string, { dx: number; dz: number }>>;
  detachedFromRef: React.MutableRefObject<Map<string, string>>;
  finishColorMap: Map<string, string>;
  defaultHdfFinishId: string | undefined;
  drawerSystems: DrawerSystemOption[];
}

export function useElementActions({
  setElements,
  setSelectedId,
  setMultiSelectedIds,
  boardSizeRef,
  dividerYHintRef,
  dragDeltaRef,
  detachedFromRef,
  finishColorMap,
  defaultHdfFinishId,
  drawerSystems,
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
        finishId: cab.finishId,
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
      const bottomOffset = isDrawerbox ? (cab.hasBottomPanel ? PANEL_T : 0) : PANEL_T;
      const innerBottom = cab.position.y + bottomOffset;
      const innerTop = cab.position.y + cab.dimensions.height - PANEL_T;
      const existingDrawers = prev.filter((e) => e.cabinetId === cabinetId && e.type === 'drawer');
      const maxTopEdge = existingDrawers.reduce((max, e) =>
        Math.max(max, e.position.y + (e.adjustedFrontHeight ?? e.frontHeight ?? DRAWER_FACE_H_DEFAULT))
      , -Infinity);
      const placementY = existingDrawers.length > 0
        ? Math.min(maxTopEdge, innerTop - DRAWER_FACE_H_DEFAULT)
        : innerBottom;
      const drawer: BoxElement = {
        id: crypto.randomUUID(),
        name: `Szuflada ${counters.drawer++}`,
        type: 'drawer',
        cabinetId,
        parentIsDrawerbox: isDrawerbox,
        externalFront: false,
        adjustedFrontWidth: faceW,
        dimensions: { width: innerWidth, height: 0.145, depth },
        position: {
          x: cab.position.x,
          z: posZ,
          y: placementY,
        },
        color: cab.color,
        finishId: cab.finishId,
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
        finishId: cab.finishId,
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
          finishId: cab.finishId,
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
          finishId: cab.finishId,
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
        finishId: cab.finishId,
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
        if (e.type === 'rearboard') return computeRearboardForCabinet(e, liftedCab);
        if (e.type === 'plinth') return computePlinthForCabinet(e, liftedCab, prev);
        if (e.type === 'countertop') return computeCountertopForCabinet(e, liftedCab);
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
      return withLeg.map((e) => {
        if (e.type === 'maskowanica' && e.cabinetId === cabinetId)
          return computeMaskowanicaForCabinet(e, liftedCab, withLeg);
        if (e.type === 'maskowanica' && liftedCab.groupIds?.includes(e.cabinetId!))
          return computeMaskowanicaForGroup(e, withLeg);
        return e;
      });
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
        color: defaultHdfFinishId ? (finishColorMap.get(defaultHdfFinishId) ?? HDF_GRAY) : HDF_GRAY,
        finishId: defaultHdfFinishId,
      }, cab);
      setSelectedId(cabinetId);
      return [...prev, hdf];
    });
  }, [setElements, setSelectedId, defaultHdfFinishId, finishColorMap]);

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
      const withCabBlends = withPlinth.map((e) =>
        e.type === 'blenda' && e.cabinetId === cabinetId &&
        (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'cabinet'
          ? computeBlendaForCabinet(e, cab, withPlinth)
          : e
      );
      const cabGroupIds = cab.groupIds ?? [];
      if (cabGroupIds.length === 0) return withCabBlends;
      return withCabBlends.map((e) => {
        if (e.type === 'blenda' && e.blendaScope === 'group' && e.cabinetId && cabGroupIds.includes(e.cabinetId) && (e.blendaSide === 'left' || e.blendaSide === 'right')) {
          const group = withCabBlends.find((g) => g.id === e.cabinetId && g.type === 'group');
          if (group) return computeBlendaForGroup(e, group, withCabBlends);
        }
        return e;
      });
    });
  }, [setElements, setSelectedId]);

  const handleAddPlinthToGroup = useCallback((groupId: string) => {
    setElements((prev) => {
      const group = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!group) return prev;
      if (prev.some((e) => e.type === 'plinth' && e.cabinetId === groupId)) return prev;
      const template: BoxElement = {
        id: crypto.randomUUID(),
        name: `Cokoł gr. ${counters.plinth++}`,
        type: 'plinth',
        cabinetId: groupId,
        dimensions: { width: 0, height: 0.1, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      };
      const plinths = computePlinthsForGroup(template, group, prev);
      setSelectedId(groupId);
      const withPlinth = [...prev, ...plinths];
      return withPlinth.map((e) => {
        if (e.type === 'blenda' && e.blendaScope === 'group' && e.cabinetId === groupId &&
            (e.blendaSide === 'left' || e.blendaSide === 'right')) {
          return computeBlendaForGroup(e, group, withPlinth);
        }
        return e;
      });
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

  const handleAddBlendaToGroup = useCallback((groupId: string, side: 'left' | 'right' | 'top') => {
    setElements((prev) => {
      const group = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!group) return prev;
      if (prev.some((e) => e.type === 'blenda' && e.cabinetId === groupId && e.blendaSide === side && e.blendaScope === 'group')) return prev;
      const label = side === 'left' ? 'lewa' : side === 'right' ? 'prawa' : 'górna';
      const template: BoxElement = {
        id: crypto.randomUUID(),
        name: `Blenda gr. ${label} ${counters.blenda++}`,
        type: 'blenda',
        cabinetId: groupId,
        blendaSide: side,
        blendaScope: 'group',
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      };
      if (side === 'top') {
        const blendas = computeBlendaTopForGroup(template, group, prev);
        const withBlendas = [...prev, ...blendas];
        const withSideBlendasUpdated = withBlendas.map((e) =>
          e.type === 'blenda' && e.cabinetId === groupId &&
          (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'group'
            ? computeBlendaForGroup(e, group, withBlendas)
            : e
        );
        return recomputeGroups(withSideBlendasUpdated);
      }
      const blenda = computeBlendaForGroup(template, group, prev);
      return [...prev, blenda];
    });
  }, [setElements]);

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
      const template: BoxElement = {
        id: crypto.randomUUID(),
        name: `Maskowanica gr. ${sideLabel}${counters.maskowanica++}`,
        type: 'maskowanica',
        cabinetId: groupId,
        maskownicaSide: side,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: group.color,
      };
      if (side === 'top' || side === 'bottom') {
        const masks = computeMaskowanicasHorizForGroup(template, prev);
        return recomputeGroups([...prev, ...masks]);
      }
      const mask = computeMaskowanicaForGroup(template, prev);
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
        return recomputeGroups([...shifted, computeMaskowanicaForGroup(mask, shifted)]);
      }
      return recomputeGroups([...prev, mask]);
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
        finishId: cab.finishId,
      };
      setSelectedId(cabinetId);
      return [...prev, rod];
    });
  }, [setElements, setSelectedId]);

  const handleAdd = useCallback((type: 'cabinet' | 'shelf' | 'board' | 'boxkuchenny' | 'szafkadolna60' | 'szafkadolna40' | 'szafkadolna30') => {
    const raw = type === 'shelf' ? createShelf() : type === 'board' ? createBoard() : type === 'szafkadolna60' ? createSzafkaDolna(0.6) : type === 'szafkadolna40' ? createSzafkaDolna(0.4) : type === 'szafkadolna30' ? createSzafkaDolna(0.3) : type === 'boxkuchenny' ? createBoxKuchenny() : createBox();
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
            if (e.type === 'blenda' && e.cabinetId === id && e.blendaScope === 'group') toRemove.add(e.id);
            if (e.type === 'plinth' && e.cabinetId === id) toRemove.add(e.id);
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
          if (
            el?.type === 'maskowanica' &&
            el.cabinetId &&
            (el.maskownicaSide === 'top' || el.maskownicaSide === 'bottom')
          ) {
            const parentIsGroup = prev.some((e) => e.id === el.cabinetId && e.type === 'group');
            if (parentIsGroup) {
              for (const e of prev) {
                if (
                  e.type === 'maskowanica' &&
                  e.cabinetId === el.cabinetId &&
                  e.maskownicaSide === el.maskownicaSide
                ) {
                  toRemove.add(e.id);
                }
              }
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
                if (e.type === 'rearboard') return computeRearboardForCabinet(lowered, loweredCab);
                if (e.type === 'plinth') return computePlinthForCabinet(lowered, loweredCab, filtered);
                if (e.type === 'maskowanica') return computeMaskowanicaForCabinet(e, loweredCab, filtered);
                if (e.type === 'countertop') return computeCountertopForCabinet(e, loweredCab);
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
        if (el?.type === 'blenda' && el.blendaSide === 'top' && el.blendaScope === 'group' && el.cabinetId) {
          return recomputeGroups(filtered);
        }
        if (el?.type === 'plinth' && el.cabinetId) {
          const cab = filtered.find((e) => e.id === el.cabinetId && e.type === 'cabinet');
          if (cab) {
            const withCabBlends = filtered.map((e) =>
              e.type === 'blenda' && e.cabinetId === cab.id &&
              (e.blendaSide === 'left' || e.blendaSide === 'right') && e.blendaScope === 'cabinet'
                ? computeBlendaForCabinet(e, cab, filtered)
                : e
            );
            const cabGroupIds = cab.groupIds ?? [];
            if (cabGroupIds.length === 0) return withCabBlends;
            return withCabBlends.map((e) => {
              if (e.type === 'blenda' && e.blendaScope === 'group' && e.cabinetId && cabGroupIds.includes(e.cabinetId) && (e.blendaSide === 'left' || e.blendaSide === 'right')) {
                const group = withCabBlends.find((g) => g.id === e.cabinetId && g.type === 'group');
                if (group) return computeBlendaForGroup(e, group, withCabBlends);
              }
              return e;
            });
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
        return el?.type === 'cabinet' || el?.type === 'boxkuchenny';
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

  const handleDrawerExternalFrontChange = useCallback((drawerId: string, value: string) => {
    setElements((prev) => {
      const drawer = prev.find((e) => e.id === drawerId);
      if (!drawer || drawer.type !== 'drawer' || !drawer.cabinetId) return prev;
      if (drawer.parentIsDrawerbox !== false) return prev;
      const cab = prev.find((e) => e.id === drawer.cabinetId);
      if (!cab || (cab.type !== 'cabinet' && cab.type !== 'boxkuchenny')) return prev;

      const systemSpec = drawerSystems.find(s => s.id === value);

      if (systemSpec) {
        const faceW = Math.max(0.001, cab.dimensions.width - 0.004);
        const innerW = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T);
        const posZ = cab.position.z + cab.dimensions.depth / 2 - systemSpec.depth / 2;
        const frontH = systemSpec.height + DRAWER_SYSTEM_FRONT_EXTRA;
        return prev.map((e) => e.id === drawerId
          ? {
            ...drawer,
            drawerSystemType: value,
            externalFront: true,
            adjustedFrontWidth: faceW,
            adjustedFrontHeight: undefined,
            frontHeight: frontH,
            dimensions: { width: innerW, height: systemSpec.height, depth: systemSpec.depth },
            position: { ...drawer.position, z: posZ },
          }
          : e
        );
      }

      if (value === 'nakladana') {
        const faceW = Math.max(0.001, cab.dimensions.width - 0.004);
        const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * DRAWER_RAIL_CLEARANCE);
        const depth = Math.max(0.01, cab.dimensions.depth - PANEL_T - 0.01);
        const posZ = cab.position.z + cab.dimensions.depth / 2 - depth / 2;
        return prev.map((e) => e.id === drawerId
          ? {
            ...drawer,
            drawerSystemType: undefined,
            externalFront: true,
            adjustedFrontWidth: faceW,
            frontHeight: DRAWER_EXT_FRONT_H,
            adjustedFrontHeight: undefined,
            dimensions: { width: innerWidth, height: 0.145, depth },
            position: { ...drawer.position, z: posZ },
          }
          : e
        );
      }

      const normalFaceW = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * FRONT_INSET);
      const normalZ = cab.position.z - PANEL_T / 2 + 0.005;
      const innerWidth = Math.max(0.01, cab.dimensions.width - 2 * PANEL_T - 2 * DRAWER_RAIL_CLEARANCE);
      const depth = Math.max(0.01, cab.dimensions.depth - PANEL_T - 0.01);
      const restored = {
        ...drawer,
        drawerSystemType: undefined,
        externalFront: false,
        adjustedFrontWidth: normalFaceW,
        frontHeight: undefined,
        adjustedFrontHeight: undefined,
        dimensions: { width: innerWidth, height: 0.145, depth },
        position: { ...drawer.position, z: normalZ },
      };
      const fitted = fitDrawerToBay(restored, prev);
      return prev.map((e) => e.id === drawerId ? fitted : e);
    });
  }, [setElements, drawerSystems]);

  const handleHasTopRailsChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasTopRails: has } : e));
  }, [setElements]);

  const handleHasRearHdfChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasRearHdf: has } : e));
  }, [setElements]);

  const handleAddRearboardToCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'rearboard' && e.cabinetId === cabinetId)) return prev;
      const rb: BoxElement = computeRearboardForCabinet({
        id: crypto.randomUUID(),
        name: `Płyta tylna ${counters.hdf++}`,
        type: 'rearboard',
        cabinetId,
        dimensions: { width: 0, height: 0, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: cab.color,
      }, cab);
      setSelectedId(cabinetId);
      return [...prev, rb];
    });
  }, [setElements, setSelectedId]);

  const handleHasBottomPanelChange = useCallback((drawerboxId: string, has: boolean) => {
    setElements((prev) => prev.map((e) => e.id === drawerboxId ? { ...e, hasBottomPanel: has } : e));
  }, [setElements]);

  const handleMaskownicaNiepelnaChange = useCallback((maskId: string, value: boolean) => {
    setElements((prev) => {
      const mask = prev.find((e) => e.id === maskId);
      if (!mask || mask.type !== 'maskowanica' || !mask.cabinetId) return prev;
      const parent = prev.find((p) => p.id === mask.cabinetId);
      if (!parent) return prev;
      if (parent.type === 'group' && (mask.maskownicaSide === 'top' || mask.maskownicaSide === 'bottom')) {
        const isSibling = (e: BoxElement) => e.type === 'maskowanica' && e.cabinetId === mask.cabinetId && e.maskownicaSide === mask.maskownicaSide;
        const updated = prev.map((e) => isSibling(e) ? { ...e, niepelna: value } : e);
        return updated.map((e) => isSibling(e) ? recomputeHorizMaskGeometry(e, updated) : e);
      }
      const updated = prev.map((e) => e.id === maskId ? { ...e, niepelna: value } : e);
      return updated.map((e) => {
        if (e.id !== maskId || e.type !== 'maskowanica' || !e.cabinetId) return e;
        if (parent.type === 'cabinet') return computeMaskowanicaForCabinet(e, parent, updated);
        if (parent.type === 'group') return computeMaskowanicaForGroup(e, updated);
        return e;
      });
    });
  }, [setElements]);

  const handleStretchWithLegsChange = useCallback((elementId: string, value: boolean) => {
    setElements((prev) => {
      const el = prev.find((e) => e.id === elementId);
      if (!el || !el.cabinetId) return prev;
      if (el.stretchWithLegs === value) return prev;
      const parent = prev.find((p) => p.id === el.cabinetId);
      if (!parent) return prev;
      const updated = prev.map((e) => {
        if (e.id !== elementId) return e;
        const patched = { ...e, stretchWithLegs: value };
        if (e.type === 'maskowanica') {
          if (parent.type === 'cabinet') return computeMaskowanicaForCabinet(patched, parent, prev);
          if (parent.type === 'group') return computeMaskowanicaForGroup(patched, prev);
        }
        if (e.type === 'blenda') {
          if (parent.type === 'cabinet') return computeBlendaForCabinet(patched, parent, prev);
          if (parent.type === 'group') return computeBlendaForGroup(patched, parent, prev);
        }
        return patched;
      });
      return updated;
    });
  }, [setElements]);

  const handleFrontNoHandleChange = useCallback((frontId: string, value: boolean) => {
    setElements((prev) => prev.map((e) => e.id === frontId ? { ...e, noHandle: value } : e));
  }, [setElements]);

  const handleFrontTipOnChange = useCallback((frontId: string, value: boolean) => {
    setElements((prev) => prev.map((e) => e.id === frontId ? { ...e, tipOn: value } : e));
  }, [setElements]);

  const handleFrontWysowChange = useCallback((frontId: string, value: boolean) => {
    setElements((prev) => prev.map((e) => e.id === frontId ? { ...e, wysow: value } : e));
  }, [setElements]);

  const handleFrontLoweredChange = useCallback((frontId: string, value: boolean) => {
    setElements((prev) => {
      const front = prev.find((e) => e.id === frontId);
      if (!front) return prev;
      const updated = { ...front, frontLowered: value };
      const cab = front.cabinetId ? prev.find((e) => e.id === front.cabinetId) : undefined;
      const recomputed = cab
        ? (cab.type === 'group' ? computeFrontForGroup(updated, prev) : computeFrontForCabinet(updated, cab))
        : updated;
      return prev.map((e) => e.id === frontId ? recomputed : e);
    });
  }, [setElements]);

  const handleShelfSwitchBay = useCallback((shelfId: string) => {
    setElements((prev) => {
      const shelf = prev.find((e) => e.id === shelfId);
      if (!shelf) return prev;
      if (shelf.type === 'drawer') {
        const switched = switchDrawerToNextBay(shelf, prev);
        return prev.map((e) => (e.id === shelfId ? switched : e));
      }
      if (shelf.type !== 'shelf' && shelf.type !== 'rod') return prev;
      const switched = switchShelfToNextBay(shelf, prev);
      return prev.map((e) => (e.id === shelfId ? switched : e));
    });
  }, [setElements]);

  const handleDividerSwitchSlot = useCallback((dividerId: string) => {
    setElements((prev) => {
      const divider = prev.find((e) => e.id === dividerId);
      if (!divider || divider.type !== 'divider') return prev;
      const switched = switchDividerToNextSlot(divider, prev);
      return prev.map((e) => (e.id === dividerId ? switched : e));
    });
  }, [setElements]);

  const handleRotateCabinet = useCallback((cabinetId: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab || (cab.type !== 'cabinet' && cab.type !== 'boxkuchenny' && cab.type !== 'board')) return prev;

      const newRotationY = (((cab.rotationY ?? 0) + 90) % 360) as 0 | 90 | 180 | 270;

      if (cab.type === 'board') return prev.map((e) => e.id === cabinetId ? { ...e, rotationY: newRotationY } : e);

      // Collect IDs of direct children and grandchildren (e.g. drawers inside drawerboxes)
      const directChildIds = new Set(prev.filter((e) => e.cabinetId === cabinetId).map((e) => e.id));

      return prev.map((e) => {
        if (e.id === cabinetId) return { ...e, rotationY: newRotationY };

        // Determine relative position of child/grandchild to cabinet center
        let rx: number, rz: number;
        if (e.cabinetId === cabinetId) {
          rx = e.position.x - cab.position.x;
          rz = e.position.z - cab.position.z;
        } else if (e.cabinetId && directChildIds.has(e.cabinetId)) {
          rx = e.position.x - cab.position.x;
          rz = e.position.z - cab.position.z;
        } else {
          return e;
        }

        // 90° CW rotation (from above): new_rx = rz, new_rz = -rx
        return {
          ...e,
          position: {
            ...e.position,
            x: cab.position.x + rz,
            z: cab.position.z - rx,
          },
        };
      });
    });
  }, [setElements]);

  const handleAddCountertopToCabinet = useCallback((cabinetId: string, thicknessMm = DEFAULT_COUNTERTOP_THICKNESS_MM, countertopId?: string) => {
    setElements((prev) => {
      const cab = prev.find((e) => e.id === cabinetId);
      if (!cab) return prev;
      if (prev.some((e) => e.type === 'countertop' && e.cabinetId === cabinetId)) return prev;
      const ct: BoxElement = computeCountertopForCabinet({
        id: crypto.randomUUID(),
        name: `Blat ${counters.countertop++}`,
        type: 'countertop',
        cabinetId,
        countertopId,
        dimensions: { width: 0, height: thicknessMm / 1000, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: '#8B6914',
      }, cab);
      setSelectedId(cabinetId);
      return [...prev, ct];
    });
  }, [setElements, setSelectedId]);

  const handleAddCountertopToGroup = useCallback((groupId: string, thicknessMm = DEFAULT_COUNTERTOP_THICKNESS_MM, countertopId?: string) => {
    setElements((prev) => {
      const grp = prev.find((e) => e.id === groupId && e.type === 'group');
      if (!grp) return prev;
      if (prev.some((e) => e.type === 'countertop' && e.cabinetId === groupId)) return prev;
      const members = prev.filter((e) => e.groupIds?.includes(groupId) && (e.type === 'cabinet' || e.type === 'boxkuchenny'));
      const ct: BoxElement = computeCountertopForGroup({
        id: crypto.randomUUID(),
        name: `Blat ${counters.countertop++}`,
        type: 'countertop',
        cabinetId: groupId,
        countertopId,
        dimensions: { width: 0, height: thicknessMm / 1000, depth: 0 },
        position: { x: 0, y: 0, z: 0 },
        color: '#8B6914',
      }, grp, members);
      setSelectedId(groupId);
      return [...prev, ct];
    });
  }, [setElements, setSelectedId]);

  const handleAddCargoToBox = useCallback((boxId: string, cargoOption: CargoOption) => {
    setElements((prev) => {
      const box = prev.find((e) => e.id === boxId);
      if (!box) return prev;
      if (prev.some((e) => e.type === 'cargo' && e.cabinetId === boxId)) return prev;
      const w = box.dimensions.width - 2 * PANEL_T;
      const h = box.dimensions.height - 2 * PANEL_T;
      const d = box.dimensions.depth;
      const cargo: BoxElement = {
        id: crypto.randomUUID(),
        name: `Cargo ${counters.cargo++}`,
        type: 'cargo',
        cabinetId: boxId,
        cargoId: cargoOption.id,
        dimensions: { width: w, height: h, depth: d },
        position: {
          x: box.position.x,
          y: box.position.y + PANEL_T,
          z: box.position.z,
        },
        color: box.color,
        finishId: box.finishId,
      };
      setSelectedId(boxId);
      return [...prev, cargo];
    });
  }, [setElements, setSelectedId]);

  const handleCargoIdChange = useCallback((cargoElId: string, newCargoOption: CargoOption) => {
    setElements((prev) => {
      const el = prev.find((e) => e.id === cargoElId);
      if (!el || el.type !== 'cargo' || !el.cabinetId) return prev;
      if (!prev.some((e) => e.id === el.cabinetId)) return prev;
      return prev.map((e) => e.id === cargoElId
        ? { ...e, cargoId: newCargoOption.id }
        : e
      );
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
    handleAddPlinthToGroup,
    handleAddBlendaToCabinet,
    handleAddBlendaToGroup,
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
    handleAddRearboardToCabinet,
    handleHasTopRailsChange,
    handleHasSidePanelsChange,
    handleDrawerAdjustFrontChange,
    handleDrawerFrontHeightChange,
    handleDrawerPushToOpenChange,
    handleDrawerExternalFrontChange,
    handleMaskownicaNiepelnaChange,
    handleStretchWithLegsChange,
    handleFrontNoHandleChange,
    handleFrontTipOnChange,
    handleFrontWysowChange,
    handleFrontLoweredChange,
    handleShelfSwitchBay,
    handleDividerSwitchSlot,
    handleRotateCabinet,
    handleAddCountertopToCabinet,
    handleAddCountertopToGroup,
    handleAddCargoToBox,
    handleCargoIdChange,
    handleClearAll,
  };
}

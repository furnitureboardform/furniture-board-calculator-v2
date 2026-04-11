import { useEffect } from 'react';
import type React from 'react';
import type { BoxElement } from '../types';
import {
  computeHdfForCabinet,
  computeRearboardForCabinet,
  computeLegsForCabinet,
  computePlinthForCabinet,
  computeBlendaForCabinet,
  computeFrontForCabinet,
  computeMaskowanicaForCabinet,
} from '../computeElements';

interface Params {
  selectedId: string | null;
  multiSelectedIds: string[];
  handleDelete: (id: string) => void;
  elements: BoxElement[];
  setElements: React.Dispatch<React.SetStateAction<BoxElement[]>>;
  setMultiSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  undo: () => void;
  redo: () => void;
  handleDividerSwitchSlot?: (id: string) => void;
  onCtrlSave?: () => void;
}

export function useKeyboard({ selectedId, multiSelectedIds, handleDelete, elements, setElements, setMultiSelectedIds, undo, redo, handleDividerSwitchSlot, onCtrlSave }: Params) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onCtrlSave?.();
        return;
      }

      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setMultiSelectedIds(elements.map((el) => el.id));
        return;
      }

      if (e.key === 'Control' && selectedId && handleDividerSwitchSlot) {
        handleDividerSwitchSlot(selectedId);
        return;
      }

      if (e.key === 'Delete') {
        if (multiSelectedIds.length > 0) {
          for (const id of multiSelectedIds) handleDelete(id);
        } else if (selectedId) {
          handleDelete(selectedId);
        }
        return;
      }

      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        undo();
        return;
      }

      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        redo();
        return;
      }

      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        if (!selectedId) return;
        setElements((prev) => {
          const src = prev.find((el) => el.id === selectedId);
          if (!src || (src.type !== 'cabinet' && src.type !== 'boxkuchenny')) return prev;
          const offsetX = src.dimensions.width + 0.02;
          const newCabId = crypto.randomUUID();
          const idMap = new Map<string, string>([[src.id, newCabId]]);
          const newCab: BoxElement = {
            ...src,
            id: newCabId,
            name: `${src.name} (kopia)`,
            groupIds: [],
            position: { ...src.position, x: src.position.x + offsetX },
          };
          const directChildren = prev.filter((el) => el.cabinetId === src.id);
          for (const child of directChildren) idMap.set(child.id, crypto.randomUUID());
          const grandChildren = prev.filter((el) => el.cabinetId && directChildren.some((dc) => dc.id === el.cabinetId));
          for (const gc of grandChildren) idMap.set(gc.id, crypto.randomUUID());
          const allDescendants = [...directChildren, ...grandChildren];
          const newDescendants: BoxElement[] = allDescendants.map((child) => ({
            ...child,
            id: idMap.get(child.id)!,
            cabinetId: idMap.get(child.cabinetId!)!,
            position: { ...child.position, x: child.position.x + offsetX },
          }));
          const allWithNew = [...prev, newCab, ...newDescendants];
          const finalDescendants = newDescendants.map((c) => {
            if (c.cabinetId !== newCabId) return c;
            if (c.type === 'front') return computeFrontForCabinet(c, newCab);
            if (c.type === 'hdf') return computeHdfForCabinet(c, newCab);
            if (c.type === 'rearboard') return computeRearboardForCabinet(c, newCab);
            if (c.type === 'leg') return computeLegsForCabinet(c, newCab);
            if (c.type === 'plinth') return computePlinthForCabinet(c, newCab, allWithNew);
            if (c.type === 'blenda' && c.blendaScope === 'cabinet') return computeBlendaForCabinet(c, newCab, allWithNew);
            if (c.type === 'maskowanica') return computeMaskowanicaForCabinet(c, newCab, allWithNew);
            return c;
          });
          return [...prev, newCab, ...finalDescendants];
        });
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, multiSelectedIds, handleDelete, elements, setElements, setMultiSelectedIds, undo, redo, onCtrlSave]);
}

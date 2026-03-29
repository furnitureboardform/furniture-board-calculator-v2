import { useEffect } from 'react';
import type React from 'react';
import type { BoxElement } from '../types';
import {
  computeHdfForCabinet,
  computeLegsForCabinet,
  computeFrontForCabinet,
  computeMaskowanicaForCabinet,
} from '../computeElements';

interface Params {
  selectedId: string | null;
  multiSelectedIds: string[];
  handleDelete: (id: string) => void;
  setElements: React.Dispatch<React.SetStateAction<BoxElement[]>>;
  undo: () => void;
  redo: () => void;
}

export function useKeyboard({ selectedId, multiSelectedIds, handleDelete, setElements, undo, redo }: Params) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
          const allWithNew = [...prev, newCab, ...newChildren];
          const finalChildren = newChildren.map((c) =>
            c.type === 'maskowanica' ? computeMaskowanicaForCabinet(c, newCab, allWithNew) : c
          );
          return [...prev, newCab, ...finalChildren];
        });
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, multiSelectedIds, handleDelete, setElements, undo, redo]);
}

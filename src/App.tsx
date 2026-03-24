import React, { useRef, useState, useCallback } from 'react';
import type { BoxElement, BoxDimensions } from './types';
import { useThreeScene } from './useThreeScene';
import ElementLibrary from './ElementLibrary';
import PropertiesPanel from './PropertiesPanel';
import './App.css';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
let colorIndex = 0;
let boxCounter = 1;

function createBox(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return {
    id: crypto.randomUUID(),
    name: `Box ${boxCounter++}`,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: (Math.random() - 0.5) * 4, y: 0, z: (Math.random() - 0.5) * 4 },
    color,
  };
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<BoxElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleDimensionDrag = useCallback(
    (id: string, axis: 'width' | 'height' | 'depth', delta: number) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== id) return el;
          const newVal = Math.max(0.1, el.dimensions[axis] + delta);
          return { ...el, dimensions: { ...el.dimensions, [axis]: newVal } };
        })
      );
    },
    []
  );

  const handleDimensionInput = useCallback(
    (id: string, dims: BoxDimensions) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, dimensions: dims } : el))
      );
    },
    []
  );

  const handlePositionChange = useCallback(
    (id: string, dx: number, dz: number) => {
      setElements((prev) =>
        prev.map((el) =>
          el.id === id
            ? { ...el, position: { ...el.position, x: el.position.x + dx, z: el.position.z + dz } }
            : el
        )
      );
    },
    []
  );

  const handleAdd = useCallback(() => {
    const box = createBox();
    setElements((prev) => [...prev, box]);
    setSelectedId(box.id);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((el) => el.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    []
  );

  useThreeScene(containerRef, {
    elements,
    selectedId,
    onSelect: handleSelect,
    onDimensionChange: handleDimensionDrag,
    onPositionChange: handlePositionChange,
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
          onDelete={handleDelete}
        />
      </aside>

      <main className="viewport" ref={containerRef} />

      <aside className="sidebar right">
        <PropertiesPanel element={selectedElement} onChange={handleDimensionInput} />
      </aside>
    </div>
  );
};

export default App;

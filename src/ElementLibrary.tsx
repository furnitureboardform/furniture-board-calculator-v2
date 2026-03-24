import React from 'react';
import type { BoxElement } from './types';
import './ElementLibrary.css';

interface Props {
  elements: BoxElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

const ElementLibrary: React.FC<Props> = ({ elements, selectedId, onSelect, onAdd, onDelete }) => {
  return (
    <div className="library">
      <div className="library-header">
        <h2>Biblioteka elementów</h2>
        <button className="btn-add" onClick={onAdd}>
          + Dodaj Box
        </button>
      </div>
      <ul className="element-list">
        {elements.map((el) => (
          <li
            key={el.id}
            className={`element-item ${el.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(el.id)}
          >
            <span
              className="element-color"
              style={{ background: el.color }}
            />
            <span className="element-name">{el.name}</span>
            <span className="element-dims">
              {el.dimensions.width.toFixed(1)} × {el.dimensions.height.toFixed(1)} × {el.dimensions.depth.toFixed(1)}
            </span>
            <button
              className="btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(el.id);
              }}
              title="Usuń"
            >
              ✕
            </button>
          </li>
        ))}
        {elements.length === 0 && (
          <li className="element-empty">Brak elementów. Dodaj Box!</li>
        )}
      </ul>
    </div>
  );
};

export default ElementLibrary;

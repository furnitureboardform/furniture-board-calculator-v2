import React from 'react';
import type { BoxElement } from './types';
import './ElementLibrary.css';

interface CatalogItem {
  type: 'cabinet' | 'shelf';
  label: string;
  icon: React.ReactNode;
}

const CATALOG: CatalogItem[] = [
  {
    type: 'cabinet',
    label: 'Box',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <polygon points="18,4 32,11 32,25 18,32 4,25 4,11" fill="#1e2d55" stroke="#3b6fd4" strokeWidth="1.5"/>
        <polyline points="18,4 18,32" stroke="#3b6fd4" strokeWidth="1" strokeDasharray="3 2"/>
        <polyline points="4,11 18,18 32,11" stroke="#3b6fd4" strokeWidth="1.5"/>
        <polygon points="18,18 32,11 32,25 18,32" fill="#253a6e" stroke="#3b6fd4" strokeWidth="1.5"/>
        <polygon points="18,18 4,11 4,25 18,32" fill="#1a2d5a" stroke="#3b6fd4" strokeWidth="1.5"/>
        <polygon points="18,4 32,11 18,18 4,11" fill="#2e4a8a" stroke="#4a7fe0" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    type: 'shelf',
    label: 'Półka',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <rect x="4" y="16" width="28" height="5" rx="1" fill="#2e4a8a" stroke="#4a7fe0" strokeWidth="1.5"/>
        <line x1="4" y1="16" x2="10" y2="11" stroke="#3b6fd4" strokeWidth="1.5"/>
        <line x1="32" y1="16" x2="38" y2="11" stroke="#3b6fd4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="4" y1="16" x2="10" y2="11" stroke="#3b6fd4" strokeWidth="1.5"/>
        <line x1="32" y1="16" x2="26" y2="11" stroke="#3b6fd4" strokeWidth="1.5"/>
        <rect x="10" y="11" width="16" height="5" rx="1" fill="#1a2d5a" stroke="#3b6fd4" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

interface Props {
  elements: BoxElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: 'cabinet' | 'shelf') => void;
  onDelete: (id: string) => void;
}

const ElementLibrary: React.FC<Props> = ({ elements, selectedId, onSelect, onAdd, onDelete }) => {
  return (
    <div className="library">
      {/* Catalog */}
      <div className="lib-section-title">Elementy</div>
      <div className="catalog-grid">
        {CATALOG.map((item) => (
          <button
            key={item.type}
            className="catalog-card"
            onClick={() => onAdd(item.type)}
            title={`Dodaj ${item.label}`}
          >
            {item.icon}
            <span className="catalog-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="lib-divider" />

      {/* Added elements */}
      <div className="lib-section-title">Dodane</div>
      <ul className="element-list">
        {elements.map((el) => (
          <li
            key={el.id}
            className={`element-item ${el.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(el.id)}
          >
            <span className="element-color" style={{ background: el.color }} />
            <span className="element-name">{el.name}</span>
            <span className="element-dims">
              {el.dimensions.width.toFixed(1)} × {el.dimensions.height.toFixed(1)} × {el.dimensions.depth.toFixed(1)}
            </span>
            <button
              className="btn-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}
              title="Usuń"
            >
              ✕
            </button>
          </li>
        ))}
        {elements.length === 0 && (
          <li className="element-empty">Brak dodanych elementów.</li>
        )}
      </ul>
    </div>
  );
};

export default ElementLibrary;

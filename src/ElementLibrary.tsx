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
  onAddShelfToCabinet: (cabinetId: string) => void;
  onAddDividerToCabinet: (cabinetId: string) => void;
  onAddFrontToCabinet: (cabinetId: string) => void;
  onAddDoubleFrontToCabinet: (cabinetId: string) => void;
  onAddRodToCabinet: (cabinetId: string) => void;
  onAddLegsToCabinet: (cabinetId: string) => void;
  onAddHdfToCabinet: (cabinetId: string) => void;
  onDelete: (id: string) => void;
}

const ElementLibrary: React.FC<Props> = ({ elements, selectedId, onSelect, onAdd, onAddShelfToCabinet, onAddDividerToCabinet, onAddFrontToCabinet, onAddDoubleFrontToCabinet, onAddRodToCabinet, onAddLegsToCabinet, onAddHdfToCabinet, onDelete }) => {
  const cabinets = elements.filter((e) => e.type === 'cabinet');
  const freeShelves = elements.filter((e) => (e.type === 'shelf' || e.type === 'rod') && !e.cabinetId);

  const renderItem = (el: BoxElement, indent = false) => (
    <li
      key={el.id}
      className={`element-item ${indent ? 'element-item--child' : ''} ${el.id === selectedId ? 'selected' : ''}`}
      onClick={() => onSelect(el.id)}
    >
      {indent && <span className="element-indent-line" />}
      <span className="element-color" style={{ background: el.color }} />
      <span className="element-name">{el.name}</span>
      <button
        className="btn-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}
        title="Usuń"
      >
        ✕
      </button>
    </li>
  );

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

      <div className="lib-divider" />

      {/* Tree list */}
      <div className="lib-section-title">Dodane</div>
      <ul className="element-list">
        {cabinets.map((cab) => {
          const children = elements.filter((e) => e.cabinetId === cab.id);
          const isSelected = cab.id === selectedId;
          const isExpanded = isSelected || children.some((c) => c.id === selectedId);
          return (
            <React.Fragment key={cab.id}>
              {/* Cabinet row */}
              <li
                className={`element-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(cab.id)}
              >
                <span className="element-color" style={{ background: cab.color }} />
                <span className="element-name">{cab.name}</span>
                <button
                  className="btn-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(cab.id); }}
                  title="Usuń"
                >
                  ✕
                </button>
              </li>
              {/* Children visible when cabinet or any child is selected */}
              {isExpanded && (
                <>
                  {children.map((child) => renderItem(child, true))}
                  <li className="element-item element-item--add" onClick={() => onAddShelfToCabinet(cab.id)}>
                    <span className="element-indent-line" />
                    <span className="element-add-icon">＋</span>
                    <span className="element-name" style={{ color: '#6060a0' }}>Dodaj półkę</span>
                  </li>
                  <li className="element-item element-item--add" onClick={() => onAddDividerToCabinet(cab.id)}>
                    <span className="element-indent-line" />
                    <span className="element-add-icon">＋</span>
                    <span className="element-name" style={{ color: '#6060a0' }}>Dodaj przegrodę</span>
                  </li>
                  <li className="element-item element-item--add" onClick={() => onAddRodToCabinet(cab.id)}>
                    <span className="element-indent-line" />
                    <span className="element-add-icon">＋</span>
                    <span className="element-name" style={{ color: '#6060a0' }}>Dodaj drążek</span>
                  </li>
                  {!elements.some((e) => e.type === 'leg' && e.cabinetId === cab.id) && (
                    <li className="element-item element-item--add" onClick={() => onAddLegsToCabinet(cab.id)}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#6060a0' }}>Dodaj nóżki</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'hdf' && e.cabinetId === cab.id) && (
                    <li className="element-item element-item--add" onClick={() => onAddHdfToCabinet(cab.id)}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">️＋</span>
                      <span className="element-name" style={{ color: '#6060a0' }}>Dodaj płytę HDF</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'front' && e.cabinetId === cab.id) && (
                    <>
                      <li className="element-item element-item--add" onClick={() => onAddFrontToCabinet(cab.id)}>
                        <span className="element-indent-line" />
                        <span className="element-add-icon">＋</span>
                        <span className="element-name" style={{ color: '#6060a0' }}>Dodaj front</span>
                      </li>
                      <li className="element-item element-item--add" onClick={() => onAddDoubleFrontToCabinet(cab.id)}>
                        <span className="element-indent-line" />
                        <span className="element-add-icon">＋</span>
                        <span className="element-name" style={{ color: '#6060a0' }}>Dodaj podwójny front</span>
                      </li>
                    </>
                  )}
                </>
              )}
            </React.Fragment>
          );
        })}
        {freeShelves.map((el) => renderItem(el, false))}
        {elements.length === 0 && (
          <li className="element-empty">Brak dodanych elementów.</li>
        )}
      </ul>
    </div>
  );
};

export default ElementLibrary;

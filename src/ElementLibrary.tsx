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
  multiSelectedIds: string[];
  onSelect: (id: string) => void;
  onMultiSelectToggle: (id: string) => void;
  onGroup: (ids: string[]) => void;
  onAdd: (type: 'cabinet' | 'shelf') => void;
  onAddShelfToCabinet: (cabinetId: string) => void;
  onAddDrawerToCabinet: (cabinetId: string) => void;
  onAddDrawerboxToCabinet: (cabinetId: string) => void;
  onAddDividerToCabinet: (cabinetId: string) => void;
  onAddFrontToCabinet: (cabinetId: string) => void;
  onAddDoubleFrontToCabinet: (cabinetId: string) => void;
  onAddRodToCabinet: (cabinetId: string) => void;
  onAddLegsToCabinet: (cabinetId: string) => void;
  onAddHdfToCabinet: (cabinetId: string) => void;
  onAddFrontToGroup: (groupId: string) => void;
  onUngroup: (groupId: string) => void;
  onDelete: (id: string) => void;
}

const ElementLibrary: React.FC<Props> = ({
  elements, selectedId, multiSelectedIds,
  onSelect, onMultiSelectToggle, onGroup, onAdd,
  onAddShelfToCabinet, onAddDrawerToCabinet, onAddDrawerboxToCabinet, onAddDividerToCabinet,
  onAddFrontToCabinet, onAddDoubleFrontToCabinet,
  onAddRodToCabinet, onAddLegsToCabinet, onAddHdfToCabinet,
  onAddFrontToGroup, onUngroup, onDelete,
}) => {
  // Cabinets that don't belong to any group
  const standaloneCabinets = elements.filter((e) => e.type === 'cabinet' && !e.groupId);
  const groups = elements.filter((e) => e.type === 'group');
  const freeShelves = elements.filter((e) => (e.type === 'shelf' || e.type === 'rod') && !e.cabinetId);

  const canGroup = multiSelectedIds.length >= 2;

  const handleCabinetClick = (e: React.MouseEvent, id: string) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      // On the very first ctrl-click, pull the currently single-selected item into multi-select too
      if (selectedId && multiSelectedIds.length === 0 && selectedId !== id) {
        onMultiSelectToggle(selectedId);
      }
      onMultiSelectToggle(id);
    } else {
      onSelect(id);
    }
  };

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
        onClick={(ev) => { ev.stopPropagation(); onDelete(el.id); }}
        title="Usuń"
      >
        ✕
      </button>
    </li>
  );

  const renderDrawerbox = (dbox: BoxElement) => {
    const drawers = elements.filter((e) => e.cabinetId === dbox.id);
    const isSelected = dbox.id === selectedId;
    const isExpanded = isSelected || drawers.some((d) => d.id === selectedId);
    return (
      <React.Fragment key={dbox.id}>
        <li
          className={`element-item element-item--child ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(dbox.id)}
        >
          <span className="element-indent-line" />
          <span style={{ fontSize: '11px', marginRight: '4px', opacity: 0.7 }}>▦</span>
          <span className="element-color" style={{ background: dbox.color }} />
          <span className="element-name">{dbox.name}</span>
          <button
            className="btn-delete"
            onClick={(ev) => { ev.stopPropagation(); onDelete(dbox.id); }}
            title="Usuń"
          >
            ✕
          </button>
        </li>
        {isExpanded && (
          <>
            {drawers.map((drawer) => (
              <li
                key={drawer.id}
                className={`element-item element-item--child ${drawer.id === selectedId ? 'selected' : ''}`}
                onClick={() => onSelect(drawer.id)}
              >
                <span className="element-indent-line" />
                <span className="element-indent-line" />
                <span className="element-color" style={{ background: drawer.color }} />
                <span className="element-name">{drawer.name}</span>
                <button
                  className="btn-delete"
                  onClick={(ev) => { ev.stopPropagation(); onDelete(drawer.id); }}
                  title="Usuń"
                >
                  ✕
                </button>
              </li>
            ))}
            <li className="element-item element-item--add" onClick={() => onAddDrawerToCabinet(dbox.id)}>
              <span className="element-indent-line" />
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#6060a0' }}>Dodaj szufladę</span>
            </li>
          </>
        )}
      </React.Fragment>
    );
  };

  const renderCabinet = (cab: BoxElement, extraIndent = false) => {
    const children = elements.filter((e) => e.cabinetId === cab.id);
    const isSelected = cab.id === selectedId;
    const isMulti = multiSelectedIds.includes(cab.id);
    const isExpanded = isSelected || children.some((c) => c.id === selectedId);
    return (
      <React.Fragment key={cab.id}>
        <li
          className={`element-item ${extraIndent ? 'element-item--child' : ''} ${isSelected ? 'selected' : ''} ${isMulti ? 'multi-selected' : ''}`}
          onClick={(e) => handleCabinetClick(e, cab.id)}
        >
          {extraIndent && <span className="element-indent-line" />}
          {isMulti && <span className="multi-check">✓</span>}
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
        {isExpanded && (
          <>
            {children.filter((c) => c.type !== 'drawerbox' && c.type !== 'blenda').map((child) => renderItem(child, true))}
            {children.filter((c) => c.type === 'drawerbox').map((dbox) => renderDrawerbox(dbox))}
            <li className="element-item element-item--add" onClick={() => onAddShelfToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#6060a0' }}>Dodaj półkę</span>
            </li>
            <li className="element-item element-item--add" onClick={() => onAddDrawerboxToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#6060a0' }}>Dodaj box szuflady</span>
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
  };

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

      {/* Połącz button */}
      {canGroup && (
        <div className="group-bar">
          <button className="btn-group" onClick={() => onGroup(multiSelectedIds)}>
            Połącz ({multiSelectedIds.length})
          </button>
        </div>
      )}

      <div className="lib-divider" />

      {/* Tree list */}
      <div className="lib-section-title">Dodane</div>
      <ul className="element-list">
        {/* Groups */}
        {groups.map((grp) => {
          const members = elements.filter((e) => e.groupId === grp.id && e.type === 'cabinet');
          const groupFronts = elements.filter((e) => e.type === 'front' && e.cabinetId === grp.id);
          const isSelected = grp.id === selectedId;
          const isExpanded = isSelected || members.some((m) => m.id === selectedId) ||
            members.some((m) => elements.some((c) => c.cabinetId === m.id && c.id === selectedId)) ||
            groupFronts.some((f) => f.id === selectedId);
          return (
            <React.Fragment key={grp.id}>
              <li
                className={`element-item group-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(grp.id)}
              >
                <span className="group-icon">▤</span>
                <span className="element-name">{grp.name}</span>
                <button
                  className="btn-ungroup"
                  onClick={(e) => { e.stopPropagation(); onUngroup(grp.id); }}
                  title="Rozdziel grupę"
                >
                  ⇥
                </button>
                <button
                  className="btn-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(grp.id); }}
                  title="Usuń grupę i wszystkie elementy"
                >
                  ✕
                </button>
              </li>
              {isExpanded && (
                <>
                  {groupFronts.map((f) => renderItem(f, true))}
                  {members.map((cab) => renderCabinet(cab, true))}
                  {!groupFronts.length && (
                    <li className="element-item element-item--add" onClick={() => onAddFrontToGroup(grp.id)}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#6060a0' }}>Dodaj front grupy</span>
                    </li>
                  )}
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* Standalone cabinets */}
        {standaloneCabinets.map((cab) => renderCabinet(cab, false))}

        {/* Free shelves / rods */}
        {freeShelves.map((el) => renderItem(el, false))}

        {elements.length === 0 && (
          <li className="element-empty">Brak dodanych elementów.</li>
        )}
      </ul>
    </div>
  );
};

export default ElementLibrary;

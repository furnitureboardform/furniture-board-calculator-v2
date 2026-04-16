import React, { useState, useEffect } from 'react';
import type { BoxElement, CargoOption, CornerSystemOption } from './types';
import { PANEL_T } from './constants';
import './ElementLibrary.css';

function pickCargoForBox(cargoOptions: CargoOption[], box: BoxElement): CargoOption {
  const internalH = Math.round((box.dimensions.height - 2 * PANEL_T) * 1000);
  const match = cargoOptions.find((c) => internalH >= c.heightFromMm && internalH <= c.heightToMm);
  return match ?? cargoOptions[0];
}

function pickCornerSystemForBox(options: CornerSystemOption[], box: BoxElement): CornerSystemOption {
  const internalH = Math.round((box.dimensions.height - 2 * PANEL_T) * 1000);
  const match = options.find((c) => internalH >= c.heightFromMm && internalH <= c.heightToMm);
  return match ?? options[0];
}

interface CatalogItem {
  type: 'cabinet' | 'shelf' | 'board' | 'boxkuchenny' | 'szafkadolna60' | 'szafkadolna40' | 'szafkadolna30';
  label: string;
  icon: React.ReactNode;
}

const CATALOG: CatalogItem[] = [
  {
    type: 'cabinet',
    label: 'Box',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <polygon points="18,4 32,11 32,25 18,32 4,25 4,11" fill="#0e3a5a" stroke="#569cd6" strokeWidth="1.5"/>
        <polyline points="18,4 18,32" stroke="#569cd6" strokeWidth="1" strokeDasharray="3 2"/>
        <polyline points="4,11 18,18 32,11" stroke="#569cd6" strokeWidth="1.5"/>
        <polygon points="18,18 32,11 32,25 18,32" fill="#1a4a6e" stroke="#569cd6" strokeWidth="1.5"/>
        <polygon points="18,18 4,11 4,25 18,32" fill="#0a2840" stroke="#569cd6" strokeWidth="1.5"/>
        <polygon points="18,4 32,11 18,18 4,11" fill="#1e5580" stroke="#9cdcfe" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    type: 'shelf',
    label: 'Półka',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <rect x="4" y="16" width="28" height="5" rx="1" fill="#123a32" stroke="#4ec9b0" strokeWidth="1.5"/>
        <line x1="4" y1="16" x2="10" y2="11" stroke="#4ec9b0" strokeWidth="1.5"/>
        <line x1="32" y1="16" x2="38" y2="11" stroke="#4ec9b0" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="4" y1="16" x2="10" y2="11" stroke="#4ec9b0" strokeWidth="1.5"/>
        <line x1="32" y1="16" x2="26" y2="11" stroke="#4ec9b0" strokeWidth="1.5"/>
        <rect x="10" y="11" width="16" height="5" rx="1" fill="#0d2e28" stroke="#4ec9b0" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    type: 'board',
    label: 'Płyta',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <rect x="4" y="14" width="28" height="8" rx="1" fill="#3c2210" stroke="#ce9178" strokeWidth="1.5"/>
        <polygon points="4,14 10,9 38,9 32,14" fill="#251508" stroke="#ce9178" strokeWidth="1.5"/>
        <polygon points="32,14 38,9 38,17 32,22" fill="#4a2a14" stroke="#ce9178" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    type: 'boxkuchenny',
    label: 'Box kuchenny',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <polygon points="18,4 32,11 32,25 18,32 4,25 4,11" fill="#0e3a5a" stroke="#569cd6" strokeWidth="1.5"/>
        <polyline points="18,4 18,32" stroke="#569cd6" strokeWidth="1" strokeDasharray="3 2"/>
        <polyline points="4,11 18,18 32,11" stroke="#569cd6" strokeWidth="1.5"/>
        <polygon points="18,18 32,11 32,25 18,32" fill="#1a4a6e" stroke="#569cd6" strokeWidth="1.5"/>
        <polygon points="18,18 4,11 4,25 18,32" fill="#0a2840" stroke="#569cd6" strokeWidth="1.5"/>
        <polygon points="18,4 32,11 18,18 4,11" fill="#1e5580" stroke="#9cdcfe" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    type: 'szafkadolna60',
    label: 'Szafka 60',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <rect x="4" y="6" width="28" height="24" rx="1" fill="none" stroke="#9cdcfe" strokeWidth="1" strokeDasharray="3 2"/>
        <rect x="4" y="6" width="3" height="24" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="29" y="6" width="3" height="24" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="7" y="27" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="7" y="6" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5" opacity="0.5"/>
        <rect x="7" y="9" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5" opacity="0.5"/>
        <text x="18" y="22" textAnchor="middle" fontSize="7" fill="#9cdcfe" fontFamily="monospace">60</text>
      </svg>
    ),
  },
  {
    type: 'szafkadolna40',
    label: 'Szafka 40',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <rect x="4" y="6" width="28" height="24" rx="1" fill="none" stroke="#9cdcfe" strokeWidth="1" strokeDasharray="3 2"/>
        <rect x="4" y="6" width="3" height="24" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="29" y="6" width="3" height="24" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="7" y="27" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="7" y="6" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5" opacity="0.5"/>
        <rect x="7" y="9" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5" opacity="0.5"/>
        <text x="18" y="22" textAnchor="middle" fontSize="7" fill="#9cdcfe" fontFamily="monospace">40</text>
      </svg>
    ),
  },
  {
    type: 'szafkadolna30',
    label: 'Szafka 30',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="catalog-icon">
        <rect x="4" y="6" width="28" height="24" rx="1" fill="none" stroke="#9cdcfe" strokeWidth="1" strokeDasharray="3 2"/>
        <rect x="4" y="6" width="3" height="24" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="29" y="6" width="3" height="24" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="7" y="27" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5"/>
        <rect x="7" y="6" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5" opacity="0.5"/>
        <rect x="7" y="9" width="22" height="3" rx="0" fill="#1a4a6e" stroke="#9cdcfe" strokeWidth="1.5" opacity="0.5"/>
        <text x="18" y="22" textAnchor="middle" fontSize="7" fill="#9cdcfe" fontFamily="monospace">30</text>
      </svg>
    ),
  },
];

interface Props {
  elements: BoxElement[];
  selectedId: string | null;
  multiSelectedIds: string[];
  boardSize: { width: number; depth: number; height: number };
  onBoardSizeChange: (size: { width: number; depth: number; height: number }) => void;
  onSelect: (id: string) => void;
  onMultiSelectToggle: (id: string) => void;
  onGroup: (ids: string[]) => void;
  onAdd: (type: 'cabinet' | 'shelf' | 'board' | 'boxkuchenny' | 'szafkadolna60' | 'szafkadolna40' | 'szafkadolna30') => void;
  onAddShelfToCabinet: (cabinetId: string) => void;
  onAddDrawerToCabinet: (cabinetId: string) => void;
  onAddDrawerboxToCabinet: (cabinetId: string) => void;
  onAddDividerToCabinet: (cabinetId: string) => void;
  onAddFrontToCabinet: (cabinetId: string) => void;
  onAddDoubleFrontToCabinet: (cabinetId: string) => void;
  onAddRodToCabinet: (cabinetId: string) => void;
  onAddLegsToCabinet: (cabinetId: string) => void;
  onAddLegsToBoxKuchenny: (boxId: string) => void;
  onAddHdfToCabinet: (cabinetId: string) => void;
  onAddPlinthToCabinet: (cabinetId: string) => void;
  onAddPlinthToGroup: (groupId: string) => void;
  onAddBlendaToCabinet: (cabinetId: string, side: 'left' | 'right' | 'top') => void;
  onAddBlendaToGroup: (groupId: string, side: 'left' | 'right' | 'top') => void;
  onAddFrontToGroup: (groupId: string) => void;
  onAddDoubleFrontToGroup: (groupId: string) => void;
  onAddMaskowanicaToCabinet: (cabinetId: string, side: 'left' | 'right' | 'bottom' | 'top') => void;
  onAddMaskowanicaToGroup: (groupId: string, side: 'left' | 'right' | 'top' | 'bottom') => void;
  onAddRearboardToCabinet: (cabinetId: string) => void;
  onAddCountertopToCabinet: (cabinetId: string, thicknessMm?: number, countertopId?: string) => void;
  onAddCountertopToGroup: (groupId: string, thicknessMm?: number, countertopId?: string) => void;
  onAddCargoToBox: (boxId: string, cargoOption: CargoOption) => void;
  cargoOptions: CargoOption[];
  onAddCornerSystemToBox: (boxId: string, option: CornerSystemOption, side: 'left' | 'right') => void;
  cornerSystemOptions: CornerSystemOption[];
  onUngroup: (groupId: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const ClearAllConfirm: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div className="clear-all-overlay" onClick={onCancel}>
    <div className="clear-all-dialog" onClick={(e) => e.stopPropagation()}>
      <p>Usunąć wszystkie elementy ze sceny?</p>
      <div className="clear-all-actions">
        <button className="clear-all-cancel" onClick={onCancel}>Anuluj</button>
        <button className="clear-all-confirm" onClick={onConfirm}>Usuń wszystko</button>
      </div>
    </div>
  </div>
);

const ElementLibrary: React.FC<Props> = ({
  elements, selectedId, multiSelectedIds,
  boardSize, onBoardSizeChange,
  onSelect, onMultiSelectToggle, onGroup, onAdd,
  onAddShelfToCabinet, onAddDrawerToCabinet, onAddDrawerboxToCabinet, onAddDividerToCabinet,
  onAddFrontToCabinet, onAddDoubleFrontToCabinet,
  onAddRodToCabinet, onAddLegsToCabinet, onAddLegsToBoxKuchenny, onAddHdfToCabinet, onAddPlinthToCabinet, onAddPlinthToGroup, onAddBlendaToCabinet,
  onAddBlendaToGroup,
  onAddFrontToGroup, onAddDoubleFrontToGroup,
  onAddMaskowanicaToCabinet, onAddMaskowanicaToGroup,
  onAddRearboardToCabinet,
  onAddCountertopToCabinet, onAddCountertopToGroup,
  onAddCargoToBox, cargoOptions,
  onAddCornerSystemToBox, cornerSystemOptions,
  onUngroup, onDelete, onClearAll,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [draftWidth, setDraftWidth] = useState(String(boardSize.width));
  const [draftDepth, setDraftDepth] = useState(String(boardSize.depth));
  const [draftHeight, setDraftHeight] = useState(String(boardSize.height));

  // Keep drafts in sync if boardSize changes from outside
  useEffect(() => { setDraftWidth(String(boardSize.width)); }, [boardSize.width]);
  useEffect(() => { setDraftDepth(String(boardSize.depth)); }, [boardSize.depth]);
  useEffect(() => { setDraftHeight(String(boardSize.height)); }, [boardSize.height]);

  const applyWidth = (raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 100) {
      const clamped = Math.min(v, 10000);
      onBoardSizeChange({ ...boardSize, width: clamped });
      setDraftWidth(String(clamped));
    } else {
      setDraftWidth(String(boardSize.width));
    }
  };

  const applyDepth = (raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 100) {
      const clamped = Math.min(v, 10000);
      onBoardSizeChange({ ...boardSize, depth: clamped });
      setDraftDepth(String(clamped));
    } else {
      setDraftDepth(String(boardSize.depth));
    }
  };

  const applyHeight = (raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 100) {
      const clamped = Math.min(v, 10000);
      onBoardSizeChange({ ...boardSize, height: clamped });
      setDraftHeight(String(clamped));
    } else {
      setDraftHeight(String(boardSize.height));
    }
  };
  // Cabinets that don't belong to any group
  const standaloneCabinets = elements.filter((e) => e.type === 'cabinet' && !e.groupIds?.length);
  const groups = elements.filter((e) => e.type === 'group');
  const freeShelves = elements.filter((e) => (e.type === 'shelf' || e.type === 'board' || e.type === 'rod') && !e.cabinetId);
  const freeBoxesKuchenne = elements.filter((e) => e.type === 'boxkuchenny' && !e.groupIds?.length);

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
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj szufladę</span>
            </li>
          </>
        )}
      </React.Fragment>
    );
  };

  const renderCabinet = (cab: BoxElement, extraIndent = false) => {
    const children = elements.filter((e) => e.cabinetId === cab.id && e.type !== 'countertop');
    const countertop = elements.find((e) => e.cabinetId === cab.id && e.type === 'countertop');
    const isSelected = cab.id === selectedId;
    const isMulti = multiSelectedIds.includes(cab.id);
    const isExpanded = isSelected || children.some((c) => c.id === selectedId) || countertop?.id === selectedId;
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

            {/* Section: Wnętrze */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Wnętrze
            </li>
            <li className="element-item element-item--add" onClick={() => onAddShelfToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj półkę</span>
            </li>
            <li className="element-item element-item--add" onClick={() => onAddDrawerToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj szufladę</span>
            </li>
            <li className="element-item element-item--add" onClick={() => onAddDrawerboxToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj box szuflady</span>
            </li>
            <li className="element-item element-item--add" onClick={() => onAddDividerToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj przegrodę</span>
            </li>

            {/* Section: Wykończenie (fronty) */}
            {!elements.some((e) => e.type === 'front' && e.cabinetId === cab.id) && (
              <>
                <li className="element-item element-item--section">
                  <span className="element-section-line" />
                  Front
                </li>
                <li className="element-item element-item--add" onClick={() => onAddFrontToCabinet(cab.id)}>
                  <span className="element-indent-line" />
                  <span className="element-add-icon">＋</span>
                  <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj front</span>
                </li>
                <li className="element-item element-item--add" onClick={() => onAddDoubleFrontToCabinet(cab.id)}>
                  <span className="element-indent-line" />
                  <span className="element-add-icon">＋</span>
                  <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj podwójny front</span>
                </li>
              </>
            )}

            {/* Section: Blenda i cokół */}
            {(!elements.some((e) => e.type === 'plinth' && e.cabinetId === cab.id) ||
              !elements.some((e) => e.type === 'blenda' && e.cabinetId === cab.id && e.blendaScope === 'cabinet' && e.blendaSide === 'left') ||
              !elements.some((e) => e.type === 'blenda' && e.cabinetId === cab.id && e.blendaScope === 'cabinet' && e.blendaSide === 'right') ||
              !elements.some((e) => e.type === 'blenda' && e.cabinetId === cab.id && e.blendaScope === 'cabinet' && e.blendaSide === 'top')) && (
              <li className="element-item element-item--section">
                <span className="element-section-line" />
                Blenda i cokół
              </li>
            )}
            {children.filter((c) => c.type === 'blenda').map((blenda) => renderItem(blenda, true))}
            {!elements.some((e) => e.type === 'blenda' && e.cabinetId === cab.id && e.blendaScope === 'cabinet' && e.blendaSide === 'left') && (
              <li className="element-item element-item--add" onClick={() => onAddBlendaToCabinet(cab.id, 'left')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blendę lewą</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'blenda' && e.cabinetId === cab.id && e.blendaScope === 'cabinet' && e.blendaSide === 'right') && (
              <li className="element-item element-item--add" onClick={() => onAddBlendaToCabinet(cab.id, 'right')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blendę prawą</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'blenda' && e.cabinetId === cab.id && e.blendaScope === 'cabinet' && e.blendaSide === 'top') && (
              <li className="element-item element-item--add" onClick={() => onAddBlendaToCabinet(cab.id, 'top')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blendę górną</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'plinth' && e.cabinetId === cab.id) && (
              <li className="element-item element-item--add" onClick={() => onAddPlinthToCabinet(cab.id)}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj cokoł</span>
              </li>
            )}

            {/* Section: Maskowanie */}
            {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id) && (
              <li className="element-item element-item--section">
                <span className="element-section-line" />
                Maskowanie
              </li>
            )}
            {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'left') && (
              <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToCabinet(cab.id, 'left')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę lewa</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'right') && (
              <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToCabinet(cab.id, 'right')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę prawa</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'bottom') && (
              <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToCabinet(cab.id, 'bottom')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę dół</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === cab.id && e.maskownicaSide === 'top') && (
              <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToCabinet(cab.id, 'top')}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę góra</span>
              </li>
            )}

            {/* Section: Płyta tylna */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Płyta tylna
            </li>
            {!elements.some((e) => e.type === 'hdf' && e.cabinetId === cab.id) && (
              <li className="element-item element-item--add" onClick={() => onAddHdfToCabinet(cab.id)}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj płytę HDF</span>
              </li>
            )}
            {!elements.some((e) => e.type === 'rearboard' && e.cabinetId === cab.id) && (
              <li className="element-item element-item--add" onClick={() => onAddRearboardToCabinet(cab.id)}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj płytę tylną</span>
              </li>
            )}

            {/* Section: Dodatki */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Dodatki
            </li>
            <li className="element-item element-item--add" onClick={() => onAddRodToCabinet(cab.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj drążek</span>
            </li>
            {!elements.some((e) => e.type === 'leg' && e.cabinetId === cab.id) && (
              <li className="element-item element-item--add" onClick={() => onAddLegsToCabinet(cab.id)}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj nóżki</span>
              </li>
            )}
            {/* Cargo */}
            {(() => {
              const cargoEl = children.find((c) => c.type === 'cargo');
              if (cargoEl) {
                return (
                  <li
                    className={`element-item element-item--child ${cargoEl.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(cargoEl.id)}
                  >
                    <span className="element-indent-line" />
                    <span className="element-color" style={{ background: cargoEl.color }} />
                    <span className="element-name">{cargoEl.name}</span>
                    <button
                      className="btn-delete"
                      onClick={(ev) => { ev.stopPropagation(); onDelete(cargoEl.id); }}
                      title="Usuń"
                    >✕</button>
                  </li>
                );
              }
              if (cargoOptions.length > 0) {
                return (
                  <li className="element-item element-item--add" onClick={() => onAddCargoToBox(cab.id, pickCargoForBox(cargoOptions, cab))}>
                    <span className="element-indent-line" />
                    <span className="element-add-icon">＋</span>
                    <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj cargo</span>
                  </li>
                );
              }
              return null;
            })()}
            {/* Blat */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Blat
            </li>
            {countertop ? renderItem(countertop, true) : (
              <li className="element-item element-item--add" onClick={() => {
                onAddCountertopToCabinet(cab.id);
              }}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blat</span>
              </li>
            )}
          </>
        )}
      </React.Fragment>
    );
  };

  const renderBoxKuchenny = (box: BoxElement, extraIndent = false) => {
    const children = elements.filter((e) => e.cabinetId === box.id && e.type !== 'countertop');
    const countertop = elements.find((e) => e.cabinetId === box.id && e.type === 'countertop');
    const legs = children.filter((e) => e.type === 'leg');
    const isSelected = box.id === selectedId;
    const isMulti = multiSelectedIds.includes(box.id);
    const isExpanded = isSelected || children.some((c) => c.id === selectedId) || countertop?.id === selectedId;
    return (
      <React.Fragment key={box.id}>
        <li
          className={`element-item ${extraIndent ? 'element-item--child' : ''} ${isSelected ? 'selected' : ''} ${isMulti ? 'multi-selected' : ''}`}
          onClick={(e) => handleCabinetClick(e, box.id)}
        >
          {extraIndent && <span className="element-indent-line" />}
          {isMulti && <span className="multi-check">✓</span>}
          <span className="element-color" style={{ background: box.color }} />
          <span className="element-name">{box.name}</span>
          <button
            className="btn-delete"
            onClick={(ev) => { ev.stopPropagation(); onDelete(box.id); }}
            title="Usuń"
          >
            ✕
          </button>
        </li>
        {isExpanded && (
          <>
            {children.filter((c) => c.type !== 'leg').map((child) => renderItem(child, true))}

            {/* Section: Wnętrze */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Wnętrze
            </li>
            <li className="element-item element-item--add" onClick={() => onAddShelfToCabinet(box.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj półkę</span>
            </li>
            <li className="element-item element-item--add" onClick={() => onAddDrawerToCabinet(box.id)}>
              <span className="element-indent-line" />
              <span className="element-add-icon">＋</span>
              <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj szufladę</span>
            </li>

            {/* Section: Front */}
            {!elements.some((e) => e.type === 'front' && e.cabinetId === box.id) && (
              <>
                <li className="element-item element-item--section">
                  <span className="element-section-line" />
                  Front
                </li>
                <li className="element-item element-item--add" onClick={() => onAddFrontToCabinet(box.id)}>
                  <span className="element-indent-line" />
                  <span className="element-add-icon">＋</span>
                  <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj front</span>
                </li>
                <li className="element-item element-item--add" onClick={() => onAddDoubleFrontToCabinet(box.id)}>
                  <span className="element-indent-line" />
                  <span className="element-add-icon">＋</span>
                  <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj podwójny front</span>
                </li>
              </>
            )}

            {/* Section: Płyta tylna */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Płyta tylna
            </li>
            {!elements.some((e) => e.type === 'hdf' && e.cabinetId === box.id) && (
              <li className="element-item element-item--add" onClick={() => onAddHdfToCabinet(box.id)}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj płytę HDF</span>
              </li>
            )}

            {/* Section: Dodatki */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Dodatki
            </li>
            {legs.map((leg) => renderItem(leg, true))}
            {!legs.length && (
              <li className="element-item element-item--add" onClick={() => onAddLegsToBoxKuchenny(box.id)}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj nóżki</span>
              </li>
            )}
            {/* Cargo */}
            {(() => {
              const cargoEl = children.find((c) => c.type === 'cargo');
              if (cargoEl) {
                return (
                  <li
                    className={`element-item element-item--child ${cargoEl.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(cargoEl.id)}
                  >
                    <span className="element-indent-line" />
                    <span className="element-color" style={{ background: cargoEl.color }} />
                    <span className="element-name">{cargoEl.name}</span>
                    <button
                      className="btn-delete"
                      onClick={(ev) => { ev.stopPropagation(); onDelete(cargoEl.id); }}
                      title="Usuń"
                    >✕</button>
                  </li>
                );
              }
              if (cargoOptions.length > 0) {
                return (
                  <li className="element-item element-item--add" onClick={() => onAddCargoToBox(box.id, pickCargoForBox(cargoOptions, box))}>
                    <span className="element-indent-line" />
                    <span className="element-add-icon">＋</span>
                    <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj cargo</span>
                  </li>
                );
              }
              return null;
            })()}
            {/* System narożny */}
            {(() => {
              const csEl = children.find((c) => c.type === 'cornersystem');
              if (csEl) {
                return (
                  <li
                    className={`element-item element-item--child ${csEl.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(csEl.id)}
                  >
                    <span className="element-indent-line" />
                    <span className="element-color" style={{ background: csEl.color }} />
                    <span className="element-name">{csEl.name}</span>
                    <button className="btn-delete" onClick={(ev) => { ev.stopPropagation(); onDelete(csEl.id); }} title="Usuń">✕</button>
                  </li>
                );
              }
              if (cornerSystemOptions.length > 0) {
                return (
                  <li className="element-item element-item--add" onClick={() => onAddCornerSystemToBox(box.id, pickCornerSystemForBox(cornerSystemOptions, box), 'left')}>
                    <span className="element-indent-line" />
                    <span className="element-add-icon">＋</span>
                    <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj system narożny</span>
                  </li>
                );
              }
              return null;
            })()}
            {/* Blat */}
            <li className="element-item element-item--section">
              <span className="element-section-line" />
              Blat
            </li>
            {countertop ? renderItem(countertop, true) : (
              <li className="element-item element-item--add" onClick={() => {
                onAddCountertopToCabinet(box.id);
              }}>
                <span className="element-indent-line" />
                <span className="element-add-icon">＋</span>
                <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blat</span>
              </li>
            )}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="library">
      {/* Board size */}
      <div className="lib-section-title">Scena</div>
      <div className="board-size-inputs">
        <label className="board-size-field">
          <span>Szer.</span>
          <input
            type="text"
            inputMode="numeric"
            value={draftWidth}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraftWidth(e.target.value)}
            onBlur={(e) => applyWidth(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <span>mm</span>
        </label>
        <label className="board-size-field">
          <span>Gł.</span>
          <input
            type="text"
            inputMode="numeric"
            value={draftDepth}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraftDepth(e.target.value)}
            onBlur={(e) => applyDepth(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <span>mm</span>
        </label>
        <label className="board-size-field">
          <span>Wys.</span>
          <input
            type="text"
            inputMode="numeric"
            value={draftHeight}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraftHeight(e.target.value)}
            onBlur={(e) => applyHeight(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <span>mm</span>
        </label>
      </div>
      <button className="clear-all-btn" onClick={() => setShowClearConfirm(true)} title="Usuń wszystkie elementy z planszy">
        Wyczyść scenę
      </button>
      {showClearConfirm && (
        <ClearAllConfirm
          onConfirm={() => { onClearAll(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      <div className="lib-divider" />

      {/* Catalog */}
      <div className="lib-section-title">Elementy</div>
      <div className="catalog-grid">
        {CATALOG.map((item) => (
          <button
            key={item.type}
            className="catalog-card"
            data-type={item.type}
            onClick={() => onAdd(item.type)}
            title={`Dodaj ${item.label}`}
          >
            {item.icon}
            <span className="catalog-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Połącz / Rozłącz buttons */}
      {(canGroup || elements.some((e) => e.id === selectedId && e.type === 'group')) && (
        <div className="group-bar">
          {canGroup && (
            <button className="btn-group" onClick={() => onGroup(multiSelectedIds)}>
              Połącz ({multiSelectedIds.length})
            </button>
          )}
          {elements.some((e) => e.id === selectedId && e.type === 'group') && (
            <button className="btn-ungroup--bar" onClick={() => onUngroup(selectedId!)}>
              Rozłącz
            </button>
          )}
        </div>
      )}

      <div className="lib-divider" />

      {/* Tree list */}
      <div className="lib-section-title">Dodane</div>
      <ul className="element-list">
        {/* Groups */}
        {groups.map((grp) => {
          const members = elements.filter((e) => e.groupIds?.includes(grp.id) && (e.type === 'cabinet' || e.type === 'boxkuchenny'));
          const groupFronts = elements.filter((e) => e.type === 'front' && e.cabinetId === grp.id);
          const groupMaskowanice = elements.filter((e) => e.type === 'maskowanica' && e.cabinetId === grp.id);
          const isSelected = grp.id === selectedId;
          const groupCountertop = elements.find((e) => e.type === 'countertop' && e.cabinetId === grp.id);
          const isExpanded = isSelected || members.some((m) => m.id === selectedId) ||
            members.some((m) => elements.some((c) => c.cabinetId === m.id && c.id === selectedId)) ||
            groupFronts.some((f) => f.id === selectedId) ||
            groupMaskowanice.some((m) => m.id === selectedId) ||
            groupCountertop?.id === selectedId;
          return (
            <React.Fragment key={grp.id}>
              <li
                className={`element-item group-item ${isSelected ? 'selected' : ''}`}
                onClick={() => { onSelect(grp.id); members.forEach((m) => onMultiSelectToggle(m.id)); }}
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
                  {groupMaskowanice.map((m) => renderItem(m, true))}
                  {members.map((m) => m.type === 'boxkuchenny' ? renderBoxKuchenny(m, true) : renderCabinet(m, true))}

                  {/* Section: Front */}
                  {!groupFronts.length && (
                    <>
                      <li className="element-item element-item--section">
                        <span className="element-section-line" />
                        Front
                      </li>
                      <li className="element-item element-item--add" onClick={() => onAddFrontToGroup(grp.id)}>
                        <span className="element-indent-line" />
                        <span className="element-add-icon">＋</span>
                        <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj front grupy</span>
                      </li>
                      <li className="element-item element-item--add" onClick={() => onAddDoubleFrontToGroup(grp.id)}>
                        <span className="element-indent-line" />
                        <span className="element-add-icon">＋</span>
                        <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj podwójny front grupy</span>
                      </li>
                    </>
                  )}

                  {/* Section: Blenda i cokół grupy */}
                  {(!elements.some((e) => e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group' && e.blendaSide === 'left') ||
                    !elements.some((e) => e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group' && e.blendaSide === 'right') ||
                    !elements.some((e) => e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group' && e.blendaSide === 'top') ||
                    !elements.some((e) => e.type === 'plinth' && e.cabinetId === grp.id)) && (
                    <li className="element-item element-item--section">
                      <span className="element-section-line" />
                      Blenda i cokół grupy
                    </li>
                  )}
                  {elements.filter((e) => (e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group') || (e.type === 'plinth' && e.cabinetId === grp.id)).map((b) => renderItem(b, true))}
                  {!elements.some((e) => e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group' && e.blendaSide === 'left') && (
                    <li className="element-item element-item--add" onClick={() => onAddBlendaToGroup(grp.id, 'left')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blendę lewą grupy</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group' && e.blendaSide === 'right') && (
                    <li className="element-item element-item--add" onClick={() => onAddBlendaToGroup(grp.id, 'right')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blendę prawą grupy</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'blenda' && e.cabinetId === grp.id && e.blendaScope === 'group' && e.blendaSide === 'top') && (
                    <li className="element-item element-item--add" onClick={() => onAddBlendaToGroup(grp.id, 'top')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blendę górną grupy</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'plinth' && e.cabinetId === grp.id) && (
                    <li className="element-item element-item--add" onClick={() => onAddPlinthToGroup(grp.id)}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj cokoł grupy</span>
                    </li>
                  )}

                  {/* Section: Maskowanie */}
                  {(!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'left') ||
                    !elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'right') ||
                    !elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'top') ||
                    !elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'bottom')) && (
                    <li className="element-item element-item--section">
                      <span className="element-section-line" />
                      Maskowanie
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'left') && (
                    <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToGroup(grp.id, 'left')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę lewa grupy</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'right') && (
                    <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToGroup(grp.id, 'right')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę prawa grupy</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'top') && (
                    <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToGroup(grp.id, 'top')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę górna grupy</span>
                    </li>
                  )}
                  {!elements.some((e) => e.type === 'maskowanica' && e.cabinetId === grp.id && e.maskownicaSide === 'bottom') && (
                    <li className="element-item element-item--add" onClick={() => onAddMaskowanicaToGroup(grp.id, 'bottom')}>
                      <span className="element-indent-line" />
                      <span className="element-add-icon">＋</span>
                      <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj maskownicę dolna grupy</span>
                    </li>
                  )}

                  {/* Blat grupy */}
                  <li className="element-item element-item--section">
                    <span className="element-section-line" />
                    Blat
                  </li>
                  {(() => {
                    const grpCt = elements.find((e) => e.type === 'countertop' && e.cabinetId === grp.id);
                    return grpCt ? renderItem(grpCt, true) : (
                      <li className="element-item element-item--add" onClick={() => {
                        onAddCountertopToGroup(grp.id);
                      }}>
                        <span className="element-indent-line" />
                        <span className="element-add-icon">＋</span>
                        <span className="element-name" style={{ color: '#a0a8b0' }}>Dodaj blat grupy</span>
                      </li>
                    );
                  })()}
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* Standalone cabinets */}
        {standaloneCabinets.map((cab) => renderCabinet(cab, false))}

        {/* Free shelves / rods */}
        {freeShelves.map((el) => renderItem(el, false))}

        {/* Boxes kuchenne */}
        {freeBoxesKuchenne.map((box) => renderBoxKuchenny(box))}

        {elements.length === 0 && (
          <li className="element-empty">Brak dodanych elementów.</li>
        )}
      </ul>
    </div>
  );
};

export default ElementLibrary;

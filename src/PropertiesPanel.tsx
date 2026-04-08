import React, { useState, useEffect, useRef } from 'react';
import type { BoxElement, BoxDimensions } from './types';
import type { FinishOption } from './hooks/useFinishes';
import type { HandleOption } from './hooks/useHandles';
import { PANEL_T } from './constants';
import './PropertiesPanel.css';

interface Props {
  element: BoxElement | null;
  elements?: BoxElement[];
  finishes: FinishOption[];
  hdfFinishes: FinishOption[];
  onChange: (id: string, dims: BoxDimensions) => void;
  onYChange?: (id: string, y: number) => void;
  onDividerXChange?: (id: string, x: number) => void;
  hasFront?: boolean;
  onOpenFrontsChange?: (open: boolean) => void;
  onHasBottomPanelChange?: (has: boolean) => void;
  onHasRearHdfChange?: (has: boolean) => void;
  onHasTopRailsChange?: (has: boolean) => void;
  onHasSidePanelsChange?: (has: boolean) => void;
  onDrawerAdjustFrontChange?: (adj: boolean) => void;
  onDrawerFrontHeightChange?: (h: number) => void;
  onDrawerPushToOpenChange?: (v: boolean) => void;
  onShelfSwitchBay?: (id: string) => void;
  onDividerSwitchSlot?: (id: string) => void;
  onMaskownicaNiepelnaChange?: (v: boolean) => void;
  onStretchWithLegsChange?: (v: boolean) => void;
  onFrontNoHandleChange?: (v: boolean) => void;
  onRotate?: (id: string) => void;
  onFinishChange?: (id: string, finishId: string | undefined) => void;
  handles?: HandleOption[];
  onHandleChange?: (id: string, handleId: string | undefined) => void;
}

type DimKey = keyof BoxDimensions;

// Convert metres to mm string for display
const toMm = (m: number) => Math.round(m * 1000).toString();
const fromMm = (mm: string) => parseFloat(mm) / 1000;

const PropertiesPanel: React.FC<Props> = ({ element, elements, finishes, hdfFinishes, onChange, onYChange, onDividerXChange, hasFront, onOpenFrontsChange, onHasBottomPanelChange, onHasTopRailsChange, onHasSidePanelsChange, onDrawerAdjustFrontChange, onDrawerFrontHeightChange, onDrawerPushToOpenChange, onShelfSwitchBay, onDividerSwitchSlot, onMaskownicaNiepelnaChange, onStretchWithLegsChange, onFrontNoHandleChange, onRotate, onFinishChange, handles, onHandleChange }) => {
  const [finishOpen, setFinishOpen] = useState(false);
  const [handleOpen, setHandleOpen] = useState(false);
  const finishRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // Local draft strings so the user can type freely
  const [drafts, setDrafts] = useState<Record<DimKey, string>>({ width: '', height: '', depth: '' });
  const [yDraft, setYDraft] = useState('');
  const [frontHeightDraft, setFrontHeightDraft] = useState('');
  const [distLeftDraft, setDistLeftDraft] = useState('');
  const [distRightDraft, setDistRightDraft] = useState('');

  const getDividerCab = () => element?.type === 'divider' ? elements?.find((e) => e.id === element.cabinetId) : undefined;

  // Sync drafts when element changes (different selection or external update)
  useEffect(() => {
    if (!element) return;
    setFinishOpen(false);
    setHandleOpen(false);
    setDrafts({
      width: toMm(element.dimensions.width),
      height: toMm(element.dimensions.height),
      depth: toMm(element.dimensions.depth),
    });
    setYDraft(toMm(element.position.y));
    if (element.type === 'drawer') {
      setFrontHeightDraft(element.adjustedFrontHeight ? toMm(element.adjustedFrontHeight) : element.frontHeight ? toMm(element.frontHeight) : '170');
    }
    if (element.type === 'divider') {
      const cab = getDividerCab();
      if (cab) {
        const innerLeft = cab.position.x - cab.dimensions.width / 2 + PANEL_T;
        const innerRight = cab.position.x + cab.dimensions.width / 2 - PANEL_T;
        setDistLeftDraft(Math.round((element.position.x - element.dimensions.width / 2 - innerLeft) * 1000).toString());
        setDistRightDraft(Math.round((innerRight - element.position.x - element.dimensions.width / 2) * 1000).toString());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element?.id, element?.dimensions.width, element?.dimensions.height, element?.dimensions.depth, element?.position.y, element?.position.x, (element as BoxElement & { adjustedFrontHeight?: number })?.adjustedFrontHeight]);

  if (!element) {
    return (
      <div className="properties empty">
        <p>Wybierz element, aby edytować jego właściwości.</p>
      </div>
    );
  }

  const getCommonHandleId = (parentId: string) => {
    const fronts = elements?.filter((e) => e.type === 'front' && e.cabinetId === parentId) ?? [];
    return fronts.length > 0 && fronts.every((e) => e.handleId === fronts[0].handleId)
      ? fronts[0].handleId
      : undefined;
  };

  const renderHandleSelector = (currentHandleId: string | undefined, targetId: string) => {
    if (!handles || !onHandleChange) return null;
    const sel = handles.find((h) => h.id === currentHandleId);
    return (
      <>
        <div className="prop-divider" />
        <div className="prop-finish-section">
          <span className="prop-label">Uchwyt (typ)</span>
          <div
            className="prop-finish-dropdown"
            ref={handleRef}
            onBlur={(e) => { if (!handleRef.current?.contains(e.relatedTarget as Node)) setHandleOpen(false); }}
            tabIndex={-1}
          >
            <button
              className="prop-finish-trigger"
              onClick={() => setHandleOpen((o) => !o)}
              type="button"
            >
              {sel?.imageBase64
                ? <img src={sel.imageBase64} alt="" className="prop-finish-thumb" />
                : <span className="prop-finish-no-img" />
              }
              <span className="prop-finish-trigger-label">
                {sel ? `${sel.label} · ${sel.brand}` : 'Nieokreślony'}
              </span>
              <span className="prop-finish-arrow">{handleOpen ? '▲' : '▼'}</span>
            </button>
            {handleOpen && (
              <ul className="prop-finish-list">
                <li
                  className={`prop-finish-item${!currentHandleId ? ' prop-finish-item--active' : ''}`}
                  onClick={() => { onHandleChange(targetId, undefined); setHandleOpen(false); }}
                >
                  <span className="prop-finish-no-img" />
                  <span>Nieokreślony</span>
                </li>
                {handles.map((h) => (
                  <li
                    key={h.id}
                    className={`prop-finish-item${currentHandleId === h.id ? ' prop-finish-item--active' : ''}`}
                    onClick={() => { onHandleChange(targetId, h.id); setHandleOpen(false); }}
                  >
                    {h.imageBase64
                      ? <img src={h.imageBase64} alt="" className="prop-finish-thumb" />
                      : <span className="prop-finish-no-img" />
                    }
                    <span>{h.label} · {h.brand}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  if (element.type === 'group') {
    const w = Math.round(element.dimensions.width * 1000);
    const h = Math.round(element.dimensions.height * 1000);
    const d = Math.round(element.dimensions.depth * 1000);
    return (
      <div className="properties">
        <h2 className="properties-title">{element.name}</h2>
        <div className="properties-hint">Wymiary łączne pogrupowanych boksów</div>
        <div className="prop-row">
          <label className="prop-label" style={{ color: '#ff4444' }}>Szerokość</label>
          <span className="prop-input" style={{ display: 'flex', alignItems: 'center', color: '#d0d0f0' }}>{w}</span>
          <span className="prop-unit">mm</span>
        </div>
        <div className="prop-row">
          <label className="prop-label" style={{ color: '#44ff44' }}>Wysokość</label>
          <span className="prop-input" style={{ display: 'flex', alignItems: 'center', color: '#d0d0f0' }}>{h}</span>
          <span className="prop-unit">mm</span>
        </div>
        <div className="prop-row">
          <label className="prop-label" style={{ color: '#4488ff' }}>Głębokość</label>
          <span className="prop-input" style={{ display: 'flex', alignItems: 'center', color: '#d0d0f0' }}>{d}</span>
          <span className="prop-unit">mm</span>
        </div>
        {hasFront && onOpenFrontsChange && (
          <>
            <div className="prop-divider" />
            <div className="prop-front-state">
              <span className="prop-label" style={{ color: '#c0c0e0' }}>Fronty</span>
              <label className="prop-toggle">
                <input
                  type="checkbox"
                  checked={!!element.openFronts}
                  onChange={(e) => onOpenFrontsChange(e.target.checked)}
                />
                <span className="prop-toggle-track" />
                <span className="prop-toggle-text">{element.openFronts ? 'otwarte' : 'zamknięte'}</span>
              </label>
            </div>
          </>
        )}
        {hasFront && renderHandleSelector(getCommonHandleId(element.id), element.id)}
      </div>
    );
  }

  const commitDim = (axis: DimKey) => {
    const m = fromMm(drafts[axis]);
    if (isNaN(m) || m <= 0) {
      // reset to current value
      setDrafts((d) => ({ ...d, [axis]: toMm(element.dimensions[axis]) }));
      return;
    }
    onChange(element.id, { ...element.dimensions, [axis]: m });
  };

  const commitY = () => {
    const m = fromMm(yDraft);
    if (isNaN(m) || m < 0) { setYDraft(toMm(element.position.y)); return; }
    onYChange?.(element.id, m);
  };

  const labels: Record<DimKey, string> = (element.type === 'shelf' || element.type === 'rod')
    ? { width: 'Szerokość', height: 'Grubość', depth: 'Głębokość' }
    : element.type === 'board'
    ? { width: 'Szerokość', height: 'Wysokość', depth: 'Grubość' }
    : (element.type === 'leg' || element.type === 'drawer' || element.type === 'drawerbox')
    ? { width: 'Szerokość', height: 'Wysokość', depth: 'Głębokość' }
    : { width: 'Szerokość (X)', height: 'Wysokość (Y)', depth: 'Głębokość (Z)' };
  const colors: Record<DimKey, string> = { width: '#cccccc', height: '#cccccc', depth: '#cccccc' };
  const isVerticalSide = (element.type === 'maskowanica' && (element.maskownicaSide === 'left' || element.maskownicaSide === 'right'))
    || (element.type === 'blenda' && (element.blendaSide === 'left' || element.blendaSide === 'right'));

  return (
    <div className="properties">
      <h2 className="properties-title">{element.name}</h2>
      {(element.type === 'shelf' || element.type === 'board' || element.type === 'rod') ? (
        <div className="properties-hint">Ustaw wymiary i pozycję pionową {element.type === 'board' ? 'płyty' : 'półki'}</div>
      ) : element.type === 'drawer' ? (
        <div className="properties-hint">Ustaw wymiary i pozycję pionową szuflady</div>
      ) : element.type === 'drawerbox' ? (
        <div className="properties-hint">Ustaw wymiary i pozycję pionową boxa szuflady</div>
      ) : element.type === 'leg' ? (
        <div className="properties-hint">Zmiana wysokości zsynchronizuje wszystkie nóżki</div>
      ) : (
        <div className="properties-hint">Przeciągnij uchwyty na modelu lub wpisz wartości</div>
      )}

      {element.type === 'divider' && (() => {
        const cab = getDividerCab();
        if (!cab) return null;
        const innerLeft = cab.position.x - cab.dimensions.width / 2 + PANEL_T;
        const innerRight = cab.position.x + cab.dimensions.width / 2 - PANEL_T;
        const commitDistLeft = () => {
          const mm = parseFloat(distLeftDraft);
          if (isNaN(mm)) { setDistLeftDraft(Math.round((element.position.x - element.dimensions.width / 2 - innerLeft) * 1000).toString()); return; }
          const newX = innerLeft + mm / 1000 + element.dimensions.width / 2;
          onDividerXChange?.(element.id, newX);
        };
        const commitDistRight = () => {
          const mm = parseFloat(distRightDraft);
          if (isNaN(mm)) { setDistRightDraft(Math.round((innerRight - element.position.x - element.dimensions.width / 2) * 1000).toString()); return; }
          const newX = innerRight - mm / 1000 - element.dimensions.width / 2;
          onDividerXChange?.(element.id, newX);
        };
        return (
          <>
            <div className="prop-divider" />
            <div className="prop-row">
              <label className="prop-label" style={{ color: '#ffaa44' }}>Od lewej</label>
              <input
                className="prop-input"
                type="number"
                min={0}
                step={1}
                value={distLeftDraft}
                onChange={(e) => setDistLeftDraft(e.target.value)}
                onBlur={commitDistLeft}
                onKeyDown={(e) => { if (e.key === 'Enter') { commitDistLeft(); (e.target as HTMLInputElement).blur(); } }}
              />
              <span className="prop-unit">mm</span>
            </div>
            <div className="prop-row">
              <label className="prop-label" style={{ color: '#ffaa44' }}>Od prawej</label>
              <input
                className="prop-input"
                type="number"
                min={0}
                step={1}
                value={distRightDraft}
                onChange={(e) => setDistRightDraft(e.target.value)}
                onBlur={commitDistRight}
                onKeyDown={(e) => { if (e.key === 'Enter') { commitDistRight(); (e.target as HTMLInputElement).blur(); } }}
              />
              <span className="prop-unit">mm</span>
            </div>
            <div className="prop-divider" />
            {onDividerSwitchSlot && (() => {
              const hasMultipleSlots = elements?.some(
                (e) => e.cabinetId === element.cabinetId && (e.type === 'shelf' || e.type === 'rod')
              );
              if (!hasMultipleSlots) return null;
              return (
                <div className="prop-row">
                  <button className="prop-switch-bay-btn" onClick={() => onDividerSwitchSlot(element.id)}>
                    ↕ Przesuń do kolejnej przestrzeni
                  </button>
                </div>
              );
            })()}
          </>
        );
      })()}

      {element.type === 'drawerbox' && onHasBottomPanelChange && (
        <>
          <div className="prop-divider" />
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Dolna płyta</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!!element.hasBottomPanel}
                onChange={(e) => onHasBottomPanelChange(e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.hasBottomPanel ? 'tak' : 'nie'}</span>
            </label>
          </div>
        </>
      )}
      {element.type === 'drawerbox' && onHasTopRailsChange && (
        <>
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Dodatkowo płyty górne w boxie</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!!element.hasTopRails}
                onChange={(e) => onHasTopRailsChange(e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.hasTopRails ? 'tak' : 'nie'}</span>
            </label>
          </div>
        </>
      )}
      {element.type === 'drawerbox' && element.cabinetId && onHasSidePanelsChange && (() => {
        const hasFronts = elements?.some((e) => e.type === 'front' && e.cabinetId === element.cabinetId);
        if (!hasFronts) return null;
        return (
          <>
            <div className="prop-front-state">
              <span className="prop-label" style={{ color: '#c0c0e0' }}>Blendy boczne</span>
              <label className="prop-toggle">
                <input
                  type="checkbox"
                  checked={element.hasSidePanels !== false}
                  onChange={(e) => onHasSidePanelsChange(e.target.checked)}
                />
                <span className="prop-toggle-track" />
                <span className="prop-toggle-text">{element.hasSidePanels !== false ? 'tak' : 'nie'}</span>
              </label>
            </div>
            <div className="prop-divider" />
          </>
        );
      })()}

      {element.type === 'cabinet' && hasFront && onOpenFrontsChange && (
        <>
          <div className="prop-divider" />
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Fronty</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!!element.openFronts}
                onChange={(e) => onOpenFrontsChange(e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.openFronts ? 'otwarte' : 'zamknięte'}</span>
            </label>
          </div>
          <div className="prop-divider" />
        </>
      )}

      {element.type === 'front' && onFrontNoHandleChange && (
        <>
          <div className="prop-divider" />
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Uchwyt</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!element.noHandle}
                onChange={(e) => onFrontNoHandleChange(!e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.noHandle ? 'brak' : 'tak'}</span>
            </label>
          </div>
          <div className="prop-divider" />
        </>
      )}

      {element.type === 'maskowanica' && onMaskownicaNiepelnaChange && (
        <>
          <div className="prop-divider" />
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Niepełna</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!!element.niepelna}
                onChange={(e) => onMaskownicaNiepelnaChange(e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.niepelna ? 'tak' : 'nie'}</span>
            </label>
          </div>
          <div className="prop-divider" />
        </>
      )}

      {isVerticalSide && onStretchWithLegsChange && (
        <>
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Wydłuż z nóżkami</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!!element.stretchWithLegs}
                onChange={(e) => onStretchWithLegsChange(e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.stretchWithLegs ? 'tak' : 'nie'}</span>
            </label>
          </div>
          <div className="prop-divider" />
        </>
      )}

{(element.type === 'cabinet' || element.type === 'boxkuchenny') && onRotate && (
        <>
          <div className="prop-divider" />
          <div className="prop-row">
            <button className="prop-rotate-btn" onClick={() => onRotate(element.id)}>
              ↻ Obróć o 90°
            </button>
          </div>
          <div className="prop-divider" />
        </>
      )}

      {(['width', 'height', 'depth'] as const).filter((axis) => element.type !== 'leg' || axis === 'height').map((axis) => (
        <div className="prop-row" key={axis}>
          <label className="prop-label" style={{ color: colors[axis] }}>{labels[axis]}</label>
          <input
            className="prop-input"
            type="number"
            min={1}
            step={1}
            value={drafts[axis]}
            onChange={(e) => setDrafts((d) => ({ ...d, [axis]: e.target.value }))}
            onBlur={() => commitDim(axis)}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitDim(axis); (e.target as HTMLInputElement).blur(); } }}
          />
          <span className="prop-unit">mm</span>
        </div>
      ))}

      {(element.type === 'shelf' || element.type === 'board' || element.type === 'rod' || element.type === 'drawer' || element.type === 'drawerbox') && onYChange && (
        <>
          <div className="prop-divider" />
          <div className="prop-row">
            <label className="prop-label" style={{ color: '#ffaa44' }}>Poz. pionowa</label>
            <input
              className="prop-input"
              type="number"
              min={0}
              step={1}
              value={yDraft}
              onChange={(e) => setYDraft(e.target.value)}
              onBlur={commitY}
              onKeyDown={(e) => { if (e.key === 'Enter') { commitY(); (e.target as HTMLInputElement).blur(); } }}
            />
            <span className="prop-unit">mm</span>
          </div>
        </>
      )}
      {element.type === 'drawer' && element.cabinetId && onDrawerAdjustFrontChange && (() => {
        const par = elements?.find((e) => e.id === element.cabinetId);
        if (!par) return null;
        const commitFrontHeight = () => {
          const m = fromMm(frontHeightDraft);
          if (isNaN(m) || m <= 0) { setFrontHeightDraft(element.adjustedFrontHeight ? toMm(element.adjustedFrontHeight) : ''); return; }
          onDrawerFrontHeightChange?.(m);
        };
        return (
          <>
            <div className="prop-divider" />
            <div className="prop-front-state">
              <span className="prop-label" style={{ color: '#c0c0e0' }}>Dostosuj front</span>
              <label className="prop-toggle">
                <input
                  type="checkbox"
                  checked={!!element.adjustedFrontHeight}
                  onChange={(e) => onDrawerAdjustFrontChange(e.target.checked)}
                />
                <span className="prop-toggle-track" />
                <span className="prop-toggle-text">{element.adjustedFrontHeight ? 'tak' : 'nie'}</span>
              </label>
            </div>
            {!element.adjustedFrontHeight && (
              <div className="prop-row">
                <label className="prop-label" style={{ color: '#44ff44' }}>Wys. frontu</label>
                <input
                  className="prop-input"
                  type="number"
                  min={1}
                  step={1}
                  value={frontHeightDraft}
                  onChange={(e) => setFrontHeightDraft(e.target.value)}
                  onBlur={commitFrontHeight}
                  onKeyDown={(e) => { if (e.key === 'Enter') { commitFrontHeight(); (e.target as HTMLInputElement).blur(); } }}
                />
                <span className="prop-unit">mm</span>
              </div>
            )}
          </>
        );
      })()}
      {element.type === 'drawer' && onDrawerPushToOpenChange && (
        <>
          <div className="prop-divider" />
          <div className="prop-front-state">
            <span className="prop-label" style={{ color: '#c0c0e0' }}>Push to open</span>
            <label className="prop-toggle">
              <input
                type="checkbox"
                checked={!!element.pushToOpen}
                onChange={(e) => onDrawerPushToOpenChange(e.target.checked)}
              />
              <span className="prop-toggle-track" />
              <span className="prop-toggle-text">{element.pushToOpen ? 'tak' : 'nie'}</span>
            </label>
          </div>
        </>
      )}
      {(element.type === 'shelf' || element.type === 'rod' || element.type === 'drawer') && element.cabinetId && onShelfSwitchBay && (() => {
        const hasOverlappingDivider = elements?.some(
          (e) => e.cabinetId === element.cabinetId && e.type === 'divider' &&
            element.position.y < e.position.y + e.dimensions.height &&
            element.position.y + element.dimensions.height > e.position.y
        );
        if (!hasOverlappingDivider) return null;
        return (
          <>
            <div className="prop-divider" />
            <div className="prop-row">
              <button className="prop-switch-bay-btn" onClick={() => onShelfSwitchBay(element.id)}>
                ⇄ Przesuń na drugą stronę
              </button>
            </div>
          </>
        );
      })()}

      {onFinishChange && (() => {
        const activeFinishes = element.type === 'hdf' ? hdfFinishes : finishes;
        if (activeFinishes.length === 0) return null;
        const sel = activeFinishes.find((f) => f.id === element.finishId)
          ?? (element.type === 'hdf' ? finishes.find((f) => f.id === element.finishId) : undefined);
        return (
          <>
            <div className="prop-divider" />
            <div className="prop-finish-section">
              <span className="prop-label">Okleina</span>
              <div
                className="prop-finish-dropdown"
                ref={finishRef}
                onBlur={(e) => { if (!finishRef.current?.contains(e.relatedTarget as Node)) setFinishOpen(false); }}
                tabIndex={-1}
              >
                <button
                  className="prop-finish-trigger"
                  onClick={() => setFinishOpen((o) => !o)}
                  type="button"
                >
                  {sel?.imageBase64
                    ? <img src={sel.imageBase64} alt="" className="prop-finish-thumb" />
                    : <span className="prop-finish-no-img" />
                  }
                  <span className="prop-finish-trigger-label">{sel ? `${sel.label} · ${sel.brand}` : 'Nieokreślona'}</span>
                  <span className="prop-finish-arrow">{finishOpen ? '▲' : '▼'}</span>
                </button>
                {finishOpen && (
                  <ul className="prop-finish-list">
                    {activeFinishes.map((f) => (
                      <li
                        key={f.id}
                        className={`prop-finish-item${element.finishId === f.id ? ' prop-finish-item--active' : ''}`}
                        onClick={() => { onFinishChange(element.id, f.id); setFinishOpen(false); }}
                      >
                        {f.imageBase64
                          ? <img src={f.imageBase64} alt="" className="prop-finish-thumb" />
                          : <span className="prop-finish-no-img" />
                        }
                        <span>{f.label} · {f.brand}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {element.type === 'front' && !element.noHandle && renderHandleSelector(element.handleId, element.id)}
    </div>
  );
};

export default PropertiesPanel;

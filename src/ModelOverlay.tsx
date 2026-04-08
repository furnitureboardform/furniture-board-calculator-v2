import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BoxElement } from './types';
import type { SavedModel } from './hooks/useSavedModels';
import './ModelOverlay.css';

interface Props {
  elements: BoxElement[];
  showCeilingGrid?: boolean;
  onToggleCeilingGrid?: (v: boolean) => void;
  savedModels?: SavedModel[];
  modelsLoading?: boolean;
  onSaveModel?: (name: string) => Promise<void>;
  onLoadModel?: (model: SavedModel) => void;
  onDeleteModel?: (id: string) => void;
  onOverwriteModel?: (id: string) => Promise<void>;
  rulerMode?: boolean;
  rulerPointCount?: number;
  rulerDistance?: number | null;
  onToggleRuler?: () => void;
}

type Tab = 'elements';

const PANEL_T_MM = 18; // must match PANEL_T in App.tsx / useThreeScene.ts
const HDF_T_MM          = 3;
const DRW_H_SIDE        = 145;
const DRW_H_BACK        = 100;
const DRW_H_FRONT_INNER = 130;
const DRW_H_FRONT_FACE  = 170;

function getDrawerPanelsDisplay(el: BoxElement): Panel[] {
  const W  = toMm(el.dimensions.width);
  const D  = toMm(el.dimensions.depth);
  const T  = PANEL_T_MM;
  const fW = el.adjustedFrontWidth  ? toMm(el.adjustedFrontWidth)  : (el.parentIsDrawerbox === false ? W : W + 2 * T);
  const fH = el.adjustedFrontHeight ? toMm(el.adjustedFrontHeight) : el.frontHeight ? toMm(el.frontHeight) : DRW_H_FRONT_FACE;
  const extraH = Math.max(0, fH - DRW_H_FRONT_FACE);
  const hSide       = DRW_H_SIDE        + extraH;
  const hBack       = DRW_H_BACK        + extraH;
  const hFrontInner = DRW_H_FRONT_INNER + extraH;
  const sideD = el.parentIsDrawerbox !== false ? D - 10 : D;
  const bottomW = W - 4;
  const bottomD = sideD - 4;
  return [
    { label: 'Bok lewy',        w: T,       h: hSide,       d: sideD },
    { label: 'Bok prawy',       w: T,       h: hSide,       d: sideD },
    { label: 'Dno (HDF)',       w: bottomW, h: HDF_T_MM,    d: bottomD },
    { label: 'Tył',             w: W - 2*T, h: hBack,       d: T     },
    { label: 'Przód wewnętrzny', w: W - 2*T, h: hFrontInner, d: T    },
    { label: 'Front',           w: fW,      h: fH,          d: T     },
  ];
}

const TYPE_LABELS: Partial<Record<BoxElement['type'], string>> = {
  shelf:      'Półka',
  drawer:     'Szuflada',
  drawerbox:  'Box szuflady',
  divider:    'Przegroda',
  front:      'Front',
  rod:        'Drążek',
  leg:        'Nóżki',
  hdf:        'Płyta HDF',
  plinth:     'Cokoł',
  maskowanica: 'Maskowanica',
};

const toMm = (m: number) => Math.round(m * 1000);

interface Panel {
  label: string;
  w: number;
  h: number;
  d: number;
}

function getCabinetPanels(cab: BoxElement): Panel[] {
  const W = toMm(cab.dimensions.width);
  const H = toMm(cab.dimensions.height);
  const D = toMm(cab.dimensions.depth);
  const T = PANEL_T_MM;
  const inner = W - 2 * T;
  return [
    { label: 'Box bok lewy',  w: T,     h: H, d: D },
    { label: 'Box bok prawy', w: T,     h: H, d: D },
    { label: 'Box góra',      w: inner, h: T, d: D },
    { label: 'Box dół',       w: inner, h: T, d: D },
  ];
}

const ModelOverlay: React.FC<Props> = ({
  elements,
  showCeilingGrid,
  onToggleCeilingGrid,
  savedModels = [],
  modelsLoading = false,
  onSaveModel,
  onLoadModel,
  onDeleteModel,
  onOverwriteModel,
  rulerMode,
  rulerPointCount,
  rulerDistance,
  onToggleRuler,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('elements');
  const [modelsOpen, setModelsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [overwritingId, setOverwritingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null);

  const groups              = elements.filter((e) => e.type === 'group');
  const standaloneCabs      = elements.filter((e) => e.type === 'cabinet' && !e.groupIds?.length);
  const totalCabs           = elements.filter((e) => e.type === 'cabinet').length;
  const standaloneBoards    = elements.filter((e) => (e.type === 'board' || e.type === 'shelf') && !e.cabinetId);

  const renderCabinet = (cab: BoxElement, indent = false) => {
    const w = toMm(cab.dimensions.width);
    const h = toMm(cab.dimensions.height);
    const d = toMm(cab.dimensions.depth);

    const all         = elements.filter((e) => e.cabinetId === cab.id && e.type !== 'blenda' && e.type !== 'maskowanica' && e.type !== 'drawer');
    const hdfItems    = all.filter((e) => e.type === 'hdf' || e.type === 'rearboard');
    const boardItems  = all.filter((e) => e.type === 'shelf' || e.type === 'divider');
    const additionals = all.filter((e) => e.type === 'leg' || e.type === 'rod' || e.type === 'plinth');
    const maskowanice = elements.filter((e) => e.cabinetId === cab.id && e.type === 'maskowanica');
    const interiors   = all.filter((e) => e.type === 'drawerbox' || e.type === 'front');
    const directDrawers = elements.filter((e) => e.cabinetId === cab.id && e.type === 'drawer');

    const dimStr = (el: BoxElement) =>
      `${toMm(el.dimensions.width)} × ${toMm(el.dimensions.height)} × ${toMm(el.dimensions.depth)}`;

    return (
      <div key={cab.id} className={`mo-cabinet ${indent ? 'mo-cabinet--indent' : ''}`}>
        <div className="mo-cab-row">
          <span className="mo-color-dot" style={{ background: cab.color }} />
          <span className="mo-cab-name">{cab.name}</span>
          <span className="mo-cab-dims">{w}×{h}×{d}</span>
        </div>

        {/* Płyty: fixed box panels + shelves + dividers */}
        <div className="mo-section">
          <div className="mo-section-label">Płyty</div>
          {getCabinetPanels(cab).map((p) => (
            <div key={p.label} className="mo-panel-row">
              <span className="mo-panel-line" />
              <span className="mo-panel-name">{p.label}</span>
              <span className="mo-panel-dims">{p.w} × {p.h} × {p.d}</span>
            </div>
          ))}
          {boardItems.map((el) => (
            <div key={el.id} className="mo-panel-row">
              <span className="mo-panel-line" />
              <span className="mo-panel-name">{el.name}</span>
              <span className="mo-panel-dims">{dimStr(el)}</span>
            </div>
          ))}
        </div>

        {/* Maskowanice */}
        {maskowanice.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-label">Maskowanice</div>
            {maskowanice.map((el) => (
              <div key={el.id} className="mo-panel-row">
                <span className="mo-panel-line" />
                <span className="mo-panel-name">{el.name}</span>
                <span className="mo-panel-dims">{dimStr(el)}</span>
              </div>
            ))}
          </div>
        )}

        {/* HDF */}
        {hdfItems.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-label">HDF</div>
            {hdfItems.map((el) => (
              <div key={el.id} className="mo-child">
                <span className="mo-child-line" />
                <span className="mo-child-name">{el.name}</span>
                <span className="mo-panel-dims">{dimStr(el)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dodatki */}
        {additionals.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-label">Dodatki</div>
            {additionals.map((el) => (
              <div key={el.id} className="mo-child">
                <span className="mo-child-line" />
                <span className="mo-child-name">{el.name}</span>
                <span className="mo-child-tag">{TYPE_LABELS[el.type] ?? el.type}</span>
              </div>
            ))}
          </div>
        )}

        {/* Elementy (fronts, drawerboxes) */}
        {interiors.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-label">Elementy</div>
            {interiors.map((el) => {
              const dboxDrawers = el.type === 'drawerbox'
                ? elements.filter((e) => e.cabinetId === el.id && e.type === 'drawer')
                : [];
              return (
                <div key={el.id}>
                  <div className="mo-child">
                    <span className="mo-child-line" />
                    <span className="mo-child-name">
                      {el.type === 'front'
                        ? `Front${el.frontSide === 'left' ? ' lewy' : el.frontSide === 'right' ? ' prawy' : ''}`
                        : el.name}
                    </span>
                    {el.type === 'front'
                      ? <span className="mo-panel-dims">{toMm(el.dimensions.width)} × {toMm(el.dimensions.height)}</span>
                      : <span className="mo-child-tag">{TYPE_LABELS[el.type] ?? el.type}</span>}
                  </div>
                  {dboxDrawers.length > 0 && (
                    <div className="mo-section mo-section--nested">
                      <div className="mo-section-label">Szuflady</div>
                      {dboxDrawers.map((drw) => (
                        <div key={drw.id}>
                          <div className="mo-panel-row mo-panel-row--nested">
                            <span className="mo-panel-line" />
                            <span className="mo-panel-name">{drw.name}</span>
                            <span className="mo-panel-dims">{dimStr(drw)}</span>
                          </div>
                          {getDrawerPanelsDisplay(drw).map((p) => (
                            <div key={p.label} className="mo-panel-row mo-panel-row--deep">
                              <span className="mo-panel-line" />
                              <span className="mo-panel-name">{p.label}</span>
                              {p.w === -1
                                ? <span className="mo-panel-dims mo-panel-dims--todo">Do zrobienia</span>
                                : <span className="mo-panel-dims">{p.w} × {p.h} × {p.d}</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {el.type === 'drawerbox' && el.hasRearHdf && (() => {
                    const hW = Math.round(toMm(el.dimensions.width) - 4);
                    const hH = Math.round(toMm(el.dimensions.height) - 4);
                    return (
                      <div className="mo-panel-row mo-panel-row--nested">
                        <span className="mo-panel-line" />
                        <span className="mo-panel-name">HDF tył boxa</span>
                        <span className="mo-panel-dims">{hW} × {hH} × {HDF_T_MM}</span>
                      </div>
                    );
                  })()}
                  {el.type === 'drawerbox' && el.hasTopRails && (() => {
                    const rW = Math.round(toMm(el.dimensions.width) - 2 * PANEL_T_MM);
                    return (
                      <>
                        <div className="mo-panel-row mo-panel-row--nested">
                          <span className="mo-panel-line" />
                          <span className="mo-panel-name">Płyta górna przód</span>
                          <span className="mo-panel-dims">{rW} × {PANEL_T_MM} × 100</span>
                        </div>
                        <div className="mo-panel-row mo-panel-row--nested">
                          <span className="mo-panel-line" />
                          <span className="mo-panel-name">Płyta górna tył</span>
                          <span className="mo-panel-dims">{rW} × {PANEL_T_MM} × 100</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* Szuflady bezpośrednio w gabinecie */}
        {directDrawers.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-label">Szuflady</div>
            {directDrawers.map((drw) => (
              <div key={drw.id}>
                <div className="mo-panel-row">
                  <span className="mo-panel-line" />
                  <span className="mo-panel-name">{drw.name}</span>
                  <span className="mo-panel-dims">{dimStr(drw)}</span>
                </div>
                {getDrawerPanelsDisplay(drw).map((p) => (
                  <div key={p.label} className="mo-panel-row mo-panel-row--nested">
                    <span className="mo-panel-line" />
                    <span className="mo-panel-name">{p.label}</span>
                    {p.w === -1
                      ? <span className="mo-panel-dims mo-panel-dims--todo">Do zrobienia</span>
                      : <span className="mo-panel-dims">{p.w} × {p.h} × {p.d}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleSave = async () => {
    if (!saveName.trim() || !onSaveModel) return;
    setSaving(true);
    try {
      await onSaveModel(saveName.trim());
      setSaveName('');
    } finally {
      setSaving(false);
    }
  };

  const handleOverwrite = async (id: string) => {
    if (!onOverwriteModel) return;
    setOverwritingId(id);
    try {
      await onOverwriteModel(id);
    } finally {
      setOverwritingId(null);
    }
  };

  return (
    <div className="model-overlay">
      <div className="mo-button-row" onMouseDown={(e) => e.stopPropagation()}>
        <button
          className={`mo-ceiling-btn ${showCeilingGrid ? 'mo-ceiling-btn--active' : ''}`}
          onClick={() => onToggleCeilingGrid?.(!showCeilingGrid)}
          title={showCeilingGrid ? 'Ukryj siatkę sufitu' : 'Pokaż siatkę sufitu'}
        >
          ⊞
        </button>
        <button
          className={`mo-ceiling-btn ${rulerMode ? 'mo-ceiling-btn--active' : ''}`}
          onClick={onToggleRuler}
          title="Linijka — mierz odległość (Escape = wyłącz)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="7" width="20" height="10" rx="1.5"/>
            <line x1="6"  y1="7"  x2="6"  y2="12"/>
            <line x1="10" y1="7"  x2="10" y2="11"/>
            <line x1="14" y1="7"  x2="14" y2="12"/>
            <line x1="18" y1="7"  x2="18" y2="11"/>
          </svg>
        </button>
        {rulerMode && (
          <div className="mo-ruler-label">
            {rulerPointCount === 0 && 'Kliknij A'}
            {rulerPointCount === 1 && 'Kliknij B'}
            {rulerDistance !== null && `${rulerDistance} mm`}
          </div>
        )}
        <button
          className={`mo-ceiling-btn ${modelsOpen ? 'mo-ceiling-btn--active' : ''}`}
          onClick={() => setModelsOpen((v) => !v)}
          title={modelsOpen ? 'Zamknij modele' : 'Zapisane modele'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
          </svg>
        </button>
        <button
          className={`mo-toggle ${open ? 'mo-toggle--active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Zamknij panel' : 'Otwórz panel modelu'}
        >
          <span className="mo-toggle-icon">☰</span>
        </button>
      </div>

      {modelsOpen && (
        <div className="mo-panel mo-models-panel">
          <div className="mo-models-header">Zapisane modele</div>
          <div className="mo-models-save-row">
            <input
              className="mo-models-input"
              type="text"
              placeholder="Nazwa modelu..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            <button
              className="mo-models-save-btn"
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
            >
              {saving ? '...' : 'Zapisz'}
            </button>
          </div>
          <div className="mo-models-list">
            {modelsLoading && <div className="mo-empty">Ładowanie...</div>}
            {!modelsLoading && savedModels.length === 0 && (
              <div className="mo-empty">Brak zapisanych modeli.</div>
            )}
            {savedModels.map((m) => (
              <div key={m.id} className="mo-model-row">
                <div className="mo-model-info">
                  <span className="mo-model-name">{m.name}</span>
                  <span className="mo-model-date">
                    {m.createdAt.toLocaleDateString('pl-PL')}
                  </span>
                </div>
                <div className="mo-model-actions">
                  <button
                    className="mo-model-btn mo-model-btn--load"
                    onClick={() => { onLoadModel?.(m); setModelsOpen(false); }}
                    title="Wczytaj model"
                  >
                    ↩
                  </button>
                  <button
                    className="mo-model-btn mo-model-btn--overwrite"
                    onClick={() => setConfirmOverwriteId(m.id)}
                    disabled={overwritingId === m.id}
                    title="Nadpisz model aktualnym stanem"
                  >
                    {overwritingId === m.id ? '...' : '↑'}
                  </button>
                  <button
                    className="mo-model-btn mo-model-btn--delete"
                    onClick={() => setConfirmDeleteId(m.id)}
                    title="Usuń model"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmOverwriteId && (() => {
        const model = savedModels.find((m) => m.id === confirmOverwriteId);
        return createPortal(
          <div className="clear-all-overlay" onClick={() => setConfirmOverwriteId(null)}>
            <div className="clear-all-dialog" onClick={(e) => e.stopPropagation()}>
              <p>Nadpisać model „{model?.name}" aktualnym stanem?</p>
              <div className="clear-all-actions">
                <button className="clear-all-cancel" onClick={() => setConfirmOverwriteId(null)}>Anuluj</button>
                <button className="clear-all-confirm" style={{ background: '#1a2d25', borderColor: '#4ec9b0', color: '#4ec9b0' }}
                  onClick={() => { handleOverwrite(confirmOverwriteId); setConfirmOverwriteId(null); }}>Nadpisz</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {confirmDeleteId && (() => {
        const model = savedModels.find((m) => m.id === confirmDeleteId);
        return createPortal(
          <div className="clear-all-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="clear-all-dialog" onClick={(e) => e.stopPropagation()}>
              <p>Usunąć model „{model?.name}"?</p>
              <div className="clear-all-actions">
                <button className="clear-all-cancel" onClick={() => setConfirmDeleteId(null)}>Anuluj</button>
                <button className="clear-all-confirm" onClick={() => { onDeleteModel?.(confirmDeleteId); setConfirmDeleteId(null); }}>Usuń</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {open && (
        <div className="mo-panel">
          <div className="mo-tab-bar">
            <button
              className={`mo-tab ${tab === 'elements' ? 'mo-tab--active' : ''}`}
              onClick={() => setTab('elements')}
            >
              Elementy
            </button>
          </div>

          <div className="mo-content">
            {tab === 'elements' && (
              <>
                {groups.map((grp) => {
                  const members = elements.filter(
                    (e) => e.groupIds?.includes(grp.id) && e.type === 'cabinet'
                  );
                  return (
                    <div key={grp.id} className="mo-group">
                      <div className="mo-group-header">
                        <span className="mo-group-icon">▤</span>
                        <span className="mo-group-name">{grp.name}</span>
                        <span className="mo-group-count">{members.length} boxy</span>
                      </div>
                      {members.map((cab) => renderCabinet(cab, true))}
                    </div>
                  );
                })}

                {standaloneCabs.map((cab) => renderCabinet(cab, false))}

                {standaloneBoards.length > 0 && (
                  <div className="mo-section">
                    <div className="mo-section-label">Płyty wolnostojące</div>
                    {standaloneBoards.map((el) => (
                      <div key={el.id} className="mo-panel-row">
                        <span className="mo-color-dot" style={{ background: el.color }} />
                        <span className="mo-panel-name">{el.name}</span>
                        <span className="mo-panel-dims">
                          {toMm(el.dimensions.width)} × {toMm(el.dimensions.height)} × {toMm(el.dimensions.depth)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {totalCabs === 0 && standaloneBoards.length === 0 && (
                  <div className="mo-empty">Brak elementów na modelu.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelOverlay;

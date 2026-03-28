import React, { useState } from 'react';
import type { BoxElement } from './types';
import './ModelOverlay.css';

interface Props {
  elements: BoxElement[];
}

type Tab = 'elements';

const PANEL_T_MM = 18; // must match PANEL_T in App.tsx / useThreeScene.ts
const DRW_H_SIDE        = 145;
const DRW_H_BACK        = 100;
const DRW_H_FRONT_INNER = 130;
const DRW_H_FRONT_FACE  = 170;

function getDrawerPanelsDisplay(el: BoxElement): Panel[] {
  const W  = toMm(el.dimensions.width);
  const D  = toMm(el.dimensions.depth);
  const T  = PANEL_T_MM;
  const fW = el.adjustedFrontWidth  ? toMm(el.adjustedFrontWidth)  : (el.parentIsDrawerbox === false ? W : W + 2 * T);
  const fH = el.adjustedFrontHeight ? toMm(el.adjustedFrontHeight) : DRW_H_FRONT_FACE;
  return [
    { label: 'Bok lewy',        w: T,       h: DRW_H_SIDE,        d: D - T },
    { label: 'Bok prawy',       w: T,       h: DRW_H_SIDE,        d: D - T },
    { label: 'Dno',             w: -1,      h: -1,                d: -1    },
    { label: 'Tył',             w: W - 2*T, h: DRW_H_BACK,        d: T     },
    { label: 'Przód wewnętrzny', w: W - 2*T, h: DRW_H_FRONT_INNER, d: T    },
    { label: 'Front',           w: fW,      h: fH,                d: T     },
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

const ModelOverlay: React.FC<Props> = ({ elements }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('elements');

  const groups         = elements.filter((e) => e.type === 'group');
  const standaloneCabs = elements.filter((e) => e.type === 'cabinet' && !e.groupId);
  const totalCabs      = elements.filter((e) => e.type === 'cabinet').length;

  const renderCabinet = (cab: BoxElement, indent = false) => {
    const w = toMm(cab.dimensions.width);
    const h = toMm(cab.dimensions.height);
    const d = toMm(cab.dimensions.depth);

    const all         = elements.filter((e) => e.cabinetId === cab.id && e.type !== 'blenda' && e.type !== 'maskowanica' && e.type !== 'drawer');
    const hdfItems    = all.filter((e) => e.type === 'hdf');
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
                    <span className="mo-child-name">{el.name}</span>
                    <span className="mo-child-tag">{TYPE_LABELS[el.type] ?? el.type}</span>
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

  return (
    <div className="model-overlay">
      <button
        className={`mo-toggle ${open ? 'mo-toggle--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Zamknij panel' : 'Otwórz panel modelu'}
      >
        <span className="mo-toggle-icon">☰</span>
        {!open && totalCabs > 0 && (
          <span className="mo-toggle-badge">{totalCabs}</span>
        )}
      </button>

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
                    (e) => e.groupId === grp.id && e.type === 'cabinet'
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

                {totalCabs === 0 && (
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

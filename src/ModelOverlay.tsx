import React, { useState } from 'react';
import type { BoxElement } from './types';
import './ModelOverlay.css';

interface Props {
  elements: BoxElement[];
}

type Tab = 'elements';

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
  blenda:     'Blenda',
};

const toMm = (m: number) => Math.round(m * 1000);

const ModelOverlay: React.FC<Props> = ({ elements }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('elements');

  const groups          = elements.filter((e) => e.type === 'group');
  const standaloneCabs  = elements.filter((e) => e.type === 'cabinet' && !e.groupId);
  const totalCabs       = elements.filter((e) => e.type === 'cabinet').length;

  const renderChildren = (cabId: string) => {
    const children = elements.filter(
      (e) => e.cabinetId === cabId && e.type !== 'blenda' && e.type !== 'drawer'
    );
    if (children.length === 0) return null;
    return (
      <div className="mo-children">
        {children.map((child) => (
          <div key={child.id} className="mo-child">
            <span className="mo-child-line" />
            <span className="mo-child-name">{child.name}</span>
            <span className="mo-child-tag">{TYPE_LABELS[child.type] ?? child.type}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCabinet = (cab: BoxElement, indent = false) => {
    const w = toMm(cab.dimensions.width);
    const h = toMm(cab.dimensions.height);
    const d = toMm(cab.dimensions.depth);
    return (
      <div key={cab.id} className={`mo-cabinet ${indent ? 'mo-cabinet--indent' : ''}`}>
        <div className="mo-cab-row">
          <span className="mo-color-dot" style={{ background: cab.color }} />
          <span className="mo-cab-name">{cab.name}</span>
          <span className="mo-cab-dims">{w}×{h}×{d}</span>
        </div>
        {renderChildren(cab.id)}
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

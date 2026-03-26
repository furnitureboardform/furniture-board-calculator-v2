import React, { useState, useMemo } from 'react';
import type { BoxElement } from './types';
import { PANEL_T } from './constants';
import './OrderModal.css';

interface Props {
  elements: BoxElement[];
}

// Prices
const PRICE_KORPUS_M2    = 37.85;  // zł/m²
const PRICE_OBICIE_M2    = 46.05;  // zł/m²
const PRICE_CUT_M        = 6.00;   // zł/m (cięcie)
const PRICE_EDGE_SVC_M   = 6.00;   // zł/m (oklejanie – usługa)
const PRICE_OKLEINA_K_M  = 0.95;   // zł/m (okleina korpus)
const PRICE_OKLEINA_O_M  = 1.35;   // zł/m (okleina obicie)
const PRICE_ROD          = 15.00;  // zł/szt

const T = PANEL_T;

interface PanelEntry {
  id: string;
  name: string;
  w: number; // metres
  h: number;
  d: number;
}

/** Two largest dimensions of a panel (the face). */
function faceDims(w: number, h: number, d: number): [number, number] {
  const s = [w, h, d].sort((a, b) => b - a);
  return [s[0], s[1]];
}

function faceArea(w: number, h: number, d: number): number {
  const [a, b] = faceDims(w, h, d);
  return a * b;
}

function cutMeters(w: number, h: number, d: number): number {
  const [a, b] = faceDims(w, h, d);
  return a + b;
}

function edgeMeters(w: number, h: number, d: number): number {
  const [a, b] = faceDims(w, h, d);
  return 2 * (a + b);
}

const mm = (m: number) => Math.round(m * 1000);
const fmt2 = (n: number) => n.toFixed(2);
const fmtPLN = (n: number) => n.toFixed(2) + ' zł';

/** Compute cabinet structural panels (sides + top + bottom). */
function getCabinetStructPanels(cab: BoxElement): PanelEntry[] {
  const W = cab.dimensions.width;
  const H = cab.dimensions.height;
  const D = cab.dimensions.depth;
  const inner = W - 2 * T;
  return [
    { id: cab.id + '_sl', name: `${cab.name} – Bok lewy`,  w: T,     h: H, d: D },
    { id: cab.id + '_sr', name: `${cab.name} – Bok prawy`, w: T,     h: H, d: D },
    { id: cab.id + '_t',  name: `${cab.name} – Góra`,      w: inner, h: T, d: D },
    { id: cab.id + '_b',  name: `${cab.name} – Dół`,       w: inner, h: T, d: D },
  ];
}

function useOrderData(elements: BoxElement[]) {
  return useMemo(() => {
    const korpusPanels: PanelEntry[] = [];
    const obiciePanels: PanelEntry[] = [];
    const hdfPanels: PanelEntry[] = [];
    const rodEls: BoxElement[] = [];

    for (const el of elements) {
      if (el.type === 'cabinet') {
        korpusPanels.push(...getCabinetStructPanels(el));
      } else if (el.type === 'shelf' || el.type === 'divider') {
        korpusPanels.push({ id: el.id, name: el.name, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth });
      } else if (el.type === 'front' || el.type === 'plinth') {
        obiciePanels.push({ id: el.id, name: el.name, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth });
      } else if (el.type === 'hdf') {
        hdfPanels.push({ id: el.id, name: el.name, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth });
      } else if (el.type === 'rod') {
        rodEls.push(el);
      }
    }

    const totalKorpusArea = korpusPanels.reduce((s, p) => s + faceArea(p.w, p.h, p.d), 0);
    const totalObicieArea = obiciePanels.reduce((s, p) => s + faceArea(p.w, p.h, p.d), 0);
    const totalKorpusCut  = korpusPanels.reduce((s, p) => s + cutMeters(p.w, p.h, p.d), 0);
    const totalObicieCut  = obiciePanels.reduce((s, p) => s + cutMeters(p.w, p.h, p.d), 0);
    const totalKorpusEdge = korpusPanels.reduce((s, p) => s + edgeMeters(p.w, p.h, p.d), 0);
    const totalObicieEdge = obiciePanels.reduce((s, p) => s + edgeMeters(p.w, p.h, p.d), 0);
    const rodCount = rodEls.length;

    const costKorpus        = totalKorpusArea * PRICE_KORPUS_M2;
    const costObicie        = totalObicieArea * PRICE_OBICIE_M2;
    const costCutKorpus     = totalKorpusCut  * PRICE_CUT_M;
    const costCutObicie     = totalObicieCut  * PRICE_CUT_M;
    const costEdgeSvcKorpus = totalKorpusEdge * PRICE_EDGE_SVC_M;
    const costEdgeSvcObicie = totalObicieEdge * PRICE_EDGE_SVC_M;
    const costOkleinaK      = totalKorpusEdge * PRICE_OKLEINA_K_M;
    const costOkleinaO      = totalObicieEdge * PRICE_OKLEINA_O_M;
    const costRods          = rodCount * PRICE_ROD;

    const grandTotal =
      costKorpus + costObicie +
      costCutKorpus + costCutObicie +
      costEdgeSvcKorpus + costEdgeSvcObicie +
      costOkleinaK + costOkleinaO +
      costRods;

    return {
      korpusPanels, obiciePanels, hdfPanels, rodEls,
      totalKorpusArea, totalObicieArea,
      totalKorpusCut, totalObicieCut,
      totalKorpusEdge, totalObicieEdge,
      rodCount,
      costKorpus, costObicie,
      costCutKorpus, costCutObicie,
      costEdgeSvcKorpus, costEdgeSvcObicie,
      costOkleinaK, costOkleinaO,
      costRods,
      grandTotal,
    };
  }, [elements]);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const PanelSection: React.FC<{ title: string; panels: PanelEntry[] }> = ({ title, panels }) => (
  <div className="om-section">
    <div className="om-section-title">{title}</div>
    {panels.length === 0 ? (
      <div className="om-empty-row">brak</div>
    ) : (
      panels.map((p) => (
        <div key={p.id} className="om-panel-row">
          <span className="om-panel-name">{p.name}</span>
          <span className="om-panel-dims">{mm(p.w)} × {mm(p.h)} × {mm(p.d)}</span>
          <span className="om-panel-area">{fmt2(faceArea(p.w, p.h, p.d) * 1e4) + ' cm²'}</span>
        </div>
      ))
    )}
  </div>
);

const AdditionalSection: React.FC<{ title: string; items: BoxElement[] }> = ({ title, items }) => (
  <div className="om-section">
    <div className="om-section-title">{title}</div>
    {items.length === 0 ? (
      <div className="om-empty-row">brak</div>
    ) : (
      items.map((el) => (
        <div key={el.id} className="om-panel-row">
          <span className="om-panel-name">{el.name}</span>
        </div>
      ))
    )}
  </div>
);

interface CostRowProps { label: string; meters: number; unit: string; price: number; cost: number; }
const CostRow: React.FC<CostRowProps> = ({ label, meters, unit, price, cost }) => (
  <div className="om-cost-row">
    <span className="om-cost-label">{label}</span>
    <span className="om-cost-qty">{fmt2(meters)} {unit}</span>
    <span className="om-cost-price">{price.toFixed(2)} zł/{unit}</span>
    <span className="om-cost-total">{fmtPLN(cost)}</span>
  </div>
);

interface CostSectionProps { title: string; children: React.ReactNode; subtotal: number; }
const CostSection: React.FC<CostSectionProps> = ({ title, children, subtotal }) => (
  <div className="om-section">
    <div className="om-section-title">{title}</div>
    {children}
    <div className="om-cost-subtotal">
      <span>Razem</span>
      <span>{fmtPLN(subtotal)}</span>
    </div>
  </div>
);

// ── Tabs ───────────────────────────────────────────────────────────────────────

const SummaryTab: React.FC<{ data: ReturnType<typeof useOrderData> }> = ({ data }) => (
  <div className="om-tab-content">
    <PanelSection title="Płyty korpus" panels={data.korpusPanels} />
    <PanelSection title="Płyty obicie" panels={data.obiciePanels} />
    <PanelSection title="Płyta HDF"    panels={data.hdfPanels} />
    <AdditionalSection title="Dodatki" items={data.rodEls} />
  </div>
);

const CostTab: React.FC<{ data: ReturnType<typeof useOrderData> }> = ({ data }) => (
  <div className="om-tab-content">
    <CostSection title="Płyty korpus" subtotal={data.costKorpus}>
      <CostRow label="Płyta korpus" meters={data.totalKorpusArea} unit="m²" price={PRICE_KORPUS_M2} cost={data.costKorpus} />
    </CostSection>

    <CostSection title="Płyty obicie" subtotal={data.costObicie}>
      <CostRow label="Płyta obicie" meters={data.totalObicieArea} unit="m²" price={PRICE_OBICIE_M2} cost={data.costObicie} />
    </CostSection>

    <CostSection
      title="Cięcie płyt"
      subtotal={data.costCutKorpus + data.costCutObicie}
    >
      <CostRow label="Cięcie płyty korpus" meters={data.totalKorpusCut} unit="m" price={PRICE_CUT_M} cost={data.costCutKorpus} />
      <CostRow label="Cięcie płyty obicie" meters={data.totalObicieCut} unit="m" price={PRICE_CUT_M} cost={data.costCutObicie} />
    </CostSection>

    <CostSection
      title="Oklejanie płyt"
      subtotal={data.costEdgeSvcKorpus + data.costEdgeSvcObicie + data.costOkleinaK + data.costOkleinaO}
    >
      <CostRow label="Oklejanie płyty korpus" meters={data.totalKorpusEdge} unit="m" price={PRICE_EDGE_SVC_M}  cost={data.costEdgeSvcKorpus} />
      <CostRow label="Oklejanie płyty obicie" meters={data.totalObicieEdge} unit="m" price={PRICE_EDGE_SVC_M}  cost={data.costEdgeSvcObicie} />
      <CostRow label="Okleina korpus"         meters={data.totalKorpusEdge} unit="m" price={PRICE_OKLEINA_K_M} cost={data.costOkleinaK} />
      <CostRow label="Okleina obicie"         meters={data.totalObicieEdge} unit="m" price={PRICE_OKLEINA_O_M} cost={data.costOkleinaO} />
    </CostSection>

    <CostSection title="Koszty sprzętu" subtotal={data.costRods}>
      <div className="om-cost-row">
        <span className="om-cost-label">Drążek</span>
        <span className="om-cost-qty">{data.rodCount} szt.</span>
        <span className="om-cost-price">{PRICE_ROD.toFixed(2)} zł/szt.</span>
        <span className="om-cost-total">{fmtPLN(data.costRods)}</span>
      </div>
    </CostSection>

    <div className="om-grand-total">
      <span>Łączny koszt</span>
      <span>{fmtPLN(data.grandTotal)}</span>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

type ModalTab = 'summary' | 'cost';

const OrderModal: React.FC<Props> = ({ elements }) => {
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState<ModalTab>('summary');
  const data                = useOrderData(elements);

  const hasCabinets = elements.some((e) => e.type === 'cabinet');

  return (
    <>
      <button
        className="om-fab"
        onClick={() => setOpen(true)}
        title="Generuj zamówienie"
      >
        <span className="om-fab-icon">📋</span>
        <span className="om-fab-label">Zamówienie</span>
      </button>

      {open && (
        <div className="om-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="om-modal">
            <div className="om-modal-header">
              <span className="om-modal-title">Generowanie zamówienia</span>
              <button className="om-modal-close" onClick={() => setOpen(false)} title="Zamknij">✕</button>
            </div>

            <div className="om-tab-bar">
              <button
                className={`om-tab ${tab === 'summary' ? 'om-tab--active' : ''}`}
                onClick={() => setTab('summary')}
              >
                Podsumowanie
              </button>
              <button
                className={`om-tab ${tab === 'cost' ? 'om-tab--active' : ''}`}
                onClick={() => setTab('cost')}
              >
                Koszt
              </button>
            </div>

            <div className="om-modal-body">
              {!hasCabinets ? (
                <div className="om-no-data">Brak elementów na scenie.</div>
              ) : tab === 'summary' ? (
                <SummaryTab data={data} />
              ) : (
                <CostTab data={data} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderModal;

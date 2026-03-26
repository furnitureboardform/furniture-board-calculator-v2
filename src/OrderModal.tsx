import React, { useState, useMemo } from 'react';
import type { BoxElement } from './types';
import { PANEL_T } from './constants';
import './OrderModal.css';

interface Props {
  elements: BoxElement[];
}

// ── Prices ─────────────────────────────────────────────────────────────────────
const PRICE_KORPUS_M2   = 37.85;
const PRICE_OBICIE_M2   = 46.05;
const PRICE_CUT_M       = 6.00;
const PRICE_EDGE_SVC_M  = 6.00;
const PRICE_OKLEINA_K_M = 0.95;
const PRICE_OKLEINA_O_M = 1.35;
const PRICE_ROD         = 15.00;
const PRICE_HINGE       = 13.00;
const PRICE_SLIDE       = 104.00;
const PRICE_COUPLING    = 8.00;
const PRICE_HANDLE      = 46.00;
const PRICE_LEG         = 6.00;

const T = PANEL_T;

// ── Types ──────────────────────────────────────────────────────────────────────
type PanelElemType =
  | 'cabinet_side'
  | 'cabinet_top'
  | 'shelf'
  | 'divider'
  | 'front'
  | 'drawerbox'
  | 'blenda'
  | 'plinth'
  | 'hdf';

interface PanelEntry {
  id: string;
  w: number;
  h: number;
  d: number;
  elemType: PanelElemType;
}

interface GroupedPanel {
  key: string;
  fa: number; // larger face dim in mm
  fb: number; // smaller face dim in mm
  count: number;
  edgeBanding: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const mmV = (m: number) => Math.round(m * 1000);
const fmt2 = (n: number) => n.toFixed(2);
const fmtPLN = (n: number) => n.toFixed(2) + ' zł';
const fmtQty = (qty: number, unit: string) =>
  unit === 'szt.' ? String(Math.round(qty)) : fmt2(qty);

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

function bandedEdgeMeters(p: PanelEntry): number {
  const [fa, fb] = faceDims(p.w, p.h, p.d);
  switch (p.elemType) {
    case 'front':
    case 'drawerbox':   return 2 * (fa + fb);
    case 'cabinet_side':
    case 'divider':
    case 'blenda':      return fa;          // 1 edge (height / largest dim)
    case 'cabinet_top':
    case 'shelf':       return fa;          // 1 edge (width / largest dim)
    case 'plinth':      return fa + 2 * fb; // 3 edges: front + 2 sides
    case 'hdf':         return 0;
    default:            return 0;
  }
}

function getEdgeBanding(p: PanelEntry): string {
  const [fa, fb] = faceDims(p.w, p.h, p.d);
  const mmA = mmV(fa), mmB = mmV(fb);
  switch (p.elemType) {
    case 'front':
    case 'drawerbox':   return 'Wszystkie obrzeża (4 strony)';
    case 'cabinet_side':
    case 'blenda':      return `Obrzeże na wysokości ${mmA} mm (1 bok)`;
    case 'divider':     return `Obrzeże na wysokości ${mmA} mm (1 bok)`;
    case 'cabinet_top':
    case 'shelf':       return `Obrzeże na szerokości ${mmA} mm (1 bok)`;
    case 'plinth':      return `Obrzeże na szerokości ${mmA} mm i na bokach ${mmB} mm (3 boki)`;
    case 'hdf':         return 'Bez obrzeży';
    default:            return 'Bez obrzeży';
  }
}

// ── Cabinet structural panels ──────────────────────────────────────────────────
function getCabinetStructPanels(cab: BoxElement): PanelEntry[] {
  const W = cab.dimensions.width;
  const H = cab.dimensions.height;
  const D = cab.dimensions.depth;
  const inner = W - 2 * T;
  return [
    { id: cab.id + '_sl', w: T,     h: H, d: D, elemType: 'cabinet_side' },
    { id: cab.id + '_sr', w: T,     h: H, d: D, elemType: 'cabinet_side' },
    { id: cab.id + '_t',  w: inner, h: T, d: D, elemType: 'cabinet_top'  },
    { id: cab.id + '_b',  w: inner, h: T, d: D, elemType: 'cabinet_top'  },
  ];
}

// ── Group panels by face dimensions ───────────────────────────────────────────
function groupPanels(panels: PanelEntry[]): GroupedPanel[] {
  const map = new Map<string, GroupedPanel>();
  for (const p of panels) {
    const [fa, fb] = faceDims(p.w, p.h, p.d);
    const key = `${mmV(fa)}x${mmV(fb)}`;
    if (!map.has(key)) {
      map.set(key, { key, fa: mmV(fa), fb: mmV(fb), count: 0, edgeBanding: getEdgeBanding(p) });
    }
    map.get(key)!.count++;
  }
  return Array.from(map.values());
}

// ── Hinge count per door ───────────────────────────────────────────────────────
function hingesForFront(el: BoxElement): number {
  const [fa] = faceDims(el.dimensions.width, el.dimensions.height, el.dimensions.depth);
  return Math.ceil((fa * 1000) / 600);
}

// ── Main data hook ─────────────────────────────────────────────────────────────
function useOrderData(elements: BoxElement[]) {
  return useMemo(() => {
    const korpusPanels: PanelEntry[] = [];
    const obiciePanels: PanelEntry[] = [];
    const hdfPanels: PanelEntry[]    = [];

    for (const el of elements) {
      if (el.type === 'cabinet') {
        korpusPanels.push(...getCabinetStructPanels(el));
      } else if (el.type === 'shelf') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'shelf' });
      } else if (el.type === 'divider') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'divider' });
      } else if (el.type === 'drawerbox') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'drawerbox' });
      } else if (el.type === 'front') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'front' });
      } else if (el.type === 'plinth') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'plinth' });
      } else if (el.type === 'blenda') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'blenda' });
      } else if (el.type === 'hdf') {
        hdfPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'hdf' });
      }
    }

    const korpusGrouped = groupPanels(korpusPanels);
    const obicieGrouped = groupPanels(obiciePanels);
    const hdfGrouped    = groupPanels(hdfPanels);

    // Totals
    const totalKorpusArea = korpusPanels.reduce((s, p) => s + faceArea(p.w, p.h, p.d), 0);
    const totalObicieArea = obiciePanels.reduce((s, p) => s + faceArea(p.w, p.h, p.d), 0);
    const totalKorpusCut  = korpusPanels.reduce((s, p) => s + cutMeters(p.w, p.h, p.d), 0);
    const totalObicieCut  = obiciePanels.reduce((s, p) => s + cutMeters(p.w, p.h, p.d), 0);
    const totalKorpusEdge = korpusPanels.reduce((s, p) => s + bandedEdgeMeters(p), 0);
    const totalObicieEdge = obiciePanels.reduce((s, p) => s + bandedEdgeMeters(p), 0);

    // Hardware counts
    const rodCount      = elements.filter(e => e.type === 'rod').length;
    const hingeCount    = elements.filter(e => e.type === 'front').reduce((s, e) => s + hingesForFront(e), 0);
    const slideCount    = elements.filter(e => e.type === 'drawerbox').length;
    const couplingCount = slideCount;
    const handleCount   = elements.filter(e => e.type === 'front').length;
    const legCount      = elements.filter(e => e.type === 'leg').length * 4;

    // Costs
    const costKorpus        = totalKorpusArea * PRICE_KORPUS_M2;
    const costObicie        = totalObicieArea * PRICE_OBICIE_M2;
    const costCutKorpus     = totalKorpusCut  * PRICE_CUT_M;
    const costCutObicie     = totalObicieCut  * PRICE_CUT_M;
    const costEdgeSvcKorpus = totalKorpusEdge * PRICE_EDGE_SVC_M;
    const costEdgeSvcObicie = totalObicieEdge * PRICE_EDGE_SVC_M;
    const costOkleinaK      = totalKorpusEdge * PRICE_OKLEINA_K_M;
    const costOkleinaO      = totalObicieEdge * PRICE_OKLEINA_O_M;
    const costRods          = rodCount      * PRICE_ROD;
    const costHinges        = hingeCount    * PRICE_HINGE;
    const costSlides        = slideCount    * PRICE_SLIDE;
    const costCouplings     = couplingCount * PRICE_COUPLING;
    const costHandles       = handleCount   * PRICE_HANDLE;
    const costLegs          = legCount      * PRICE_LEG;

    const grandTotal =
      costKorpus + costObicie +
      costCutKorpus + costCutObicie +
      costEdgeSvcKorpus + costEdgeSvcObicie +
      costOkleinaK + costOkleinaO +
      costRods + costHinges + costSlides + costCouplings + costHandles + costLegs;

    return {
      korpusGrouped, obicieGrouped, hdfGrouped,
      totalKorpusArea, totalObicieArea,
      totalKorpusCut, totalObicieCut,
      totalKorpusEdge, totalObicieEdge,
      rodCount, hingeCount, slideCount, couplingCount, handleCount, legCount,
      costKorpus, costObicie,
      costCutKorpus, costCutObicie,
      costEdgeSvcKorpus, costEdgeSvcObicie,
      costOkleinaK, costOkleinaO,
      costRods, costHinges, costSlides, costCouplings, costHandles, costLegs,
      grandTotal,
    };
  }, [elements]);
}

// ── Summary tab sub-components ─────────────────────────────────────────────────

const GroupedSection: React.FC<{ title: string; panels: GroupedPanel[] }> = ({ title, panels }) => (
  <div className="om-section">
    <div className="om-section-title">{title}</div>
    {panels.length === 0 ? (
      <div className="om-empty-row">brak</div>
    ) : (
      <>
        <div className="om-grouped-header">
          <span>Wymiary (mm)</span>
          <span>Ilość</span>
          <span>Obrzeże</span>
        </div>
        {panels.map(g => (
          <div key={g.key} className="om-grouped-row">
            <span className="om-grouped-dims">{g.fa} × {g.fb}</span>
            <span className="om-grouped-qty">{g.count} szt.</span>
            <span className="om-grouped-edge">{g.edgeBanding}</span>
          </div>
        ))}
      </>
    )}
  </div>
);

const AdditionalSection: React.FC<{
  rodCount: number; hingeCount: number; slideCount: number;
  couplingCount: number; handleCount: number; legCount: number;
}> = ({ rodCount, hingeCount, slideCount, couplingCount, handleCount, legCount }) => {
  const items: Array<{ name: string; qty: number; note?: string }> = [];
  if (rodCount > 0)       items.push({ name: 'Drążki',              qty: rodCount });
  if (hingeCount > 0)     items.push({ name: 'Zawiasy',             qty: hingeCount,    note: 'na drzwi (wg wysokości drzwi)' });
  if (slideCount > 0)     items.push({ name: 'Prowadnice przesuwne', qty: slideCount,   note: '1 zestaw na szufladę' });
  if (couplingCount > 0)  items.push({ name: 'Sprzęgła',            qty: couplingCount, note: '1 zestaw na szufladę' });
  if (handleCount > 0)    items.push({ name: 'Uchwyty',             qty: handleCount,   note: '1 na drzwi' });
  if (legCount > 0)       items.push({ name: 'Nóżki',               qty: legCount,      note: '4 na box' });

  return (
    <div className="om-section">
      <div className="om-section-title">Dodatki</div>
      {items.length === 0 ? (
        <div className="om-empty-row">brak</div>
      ) : (
        items.map(item => (
          <div key={item.name} className="om-addon-row">
            <span className="om-addon-name">{item.name}</span>
            <span className="om-addon-qty">{item.qty} szt.</span>
            {item.note && <span className="om-addon-note">{item.note}</span>}
          </div>
        ))
      )}
    </div>
  );
};

const SummaryTab: React.FC<{ data: ReturnType<typeof useOrderData> }> = ({ data }) => (
  <div className="om-tab-content">
    <GroupedSection title="Płyty obicie" panels={data.obicieGrouped} />
    <GroupedSection title="Płyty korpus" panels={data.korpusGrouped} />
    <GroupedSection title="Płyta HDF"   panels={data.hdfGrouped} />
    <AdditionalSection
      rodCount={data.rodCount}
      hingeCount={data.hingeCount}
      slideCount={data.slideCount}
      couplingCount={data.couplingCount}
      handleCount={data.handleCount}
      legCount={data.legCount}
    />
  </div>
);

// ── Cost tab sub-components ────────────────────────────────────────────────────

interface CostRowProps { label: string; qty: number; unit: string; price: number; cost: number; }
const CostRow: React.FC<CostRowProps> = ({ label, qty, unit, price, cost }) => (
  <div className="om-cost-row">
    <span className="om-cost-label">{label}</span>
    <span className="om-cost-qty">{fmtQty(qty, unit)} {unit}</span>
    <span className="om-cost-price">{price.toFixed(2)} zł/{unit}</span>
    <span className="om-cost-total">{fmtPLN(cost)}</span>
  </div>
);

interface CostSectionProps { title: string; children: React.ReactNode; subtotal?: number; }
const CostSection: React.FC<CostSectionProps> = ({ title, children, subtotal }) => (
  <div className="om-section">
    <div className="om-section-title">{title}</div>
    {children}
    {subtotal !== undefined && (
      <div className="om-cost-subtotal">
        <span>Razem</span>
        <span>{fmtPLN(subtotal)}</span>
      </div>
    )}
  </div>
);

// ── Financial summary ──────────────────────────────────────────────────────────

interface FinancialState {
  transport: number;
  nonStandard: number;
  discountPct: number;
  discountFixed: number;
  customerPrice: number;
  customerPriceManual: boolean;
}

interface FinancialSummaryProps {
  grandTotal: number;
  fin: FinancialState;
  setFin: React.Dispatch<React.SetStateAction<FinancialState>>;
}

const FinancialSummary: React.FC<FinancialSummaryProps> = ({ grandTotal, fin, setFin }) => {
  const discountAmt = grandTotal * fin.discountPct / 100 + fin.discountFixed;
  const ownCost     = Math.max(0, grandTotal - discountAmt + fin.transport + fin.nonStandard);
  const autoPrice   = Math.ceil(ownCost * 1.3 / 50) * 50;
  const displayPrice = fin.customerPriceManual ? fin.customerPrice : autoPrice;
  const deposit      = Math.round(displayPrice * 2 / 3 / 50) * 50;

  const set = (key: keyof FinancialState, val: number | boolean) =>
    setFin(prev => ({ ...prev, [key]: val }));

  return (
    <div className="om-section">
      <div className="om-section-title">Podsumowanie finansowe</div>
      <div className="om-fin-grid">
        <div className="om-fin-card">
          <div className="om-fin-label">Transport</div>
          <div className="om-fin-value">
            <input type="number" className="om-fin-input" value={fin.transport} min={0}
              onChange={e => set('transport', Number(e.target.value))} />
            <span className="om-fin-unit">zł</span>
          </div>
        </div>
        <div className="om-fin-card">
          <div className="om-fin-label">Elementy niestandardowe</div>
          <div className="om-fin-value">
            <input type="number" className="om-fin-input" value={fin.nonStandard} min={0}
              onChange={e => set('nonStandard', Number(e.target.value))} />
            <span className="om-fin-unit">zł</span>
          </div>
        </div>
        <div className="om-fin-card">
          <div className="om-fin-label">Rabat %</div>
          <div className="om-fin-value">
            <input type="number" className="om-fin-input" value={fin.discountPct} min={0} max={100}
              onChange={e => set('discountPct', Number(e.target.value))} />
            <span className="om-fin-unit">%</span>
          </div>
        </div>
        <div className="om-fin-card">
          <div className="om-fin-label">Rabat</div>
          <div className="om-fin-value">
            <input type="number" className="om-fin-input" value={fin.discountFixed} min={0}
              onChange={e => set('discountFixed', Number(e.target.value))} />
            <span className="om-fin-unit">zł</span>
          </div>
        </div>
        <div className="om-fin-card om-fin-card--result">
          <div className="om-fin-label">Suma całkowita (koszt własny)</div>
          <div className="om-fin-result">{fmtPLN(ownCost)}</div>
        </div>
        <div className="om-fin-card om-fin-card--highlight">
          <div className="om-fin-label">Cena dla klienta</div>
          <div className="om-fin-value">
            <input type="number" className="om-fin-input om-fin-input--price" value={displayPrice} min={0} step={50}
              onChange={e => setFin(prev => ({ ...prev, customerPrice: Number(e.target.value), customerPriceManual: true }))} />
            <span className="om-fin-unit">zł</span>
          </div>
        </div>
        <div className="om-fin-card om-fin-card--result">
          <div className="om-fin-label">Zaliczka</div>
          <div className="om-fin-result">{fmtPLN(deposit)}</div>
        </div>
      </div>
    </div>
  );
};

const CostTab: React.FC<{
  data: ReturnType<typeof useOrderData>;
  fin: FinancialState;
  setFin: React.Dispatch<React.SetStateAction<FinancialState>>;
}> = ({ data, fin, setFin }) => {
  const hardwareSubtotal =
    data.costRods + data.costHinges + data.costSlides +
    data.costCouplings + data.costHandles + data.costLegs;

  return (
    <div className="om-tab-content">
      <CostSection title="Płyty korpus" subtotal={data.costKorpus}>
        <CostRow label="Płyta korpus" qty={data.totalKorpusArea} unit="m²" price={PRICE_KORPUS_M2} cost={data.costKorpus} />
      </CostSection>

      <CostSection title="Płyty obicie" subtotal={data.costObicie}>
        <CostRow label="Płyta obicie" qty={data.totalObicieArea} unit="m²" price={PRICE_OBICIE_M2} cost={data.costObicie} />
      </CostSection>

      <CostSection title="Cięcie płyt" subtotal={data.costCutKorpus + data.costCutObicie}>
        <CostRow label="Cięcie płyty korpus" qty={data.totalKorpusCut} unit="m" price={PRICE_CUT_M} cost={data.costCutKorpus} />
        <CostRow label="Cięcie płyty obicie" qty={data.totalObicieCut} unit="m" price={PRICE_CUT_M} cost={data.costCutObicie} />
      </CostSection>

      <CostSection
        title="Oklejanie płyt"
        subtotal={data.costEdgeSvcKorpus + data.costEdgeSvcObicie + data.costOkleinaK + data.costOkleinaO}
      >
        <CostRow label="Oklejanie płyty korpus" qty={data.totalKorpusEdge} unit="m" price={PRICE_EDGE_SVC_M}  cost={data.costEdgeSvcKorpus} />
        <CostRow label="Oklejanie płyty obicie" qty={data.totalObicieEdge} unit="m" price={PRICE_EDGE_SVC_M}  cost={data.costEdgeSvcObicie} />
        <CostRow label="Okleina korpus"         qty={data.totalKorpusEdge} unit="m" price={PRICE_OKLEINA_K_M} cost={data.costOkleinaK} />
        <CostRow label="Okleina obicie"         qty={data.totalObicieEdge} unit="m" price={PRICE_OKLEINA_O_M} cost={data.costOkleinaO} />
      </CostSection>

      <CostSection title="Koszty sprzętu" subtotal={hardwareSubtotal}>
        {data.rodCount > 0     && <CostRow label="Drążek"              qty={data.rodCount}      unit="szt." price={PRICE_ROD}      cost={data.costRods} />}
        {data.hingeCount > 0   && <CostRow label="Zawiasy"             qty={data.hingeCount}    unit="szt." price={PRICE_HINGE}    cost={data.costHinges} />}
        {data.slideCount > 0   && <CostRow label="Prowadnice przesuwne" qty={data.slideCount}   unit="szt." price={PRICE_SLIDE}    cost={data.costSlides} />}
        {data.couplingCount > 0 && <CostRow label="Sprzęgła"           qty={data.couplingCount} unit="szt." price={PRICE_COUPLING} cost={data.costCouplings} />}
        {data.handleCount > 0  && <CostRow label="Uchwyty"             qty={data.handleCount}   unit="szt." price={PRICE_HANDLE}   cost={data.costHandles} />}
        {data.legCount > 0     && <CostRow label="Nóżki"               qty={data.legCount}      unit="szt." price={PRICE_LEG}      cost={data.costLegs} />}
        {hardwareSubtotal === 0 && <div className="om-empty-row">brak</div>}
      </CostSection>

      <FinancialSummary grandTotal={data.grandTotal} fin={fin} setFin={setFin} />
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

type ModalTab = 'summary' | 'cost';

const OrderModal: React.FC<Props> = ({ elements }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<ModalTab>('summary');
  const data            = useOrderData(elements);

  const [fin, setFin] = useState<FinancialState>({
    transport: 300,
    nonStandard: 0,
    discountPct: 0,
    discountFixed: 0,
    customerPrice: 0,
    customerPriceManual: false,
  });

  const hasCabinets = elements.some(e => e.type === 'cabinet');

  return (
    <>
      <button className="om-fab" onClick={() => setOpen(true)} title="Generuj zamówienie">
        <span className="om-fab-label">Zamówienie</span>
      </button>

      {open && (
        <div className="om-overlay" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="om-modal">
            <div className="om-modal-header">
              <span className="om-modal-title">Zamówienia</span>
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
                <CostTab data={data} fin={fin} setFin={setFin} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderModal;

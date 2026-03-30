import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BoxElement } from './types';
import { PANEL_T, HDF_T } from './constants';
import './OrderModal.css';

interface Props {
  elements: BoxElement[];
}

// ── Prices ─────────────────────────────────────────────────────────────────────
const PRICE_KORPUS_M2   = 37.85;
const PRICE_HDF_M2      = 11.04;
const PRICE_OBICIE_M2   = 46.05;
const PRICE_CUT_M       = 6.00;
const PRICE_EDGE_SVC_M  = 6.00;
const PRICE_OKLEINA_K_M = 0.95;
const PRICE_OKLEINA_O_M = 1.35;
const PRICE_ROD         = 15.00;
const PRICE_HINGE       = 13.00;
const PRICE_SLIDE       = 104.00;
const PRICE_PTO_SLIDE   = 123.00;
const PRICE_TIPON       = 72.00;
const PRICE_COUPLING    = 8.00;
const PRICE_HANDLE      = 46.00;
const PRICE_LEG         = 6.00;

const T = PANEL_T;

// ── Types ──────────────────────────────────────────────────────────────────────
type PanelElemType =
  | 'cabinet_side'
  | 'cabinet_top'
  | 'shelf'
  | 'board'
  | 'divider'
  | 'front'
  | 'drawerbox'
  | 'drawerbox_rail'
  | 'blenda'
  | 'plinth'
  | 'hdf'
  | 'drawer_side'
  | 'drawer_bottom'
  | 'drawer_back'
  | 'drawer_face'
  | 'maskowanica';

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
    case 'drawerbox':
    case 'drawer_face':  return 2 * (fa + fb);
    case 'drawer_side':  return fa + fb;  // top + front
    case 'drawer_bottom': return fb;      // front edge only
    case 'drawer_back':  return 0;
    case 'cabinet_side':
    case 'divider':
    case 'blenda':
    case 'maskowanica': return fa;          // 1 edge (height / largest dim)
    case 'board':       return 2 * (fa + fb); // 4 edges (all around)
    case 'cabinet_top':
    case 'shelf':       return fa;          // 1 edge (width / largest dim)
    case 'drawerbox_rail': return fa;       // 1 edge (front edge = width)
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
    case 'drawerbox':
    case 'drawer_face':   return 'Wszystkie obrzeża (4 strony)';
    case 'drawer_side':   return `Obrzeże na głębokości ${mmA} mm i na wysokości ${mmB} mm (2 boki)`;
    case 'drawer_bottom': return `Obrzeże na szerokości ${mmB} mm (1 bok)`;
    case 'drawer_back':   return 'Bez obrzeży';
    case 'cabinet_side':
    case 'blenda':
    case 'maskowanica': return `Obrzeże na wysokości ${mmA} mm (1 bok)`;
    case 'divider':     return `Obrzeże na wysokości ${mmA} mm (1 bok)`;
    case 'board':       return 'Wszystkie obrzeża (4 strony)';
    case 'cabinet_top':
    case 'shelf':       return `Obrzeże na szerokości ${mmA} mm (1 bok)`;
    case 'drawerbox_rail': return `Obrzeże na przodzie ${mmA} mm (1 bok)`;
    case 'plinth':      return `Obrzeże na szerokości ${mmA} mm i na bokach ${mmB} mm (3 boki)`;
    case 'hdf':         return 'Bez obrzeży';
    default:            return 'Bez obrzeży';
  }
}

// ── Cabinet structural panels ──────────────────────────────────────────────────
const DRAWER_H_SIDE        = 0.145;
const DRAWER_H_BACK        = 0.100;
const DRAWER_H_FRONT_INNER = 0.130;
const DRAWER_H_FRONT_FACE  = 0.170;

function getDrawerPanels(drawer: BoxElement): { korpus: PanelEntry[]; hdf: PanelEntry; face: PanelEntry } {
  const W = drawer.dimensions.width;
  const D = drawer.dimensions.depth;
  const faceW = drawer.adjustedFrontWidth  ?? (drawer.parentIsDrawerbox === false ? W : W + 2 * T);
  const faceH = drawer.adjustedFrontHeight ?? drawer.frontHeight ?? DRAWER_H_FRONT_FACE;
  const extraH = Math.max(0, faceH - DRAWER_H_FRONT_FACE);
  const hSide       = DRAWER_H_SIDE        + extraH;
  const hBack       = DRAWER_H_BACK        + extraH;
  const hFrontInner = DRAWER_H_FRONT_INNER + extraH;
  const sideD = drawer.parentIsDrawerbox !== false ? D - 0.010 : D;
  return {
    korpus: [
      { id: drawer.id + '_sl', w: T,       h: hSide,       d: sideD,     elemType: 'drawer_side'   },
      { id: drawer.id + '_sr', w: T,       h: hSide,       d: sideD,     elemType: 'drawer_side'   },
      { id: drawer.id + '_bk', w: W - 2*T, h: hBack,       d: T,         elemType: 'drawer_back'   },
      { id: drawer.id + '_fi', w: W - 2*T, h: hFrontInner, d: T,         elemType: 'drawer_back'   },
    ],
    hdf:  { id: drawer.id + '_b',  w: W - 0.004, h: HDF_T,               d: sideD - 0.004, elemType: 'drawer_bottom' },
    face: { id: drawer.id + '_ff', w: faceW, h: faceH, d: T, elemType: 'drawer_face' },
  };
}
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
  const heightMm = el.dimensions.height * 1000;
  return Math.min(5, Math.max(2, Math.ceil(heightMm / 520)));
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
      } else if (el.type === 'board') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'board' });
      } else if (el.type === 'shelf') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'shelf' });
      } else if (el.type === 'divider') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'divider' });
      } else if (el.type === 'drawerbox') {
        const W = el.dimensions.width;
        const H = el.dimensions.height;
        const D = el.dimensions.depth;
        korpusPanels.push({ id: el.id + '_sl', w: T, h: H, d: D, elemType: 'cabinet_side' });
        korpusPanels.push({ id: el.id + '_sr', w: T, h: H, d: D, elemType: 'cabinet_side' });
        if (el.hasBottomPanel) {
          korpusPanels.push({ id: el.id + '_bot', w: W - 2 * T, h: T, d: D, elemType: 'cabinet_top' });
        }
        if (el.hasTopRails) {
          const railW = W - 2 * T;
          korpusPanels.push({ id: el.id + '_rF', w: railW, h: T, d: 0.100, elemType: 'drawerbox_rail' });
          korpusPanels.push({ id: el.id + '_rB', w: railW, h: T, d: 0.100, elemType: 'drawerbox_rail' });
        }
      } else if (el.type === 'drawer') {
        const { korpus, hdf, face } = getDrawerPanels(el);
        korpusPanels.push(...korpus);
        hdfPanels.push({ ...hdf, elemType: 'hdf' });
        obiciePanels.push(face);
      } else if (el.type === 'front') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'front' });
      } else if (el.type === 'plinth') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'plinth' });
      } else if (el.type === 'blenda') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'blenda' });
      } else if (el.type === 'maskowanica') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'maskowanica' });
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
    const totalHdfArea    = hdfPanels.reduce((s, p) => s + faceArea(p.w, p.h, p.d), 0);
    const totalHdfCut     = hdfPanels.reduce((s, p) => s + cutMeters(p.w, p.h, p.d), 0);
    const totalKorpusEdge = korpusPanels.reduce((s, p) => s + bandedEdgeMeters(p), 0);
    const totalObicieEdge = obiciePanels.reduce((s, p) => s + bandedEdgeMeters(p), 0);

    // Hardware counts
    const rodCount      = elements.filter(e => e.type === 'rod').length;
    const hingeCount    = elements.filter(e => e.type === 'front').reduce((s, e) => s + hingesForFront(e), 0);
    const slideCount    = elements.filter(e => e.type === 'drawer' && !e.pushToOpen).length;
    const ptoSlideCount = elements.filter(e => e.type === 'drawer' && !!e.pushToOpen).length;
    const couplingCount = slideCount + ptoSlideCount;
    const handleCount   = elements.filter(e => e.type === 'front').length;
    const legCount      = elements.filter(e => e.type === 'leg').length * 4;

    // Costs
    const costKorpus        = totalKorpusArea * PRICE_KORPUS_M2;
    const costObicie        = totalObicieArea * PRICE_OBICIE_M2;
    const costHdf           = totalHdfArea    * PRICE_HDF_M2;
    const costCutKorpus     = totalKorpusCut  * PRICE_CUT_M;
    const costCutObicie     = totalObicieCut  * PRICE_CUT_M;
    const costCutHdf        = totalHdfCut     * PRICE_CUT_M;
    const costEdgeSvcKorpus = totalKorpusEdge * PRICE_EDGE_SVC_M;
    const costEdgeSvcObicie = totalObicieEdge * PRICE_EDGE_SVC_M;
    const costOkleinaK      = totalKorpusEdge * PRICE_OKLEINA_K_M;
    const costOkleinaO      = totalObicieEdge * PRICE_OKLEINA_O_M;
    const costRods          = rodCount      * PRICE_ROD;
    const costHinges        = hingeCount    * PRICE_HINGE;
    const costSlides        = slideCount    * PRICE_SLIDE;
    const costPtoSlides     = ptoSlideCount * PRICE_PTO_SLIDE;
    const costTipOn         = ptoSlideCount * PRICE_TIPON;
    const costCouplings     = couplingCount * PRICE_COUPLING;
    const costHandles       = handleCount   * PRICE_HANDLE;
    const costLegs          = legCount      * PRICE_LEG;

    const grandTotal =
      costKorpus + costObicie + costHdf +
      costCutKorpus + costCutObicie + costCutHdf +
      costEdgeSvcKorpus + costEdgeSvcObicie +
      costOkleinaK + costOkleinaO +
      costRods + costHinges + costSlides + costPtoSlides + costTipOn + costCouplings + costHandles + costLegs;

    return {
      korpusGrouped, obicieGrouped, hdfGrouped,
      totalKorpusArea, totalObicieArea, totalHdfArea,
      totalKorpusCut, totalObicieCut, totalHdfCut,
      totalKorpusEdge, totalObicieEdge,
      rodCount, hingeCount, slideCount, ptoSlideCount, couplingCount, handleCount, legCount,
      costKorpus, costObicie, costHdf,
      costCutKorpus, costCutObicie, costCutHdf,
      costEdgeSvcKorpus, costEdgeSvcObicie,
      costOkleinaK, costOkleinaO,
      costRods, costHinges, costSlides, costPtoSlides, costTipOn, costCouplings, costHandles, costLegs,
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
  rodCount: number; hingeCount: number; slideCount: number; ptoSlideCount: number;
  couplingCount: number; handleCount: number; legCount: number;
}> = ({ rodCount, hingeCount, slideCount, ptoSlideCount, couplingCount, handleCount, legCount }) => {
  const items: Array<{ name: string; qty: number; note?: string }> = [];
  if (rodCount > 0)       items.push({ name: 'Drążki',              qty: rodCount });
  if (hingeCount > 0)     items.push({ name: 'Zawiasy',             qty: hingeCount,    note: 'na drzwi (wg wysokości drzwi)' });
  if (slideCount > 0)     items.push({ name: 'Prowadnice przesuwne', qty: slideCount,   note: '1 zestaw na szufladę' });
  if (ptoSlideCount > 0)  items.push({ name: 'Prowadnice push to open', qty: ptoSlideCount, note: '1 zestaw na szufladę' });
  if (ptoSlideCount > 0)  items.push({ name: 'TIP-ON BLUMOTION', qty: ptoSlideCount, note: '1 na szufladę' });
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
      ptoSlideCount={data.ptoSlideCount}
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
  const ownCost      = grandTotal + fin.transport + fin.nonStandard;
  const basePrice    = Math.ceil(ownCost * 2 / 100) * 100;
  const margin       = basePrice - ownCost;
  const discountAmt  = margin * fin.discountPct / 100 + fin.discountFixed;
  const autoPrice    = Math.ceil(Math.max(ownCost, basePrice - discountAmt) / 100) * 100;
  const displayPrice = fin.customerPriceManual ? fin.customerPrice : autoPrice;
  const deposit      = Math.ceil(ownCost / 100) * 100;

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
    data.costRods + data.costHinges + data.costSlides + data.costPtoSlides + data.costTipOn +
    data.costCouplings + data.costHandles + data.costLegs;

  return (
    <div className="om-tab-content">
      <CostSection title="Płyty korpus" subtotal={data.costKorpus}>
        <CostRow label="Płyta korpus" qty={data.totalKorpusArea} unit="m²" price={PRICE_KORPUS_M2} cost={data.costKorpus} />
      </CostSection>

      <CostSection title="Płyty obicie" subtotal={data.costObicie}>
        <CostRow label="Płyta obicie" qty={data.totalObicieArea} unit="m²" price={PRICE_OBICIE_M2} cost={data.costObicie} />
      </CostSection>

      <CostSection title="Płyta HDF" subtotal={data.costHdf}>
        <CostRow label="Płyta HDF" qty={data.totalHdfArea} unit="m²" price={PRICE_HDF_M2} cost={data.costHdf} />
      </CostSection>

      <CostSection title="Cięcie płyt" subtotal={data.costCutKorpus + data.costCutObicie + data.costCutHdf}>
        <CostRow label="Cięcie płyty korpus" qty={data.totalKorpusCut} unit="m" price={PRICE_CUT_M} cost={data.costCutKorpus} />
        <CostRow label="Cięcie płyty obicie" qty={data.totalObicieCut} unit="m" price={PRICE_CUT_M} cost={data.costCutObicie} />
        <CostRow label="Cięcie HDF"          qty={data.totalHdfCut}    unit="m" price={PRICE_CUT_M} cost={data.costCutHdf} />
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
        {data.slideCount > 0    && <CostRow label="Prowadnice przesuwne"    qty={data.slideCount}    unit="szt." price={PRICE_SLIDE}    cost={data.costSlides} />}
        {data.ptoSlideCount > 0 && <CostRow label="Prowadnice push to open" qty={data.ptoSlideCount} unit="szt." price={PRICE_PTO_SLIDE} cost={data.costPtoSlides} />}
        {data.ptoSlideCount > 0 && <CostRow label="TIP-ON BLUMOTION"        qty={data.ptoSlideCount} unit="szt." price={PRICE_TIPON}     cost={data.costTipOn} />}
        {data.couplingCount > 0 && <CostRow label="Sprzęgła"               qty={data.couplingCount} unit="szt." price={PRICE_COUPLING} cost={data.costCouplings} />}
        {data.handleCount > 0  && <CostRow label="Uchwyty"             qty={data.handleCount}   unit="szt." price={PRICE_HANDLE}   cost={data.costHandles} />}
        {data.legCount > 0     && <CostRow label="Nóżki"               qty={data.legCount}      unit="szt." price={PRICE_LEG}      cost={data.costLegs} />}
        {hardwareSubtotal === 0 && <div className="om-empty-row">brak</div>}
      </CostSection>

      <FinancialSummary grandTotal={data.grandTotal} fin={fin} setFin={setFin} />
    </div>
  );
};

// ── PDF generation ─────────────────────────────────────────────────────────────

function generatePdf(data: ReturnType<typeof useOrderData>) {
  const sectionHtml = (title: string, panels: GroupedPanel[]) => {
    if (panels.length === 0) return `<h3>${title}</h3><p>brak</p>`;
    const rows = panels.map(g =>
      `<tr><td>${g.fa} × ${g.fb}</td><td>${g.count} szt.</td><td>${g.edgeBanding}</td></tr>`
    ).join('');
    return `
      <h3>${title}</h3>
      <table>
        <thead><tr><th>Wymiary (mm)</th><th>Ilość</th><th>Obrzeże</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const addonItems: Array<{ name: string; qty: number; note?: string }> = [];
  if (data.rodCount > 0)       addonItems.push({ name: 'Drążki', qty: data.rodCount });
  if (data.hingeCount > 0)     addonItems.push({ name: 'Zawiasy', qty: data.hingeCount, note: 'na drzwi (wg wysokości drzwi)' });
  if (data.slideCount > 0)     addonItems.push({ name: 'Prowadnice przesuwne', qty: data.slideCount, note: '1 zestaw na szufladę' });
  if (data.ptoSlideCount > 0)  addonItems.push({ name: 'Prowadnice push to open', qty: data.ptoSlideCount, note: '1 zestaw na szufladę' });
  if (data.ptoSlideCount > 0)  addonItems.push({ name: 'TIP-ON BLUMOTION', qty: data.ptoSlideCount, note: '1 na szufladę' });
  if (data.couplingCount > 0)  addonItems.push({ name: 'Sprzęgła', qty: data.couplingCount, note: '1 zestaw na szufladę' });
  if (data.handleCount > 0)    addonItems.push({ name: 'Uchwyty', qty: data.handleCount, note: '1 na drzwi' });
  if (data.legCount > 0)       addonItems.push({ name: 'Nóżki', qty: data.legCount, note: '4 na box' });

  const addonsHtml = addonItems.length === 0 ? '<p>brak</p>' :
    `<table><tbody>${addonItems.map(i =>
      `<tr><td>${i.name}</td><td>${i.qty} szt.</td><td>${i.note ?? ''}</td></tr>`
    ).join('')}</tbody></table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zamówienie</title><style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
    h2 { margin-bottom: 4px; }
    h3 { margin: 16px 0 4px; font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    th { background: #f0f0f0; }
    p { margin: 4px 0; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
    <h2>Zamówienie – lista płyt</h2>
    ${sectionHtml('Płyty obicie', data.obicieGrouped)}
    ${sectionHtml('Płyty korpus', data.korpusGrouped)}
    ${sectionHtml('Płyta HDF', data.hdfGrouped)}
    <h3>Dodatki</h3>${addonsHtml}
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ── Main component ─────────────────────────────────────────────────────────────

type ModalTab = 'summary' | 'cost';

const OrderModal: React.FC<Props> = ({ elements }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<ModalTab>('summary');
  const data            = useOrderData(elements);

  const [fin, setFin] = useState<FinancialState>({
    transport: 0,
    nonStandard: 0,
    discountPct: 0,
    discountFixed: 0,
    customerPrice: 0,
    customerPriceManual: false,
  });

  const hasCabinets = elements.some(e => e.type === 'cabinet');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const appRoot = document.getElementById('root');
    if (appRoot) (appRoot as any).inert = true;
    modalRef.current?.focus();
    return () => {
      if (appRoot) (appRoot as any).inert = false;
    };
  }, [open]);

  return (
    <>
      <button className="om-fab" onClick={() => setOpen(true)} title="Generuj zamówienie">
        <span className="om-fab-label">Zamówienie</span>
      </button>

      {open && createPortal(
        <div ref={modalRef} className="om-overlay" tabIndex={-1} role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="om-modal">
            <div className="om-modal-header">
              <span className="om-modal-title">Zamówienia</span>
              <div className="om-modal-header-actions">
                {tab === 'summary' && hasCabinets && (
                  <button className="om-pdf-btn" onClick={() => generatePdf(data)} title="Generuj PDF">PDF</button>
                )}
                <button className="om-modal-close" onClick={() => setOpen(false)} title="Zamknij">✕</button>
              </div>
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
      , document.body)}
    </>
  );
};

export default OrderModal;

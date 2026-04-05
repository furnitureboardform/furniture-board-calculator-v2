import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BoxElement } from './types';
import { useFinishes } from './hooks/useFinishes';
import type { FinishOption } from './hooks/useFinishes';
import type { HandleOption } from './hooks/useHandles';
import { PANEL_T, HDF_T } from './constants';
import './OrderModal.css';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell } from 'pdfmake/interfaces';
(pdfMake as any).vfs = (pdfFonts as any).vfs;

interface Props {
  elements: BoxElement[];
  handles: HandleOption[];
}

// ── Prices ─────────────────────────────────────────────────────────────────────
const PRICE_CUT_M       = 6.00;
const PRICE_EDGE_SVC_M  = 6.00;
const PRICE_OKLEINA_M   = 1.00;
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
  finishId?: string;
}

interface GroupedPanel {
  key: string;
  fa: number; // larger face dim in mm
  fb: number; // smaller face dim in mm
  count: number;
  edgeBanding: string;
  finishId?: string;
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
  const fid = drawer.finishId;
  return {
    korpus: [
      { id: drawer.id + '_sl', w: T,       h: hSide,       d: sideD,     elemType: 'drawer_side', finishId: fid },
      { id: drawer.id + '_sr', w: T,       h: hSide,       d: sideD,     elemType: 'drawer_side', finishId: fid },
      { id: drawer.id + '_bk', w: W - 2*T, h: hBack,       d: T,         elemType: 'drawer_back', finishId: fid },
      { id: drawer.id + '_fi', w: W - 2*T, h: hFrontInner, d: T,         elemType: 'drawer_back', finishId: fid },
    ],
    hdf:  { id: drawer.id + '_b',  w: W - 0.004, h: HDF_T, d: sideD - 0.004, elemType: 'drawer_bottom', finishId: fid },
    face: { id: drawer.id + '_ff', w: faceW, h: faceH, d: T, elemType: 'drawer_face', finishId: fid },
  };
}
function getCabinetStructPanels(cab: BoxElement): PanelEntry[] {
  const W = cab.dimensions.width;
  const H = cab.dimensions.height;
  const D = cab.dimensions.depth;
  const inner = W - 2 * T;
  const fid = cab.finishId;
  return [
    { id: cab.id + '_sl', w: T,     h: H, d: D, elemType: 'cabinet_side', finishId: fid },
    { id: cab.id + '_sr', w: T,     h: H, d: D, elemType: 'cabinet_side', finishId: fid },
    { id: cab.id + '_t',  w: inner, h: T, d: D, elemType: 'cabinet_top',  finishId: fid },
    { id: cab.id + '_b',  w: inner, h: T, d: D, elemType: 'cabinet_top',  finishId: fid },
  ];
}

function mergeGroupedPanels(a: GroupedPanel[], b: GroupedPanel[]): GroupedPanel[] {
  return [...a, ...b].reduce<GroupedPanel[]>((acc, p) => {
    const existing = acc.find(x => x.key === p.key);
    if (existing) existing.count += p.count;
    else acc.push({ ...p });
    return acc;
  }, []);
}

// ── Group panels by finish + face dimensions ──────────────────────────────────
function groupPanels(panels: PanelEntry[]): GroupedPanel[] {
  const map = new Map<string, GroupedPanel>();
  for (const p of panels) {
    const [fa, fb] = faceDims(p.w, p.h, p.d);
    const key = `${p.finishId ?? ''}|${mmV(fa)}x${mmV(fb)}`;
    if (!map.has(key)) {
      map.set(key, { key, fa: mmV(fa), fb: mmV(fb), count: 0, edgeBanding: getEdgeBanding(p), finishId: p.finishId });
    }
    map.get(key)!.count++;
  }
  return Array.from(map.values());
}

function buildAreaByFinish(panels: PanelEntry[]): Map<string | undefined, number> {
  const map = new Map<string | undefined, number>();
  for (const p of panels) {
    map.set(p.finishId, (map.get(p.finishId) ?? 0) + faceArea(p.w, p.h, p.d));
  }
  return map;
}

function calcMaterialCost(areaByFinish: Map<string | undefined, number>, finishes: FinishOption[]): number {
  let cost = 0;
  for (const [fid, area] of areaByFinish) {
    const price = finishes.find(f => f.id === fid)?.pricePerSqmPln ?? 0;
    cost += area * price;
  }
  return cost;
}

// ── Hinge count per door ───────────────────────────────────────────────────────
function hingesForFront(el: BoxElement): number {
  const heightMm = el.dimensions.height * 1000;
  return Math.min(5, Math.max(2, Math.ceil(heightMm / 520)));
}

// ── Main data hook ─────────────────────────────────────────────────────────────
function useOrderData(elements: BoxElement[], finishes: FinishOption[], hdfFinishes: FinishOption[], handles: HandleOption[]) {
  return useMemo(() => {
    const korpusPanels: PanelEntry[] = [];
    const obiciePanels: PanelEntry[] = [];
    const hdfPanels: PanelEntry[]    = [];

    for (const el of elements) {
      if (el.type === 'cabinet') {
        korpusPanels.push(...getCabinetStructPanels(el));
      } else if (el.type === 'board') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'board', finishId: el.finishId });
      } else if (el.type === 'shelf') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'shelf', finishId: el.finishId });
      } else if (el.type === 'divider') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'divider', finishId: el.finishId });
      } else if (el.type === 'drawerbox') {
        const W = el.dimensions.width;
        const H = el.dimensions.height;
        const D = el.dimensions.depth;
        const fid = el.finishId;
        korpusPanels.push({ id: el.id + '_sl', w: T, h: H, d: D, elemType: 'cabinet_side', finishId: fid });
        korpusPanels.push({ id: el.id + '_sr', w: T, h: H, d: D, elemType: 'cabinet_side', finishId: fid });
        if (el.hasBottomPanel) {
          korpusPanels.push({ id: el.id + '_bot', w: W - 2 * T, h: T, d: D, elemType: 'cabinet_top', finishId: fid });
        }
        if (el.hasTopRails) {
          const railW = W - 2 * T;
          korpusPanels.push({ id: el.id + '_rF', w: railW, h: T, d: 0.100, elemType: 'drawerbox_rail', finishId: fid });
          korpusPanels.push({ id: el.id + '_rB', w: railW, h: T, d: 0.100, elemType: 'drawerbox_rail', finishId: fid });
        }
      } else if (el.type === 'drawer') {
        const { korpus, hdf, face } = getDrawerPanels(el);
        korpusPanels.push(...korpus);
        hdfPanels.push({ ...hdf, elemType: 'hdf' });
        obiciePanels.push(face);
      } else if (el.type === 'front') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'front', finishId: el.finishId });
      } else if (el.type === 'plinth') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'plinth', finishId: el.finishId });
      } else if (el.type === 'blenda') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'blenda', finishId: el.finishId });
      } else if (el.type === 'maskowanica') {
        obiciePanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'maskowanica', finishId: el.finishId });
      } else if (el.type === 'hdf') {
        hdfPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'hdf', finishId: el.finishId });
      } else if (el.type === 'rearboard') {
        korpusPanels.push({ id: el.id, w: el.dimensions.width, h: el.dimensions.height, d: el.dimensions.depth, elemType: 'cabinet_top', finishId: el.finishId });
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

    const korpusAreaByFinish = buildAreaByFinish(korpusPanels);
    const obicieAreaByFinish = buildAreaByFinish(obiciePanels);
    const hdfAreaByFinish    = buildAreaByFinish(hdfPanels);
    const plytaAreaByFinish  = new Map(korpusAreaByFinish);
    for (const [fid, area] of obicieAreaByFinish) plytaAreaByFinish.set(fid, (plytaAreaByFinish.get(fid) ?? 0) + area);

    // Hardware counts
    const rodCount      = elements.filter(e => e.type === 'rod').length;
    const hingeCount    = elements.filter(e => e.type === 'front').reduce((s, e) => s + hingesForFront(e), 0);
    const slideCount    = elements.filter(e => e.type === 'drawer' && !e.pushToOpen).length;
    const ptoSlideCount = elements.filter(e => e.type === 'drawer' && !!e.pushToOpen).length;
    const couplingCount = slideCount + ptoSlideCount;
    const frontsWithHandle = elements.filter(e => e.type === 'front' && !e.noHandle);
    const legCount      = elements.filter(e => e.type === 'leg').length * 4;

    // Costs
    const costKorpus = calcMaterialCost(korpusAreaByFinish, finishes);
    const costObicie = calcMaterialCost(obicieAreaByFinish, finishes);
    const costHdf           = calcMaterialCost(hdfAreaByFinish, hdfFinishes);
    const costCutKorpus     = totalKorpusCut  * PRICE_CUT_M;
    const costCutObicie     = totalObicieCut  * PRICE_CUT_M;
    const costCutHdf        = totalHdfCut     * PRICE_CUT_M;
    const costEdgeSvcKorpus = totalKorpusEdge * PRICE_EDGE_SVC_M;
    const costEdgeSvcObicie = totalObicieEdge * PRICE_EDGE_SVC_M;
    const costOkleinaK      = totalKorpusEdge * PRICE_OKLEINA_M;
    const costOkleinaO      = totalObicieEdge * PRICE_OKLEINA_M;
    const costRods          = rodCount      * PRICE_ROD;
    const costHinges        = hingeCount    * PRICE_HINGE;
    const costSlides        = slideCount    * PRICE_SLIDE;
    const costPtoSlides     = ptoSlideCount * PRICE_PTO_SLIDE;
    const costTipOn         = ptoSlideCount * PRICE_TIPON;
    const costCouplings     = couplingCount * PRICE_COUPLING;
    const handleMap         = new Map(handles.map(h => [h.id, { label: `${h.label} · ${h.brand}`, pricePln: h.pricePln }]));
    const handleGroupMap    = new Map<string, { id: string; label: string; count: number; cost: number; unitPrice: number }>();
    for (const e of frontsWithHandle) {
      const key = e.handleId ?? '__default__';
      const hd = e.handleId ? handleMap.get(e.handleId) : undefined;
      const unitPrice = hd?.pricePln ?? PRICE_HANDLE;
      const label = hd?.label ?? 'Uchwyt';
      const g = handleGroupMap.get(key);
      if (g) { g.count++; g.cost += unitPrice; }
      else handleGroupMap.set(key, { id: key, label, count: 1, cost: unitPrice, unitPrice });
    }
    const handleGroups      = Array.from(handleGroupMap.values());
    const costHandles       = handleGroups.reduce((s, g) => s + g.cost, 0);
    const costLegs          = legCount      * PRICE_LEG;

    const grandTotal =
      costKorpus + costObicie + costHdf +
      costCutKorpus + costCutObicie + costCutHdf +
      costEdgeSvcKorpus + costEdgeSvcObicie +
      costOkleinaK + costOkleinaO +
      costRods + costHinges + costSlides + costPtoSlides + costTipOn + costCouplings + costHandles + costLegs;

    return {
      hasUnknownFinish:
        korpusGrouped.some(p => isUnknownFinish(p.finishId, finishes)) ||
        obicieGrouped.some(p => isUnknownFinish(p.finishId, finishes)) ||
        hdfGrouped.some(p => isUnknownFinish(p.finishId, finishes)),
      korpusGrouped, obicieGrouped, hdfGrouped,
      totalKorpusArea, totalObicieArea, totalHdfArea,
      totalKorpusCut, totalObicieCut, totalHdfCut,
      totalKorpusEdge, totalObicieEdge,
      hdfAreaByFinish, plytaAreaByFinish,
      rodCount, hingeCount, slideCount, ptoSlideCount, couplingCount, handleGroups, legCount,
      costKorpus, costObicie, costHdf,
      costCutKorpus, costCutObicie, costCutHdf,
      costEdgeSvcKorpus, costEdgeSvcObicie,
      costOkleinaK, costOkleinaO,
      costRods, costHinges, costSlides, costPtoSlides, costTipOn, costCouplings, costHandles, costLegs,
      grandTotal,
    };
  }, [elements, finishes, hdfFinishes, handles]);
}

// ── Summary tab sub-components ─────────────────────────────────────────────────

const GroupedSection: React.FC<{ title: string; panels: GroupedPanel[]; showEdge?: boolean; warning?: boolean }> = ({ title, panels, showEdge = true, warning }) => (
  <div className="om-section">
    <div className={`om-section-title${warning ? ' om-section-title--warning' : ''}`}>{title}</div>
    {panels.length === 0 ? (
      <div className="om-empty-row">brak</div>
    ) : (
      <>
        <div className="om-grouped-header">
          <span>Wymiary (mm)</span>
          <span>Ilość</span>
          {showEdge && <span>Obrzeże</span>}
        </div>
        {panels.map(g => (
          <div key={g.key} className="om-grouped-row">
            <span className="om-grouped-dims">{g.fa} × {g.fb}</span>
            <span className="om-grouped-qty">{g.count} szt.</span>
            {showEdge && <span className="om-grouped-edge">{g.edgeBanding}</span>}
          </div>
        ))}
      </>
    )}
  </div>
);

function finishLabel(finishId: string | undefined, finishes: FinishOption[]): string {
  const f = finishes.find(x => x.id === finishId);
  return f ? `${f.label} · ${f.brand}` : 'Nieznana okleina';
}

function isUnknownFinish(finishId: string | undefined, finishes: FinishOption[]): boolean {
  return !finishes.find(f => f.id === finishId);
}

function groupPanelsByFinish(panels: GroupedPanel[]): Map<string | undefined, GroupedPanel[]> {
  const map = new Map<string | undefined, GroupedPanel[]>();
  for (const p of panels) {
    const key = p.finishId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

const FinishGroupedSections: React.FC<{ baseTitle: string; panels: GroupedPanel[]; finishes: FinishOption[]; showEdge?: boolean }> = ({ baseTitle, panels, finishes, showEdge = true }) => {
  const byFinish = groupPanelsByFinish(panels);
  return (
    <>
      {Array.from(byFinish.entries()).map(([fid, fps]) => (
        <GroupedSection
          key={fid ?? 'none'}
          title={`${baseTitle} · ${finishLabel(fid, finishes)}`}
          warning={isUnknownFinish(fid, finishes)}
          panels={fps}
          showEdge={showEdge}
        />
      ))}
    </>
  );
};

const AdditionalSection: React.FC<{
  rodCount: number; hingeCount: number; slideCount: number; ptoSlideCount: number;
  couplingCount: number; handleGroups: Array<{ label: string; count: number }>; legCount: number;
}> = ({ rodCount, hingeCount, slideCount, ptoSlideCount, couplingCount, handleGroups, legCount }) => {
  const items: Array<{ name: string; qty: number; note?: string }> = [];
  if (rodCount > 0)       items.push({ name: 'Drążki',              qty: rodCount });
  if (hingeCount > 0)     items.push({ name: 'Zawiasy',             qty: hingeCount,    note: 'na drzwi (wg wysokości drzwi)' });
  if (slideCount > 0)     items.push({ name: 'Prowadnice przesuwne', qty: slideCount,   note: '1 zestaw na szufladę' });
  if (ptoSlideCount > 0)  items.push({ name: 'Prowadnice push to open', qty: ptoSlideCount, note: '1 zestaw na szufladę' });
  if (ptoSlideCount > 0)  items.push({ name: 'TIP-ON BLUMOTION', qty: ptoSlideCount, note: '1 na szufladę' });
  if (couplingCount > 0)  items.push({ name: 'Sprzęgła',            qty: couplingCount, note: '1 zestaw na szufladę' });
  for (const g of handleGroups) items.push({ name: g.label, qty: g.count, note: '1 na drzwi' });
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

const SummaryTab: React.FC<{ data: ReturnType<typeof useOrderData>; finishes: FinishOption[] }> = ({ data, finishes }) => (
  <div className="om-tab-content">
    <FinishGroupedSections baseTitle="Płyty obicie" panels={data.obicieGrouped} finishes={finishes} />
    <FinishGroupedSections baseTitle="Płyty korpus" panels={data.korpusGrouped} finishes={finishes} />
    <FinishGroupedSections baseTitle="Płyta HDF"   panels={data.hdfGrouped}    finishes={finishes} showEdge={false} />
    <AdditionalSection
      rodCount={data.rodCount}
      hingeCount={data.hingeCount}
      slideCount={data.slideCount}
      ptoSlideCount={data.ptoSlideCount}
      couplingCount={data.couplingCount}
      handleGroups={data.handleGroups}
      legCount={data.legCount}
    />
  </div>
);

// ── Cost tab sub-components ────────────────────────────────────────────────────

interface CostRowProps { label: string; qty: number; unit: string; price: number; cost: number; warning?: boolean; }
const CostRow: React.FC<CostRowProps> = ({ label, qty, unit, price, cost, warning }) => (
  <div className={`om-cost-row${warning ? ' om-cost-row--warning' : ''}`}>
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

const FinishCostSection: React.FC<{
  title: string;
  areaByFinish: Map<string | undefined, number>;
  subtotal: number;
  finishes: FinishOption[];
  labelFinishes?: FinishOption[];
  defaultLabel: string;
  labelPrefix?: string;
}> = ({ title, areaByFinish, subtotal, finishes, labelFinishes, defaultLabel, labelPrefix }) => (
  <CostSection title={title} subtotal={subtotal}>
    {areaByFinish.size === 0
      ? <div className="om-empty-row">brak</div>
      : Array.from(areaByFinish.entries()).map(([fid, area]) => {
          const finish = finishes.find(f => f.id === fid);
          const labelFinish = labelFinishes ? (labelFinishes.find(f => f.id === fid) ?? finish) : finish;
          const price = finish?.pricePerSqmPln ?? 0;
          const name = labelFinish ? `${labelFinish.label} · ${labelFinish.brand}` : defaultLabel;
          const label = labelPrefix ? `${labelPrefix} · ${name}` : name;
          return <CostRow key={fid ?? 'none'} label={label} qty={area} unit="m²" price={price} cost={area * price} warning={!finish} />;
        })
    }
  </CostSection>
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
  finishes: FinishOption[];
  hdfFinishes: FinishOption[];
}> = ({ data, fin, setFin, finishes, hdfFinishes }) => {
  const hardwareSubtotal =
    data.costRods + data.costHinges + data.costSlides + data.costPtoSlides + data.costTipOn +
    data.costCouplings + data.costHandles + data.costLegs;

  return (
    <div className="om-tab-content">
      <FinishCostSection title="Płyta" areaByFinish={data.plytaAreaByFinish} subtotal={data.costKorpus + data.costObicie}
        finishes={finishes} defaultLabel="Płyta" />

      <FinishCostSection title="Płyta HDF" areaByFinish={data.hdfAreaByFinish} subtotal={data.costHdf}
        finishes={hdfFinishes} labelFinishes={finishes} defaultLabel="Płyta HDF" />

      <CostSection title="Cięcie płyt" subtotal={data.costCutKorpus + data.costCutObicie + data.costCutHdf}>
        <CostRow label="Cięcie płyt"  qty={data.totalKorpusCut + data.totalObicieCut} unit="m" price={PRICE_CUT_M} cost={data.costCutKorpus + data.costCutObicie} />
        <CostRow label="Cięcie HDF"   qty={data.totalHdfCut}                          unit="m" price={PRICE_CUT_M} cost={data.costCutHdf} />
      </CostSection>

      <CostSection
        title="Oklejanie płyt"
        subtotal={data.costEdgeSvcKorpus + data.costEdgeSvcObicie + data.costOkleinaK + data.costOkleinaO}
      >
        <CostRow label="Oklejanie płyt"          qty={data.totalKorpusEdge + data.totalObicieEdge} unit="m" price={PRICE_EDGE_SVC_M}  cost={data.costEdgeSvcKorpus + data.costEdgeSvcObicie} />
        <CostRow label="Okleina"                 qty={data.totalKorpusEdge + data.totalObicieEdge} unit="m" price={PRICE_OKLEINA_M} cost={data.costOkleinaK + data.costOkleinaO} />
      </CostSection>

      <CostSection title="Koszty sprzętu" subtotal={hardwareSubtotal}>
        {data.rodCount > 0     && <CostRow label="Drążek"              qty={data.rodCount}      unit="szt." price={PRICE_ROD}      cost={data.costRods} />}
        {data.hingeCount > 0   && <CostRow label="Zawiasy"             qty={data.hingeCount}    unit="szt." price={PRICE_HINGE}    cost={data.costHinges} />}
        {data.slideCount > 0    && <CostRow label="Prowadnice przesuwne"    qty={data.slideCount}    unit="szt." price={PRICE_SLIDE}    cost={data.costSlides} />}
        {data.ptoSlideCount > 0 && <CostRow label="Prowadnice push to open" qty={data.ptoSlideCount} unit="szt." price={PRICE_PTO_SLIDE} cost={data.costPtoSlides} />}
        {data.ptoSlideCount > 0 && <CostRow label="TIP-ON BLUMOTION"        qty={data.ptoSlideCount} unit="szt." price={PRICE_TIPON}     cost={data.costTipOn} />}
        {data.couplingCount > 0 && <CostRow label="Sprzęgła"               qty={data.couplingCount} unit="szt." price={PRICE_COUPLING} cost={data.costCouplings} />}
        {data.handleGroups.map(g => <CostRow key={g.id} label={g.label} qty={g.count} unit="szt." price={g.unitPrice} cost={g.cost} />)}
        {data.legCount > 0     && <CostRow label="Nóżki"               qty={data.legCount}      unit="szt." price={PRICE_LEG}      cost={data.costLegs} />}
        {hardwareSubtotal === 0 && <div className="om-empty-row">brak</div>}
      </CostSection>

      <FinancialSummary grandTotal={data.grandTotal} fin={fin} setFin={setFin} />
    </div>
  );
};

// ── PDF generation ─────────────────────────────────────────────────────────────

function generatePdf(data: ReturnType<typeof useOrderData>, finishes: FinishOption[]) {
  const sectionHeader = (text: string, warning = false): Content => ({
    text, bold: true, fontSize: 11, margin: [0, 14, 0, 2], ...(warning && { color: '#c0392b' }),
  });

  const panelTable = (panels: GroupedPanel[], showEdge = true): Content => {
    if (panels.length === 0) return { text: 'brak', fontSize: 10, margin: [0, 0, 0, 6] };
    const widths = showEdge ? [160, 50, '*'] : [160, 50];
    const headerCells: TableCell[] = [
      { text: 'Wymiary (mm)', bold: true, fillColor: '#f0f0f0' },
      { text: 'Ilość',        bold: true, fillColor: '#f0f0f0' },
    ];
    if (showEdge) headerCells.push({ text: 'Obrzeże', bold: true, fillColor: '#f0f0f0' });
    const rows: TableCell[][] = panels.map(g => {
      const row: TableCell[] = [{ text: `${g.fa} × ${g.fb}` }, { text: `${g.count} szt.` }];
      if (showEdge) row.push({ text: g.edgeBanding });
      return row;
    });
    return {
      table: { widths, headerRows: 1, body: [headerCells, ...rows] },
      layout: 'lightHorizontalLines',
      fontSize: 10,
      margin: [0, 0, 0, 6],
    };
  };

  const panelSections = (baseTitle: string, panels: GroupedPanel[], showEdge = true): Content[] => {
    const byFinish = groupPanelsByFinish(panels);
    const result: Content[] = [];
    for (const [fid, fps] of byFinish.entries()) {
      const label = finishLabel(fid, finishes);
      result.push(sectionHeader(`${baseTitle} · ${label}`, isUnknownFinish(fid, finishes)), panelTable(fps, showEdge));
    }
    if (panels.length === 0) result.push(sectionHeader(baseTitle), panelTable([], showEdge));
    return result;
  };

  const addonRows: string[][] = [];
  if (data.rodCount > 0)       addonRows.push(['Drążki',                   `${data.rodCount} szt.`,      '']);
  if (data.hingeCount > 0)     addonRows.push(['Zawiasy',                  `${data.hingeCount} szt.`,    'na drzwi (wg wysokości drzwi)']);
  if (data.slideCount > 0)     addonRows.push(['Prowadnice przesuwne',     `${data.slideCount} szt.`,    '1 zestaw na szufladę']);
  if (data.ptoSlideCount > 0)  addonRows.push(['Prowadnice push to open',  `${data.ptoSlideCount} szt.`, '1 zestaw na szufladę']);
  if (data.ptoSlideCount > 0)  addonRows.push(['TIP-ON BLUMOTION',         `${data.ptoSlideCount} szt.`, '1 na szufladę']);
  if (data.couplingCount > 0)  addonRows.push(['Sprzęgła',                 `${data.couplingCount} szt.`, '1 zestaw na szufladę']);
  for (const g of data.handleGroups) addonRows.push([g.label, `${g.count} szt.`, '1 na drzwi']);
  if (data.legCount > 0)       addonRows.push(['Nóżki',                    `${data.legCount} szt.`,      '4 na box']);

  const addonsContent: Content = addonRows.length === 0
    ? { text: 'brak', fontSize: 10 }
    : { table: { widths: [160, 50, '*'], body: addonRows }, layout: 'lightHorizontalLines', fontSize: 10 };

  pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    content: [
      ...panelSections('Płyta', mergeGroupedPanels(data.obicieGrouped, data.korpusGrouped)),
      ...panelSections('Płyta HDF', data.hdfGrouped, false),
      sectionHeader('Dodatki'),
      addonsContent,
    ],
  }).download('zamowienie.pdf');
}

// ── Main component ─────────────────────────────────────────────────────────────

type ModalTab = 'summary' | 'cost';

const OrderModal: React.FC<Props> = ({ elements, handles }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<ModalTab>('summary');
  const finishesBase    = useFinishes();
  const finishesHdf     = useFinishes('hdf', false);
  const finishes        = useMemo(() => [...finishesBase, ...finishesHdf], [finishesBase, finishesHdf]);
  const data            = useOrderData(elements, finishes, finishesHdf, handles);

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
                  <button
                    className="om-pdf-btn"
                    onClick={() => generatePdf(data, finishes)}
                    disabled={data.hasUnknownFinish}
                    title={data.hasUnknownFinish ? 'Uzupełnij okleiny przed generowaniem PDF' : 'Generuj PDF'}
                  >PDF</button>
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
                <SummaryTab data={data} finishes={finishes} />
              ) : (
                <CostTab data={data} fin={fin} setFin={setFin} finishes={finishes} hdfFinishes={finishesHdf} />
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
};

export default OrderModal;

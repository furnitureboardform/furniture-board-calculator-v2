import * as THREE from 'three';
import type { BoxElement } from './types';
import { HDF_T } from './constants';

const PANEL_T = 0.018;
export const HDF_GRAY = '#8a8a8a';
const HDF_COLOR = new THREE.Color(HDF_GRAY);
const ROD_RADIUS = 0.0125;
const LEG_RADIUS = 0.02;
const LEG_CORNER_OFFSET = 0.03;

export function elementHasHandle(e: BoxElement): boolean {
  if (e.type === 'drawer') return e.noHandle === false;
  return !e.noHandle;
}

function addHandle(parent: THREE.Mesh, geo: THREE.BoxGeometry, x: number, y: number, z: number, elementId: string) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 });
  const handle = new THREE.Mesh(geo, mat);
  handle.position.set(x, y, z);
  handle.userData = { elementId };
  parent.add(handle);
}

/** Remove non-handle children from a parent mesh, disposing geometry and material. */
function clearChildren(parent: THREE.Mesh) {
  parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry.dispose();
      const mat = c.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      Array.isArray(mat) ? mat.forEach(m => m.dispose()) : mat.dispose();
    }
    parent.remove(c);
  });
}

export function rebuildPanels(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  const { width, height, depth } = element.dimensions;
  const t = PANEL_T;
  clearChildren(parent);

  const innerW = width - 2 * t;
  const panels = [
    { w: t,      h: height,  d: depth, px: -width / 2 + t / 2, py: 0,                    pz: 0 },
    { w: t,      h: height,  d: depth, px:  width / 2 - t / 2, py: 0,                    pz: 0 },
    { w: innerW, h: t,       d: depth, px: 0,                   py:  height / 2 - t / 2,  pz: 0 },
    { w: innerW, h: t,       d: depth, px: 0,                   py: -height / 2 + t / 2,  pz: 0 },
  ];

  for (const p of panels) {
    const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(geo, mat);
    panel.position.set(p.px, p.py, p.pz);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData = { elementId: element.id };
    parent.add(panel);
  }
}

export function rebuildShelf(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(geo, mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildDrawer(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color, frontColor?: THREE.Color) {
  clearChildren(parent);
  const { width, depth } = element.dimensions;
  const t = PANEL_T;
  const H_SIDE        = 0.145;
  const H_BACK        = 0.100;
  const H_FRONT_INNER = 0.130;
  const H_FRONT_FACE  = 0.170;
  const isExt = element.externalFront === true;
  const faceW = element.adjustedFrontWidth  ?? (element.parentIsDrawerbox === false ? width : width + 2 * t);
  const faceH = element.adjustedFrontHeight ?? element.frontHeight ?? H_FRONT_FACE;
  const extraH = isExt ? 0 : Math.max(0, faceH - H_FRONT_FACE);
  const hSide       = H_SIDE        + extraH;
  const hBack       = H_BACK        + extraH;
  const hFrontInner = H_FRONT_INNER + extraH;
  const makeMat = (c: THREE.Color) => new THREE.MeshStandardMaterial({ color: c, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const addPanel = (w: number, h: number, d: number, px: number, py: number, pz: number, c?: THREE.Color) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(c ?? color));
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { elementId: element.id };
    parent.add(mesh);
  };
  const hdf = HDF_T;
  const bottomW = width - 0.004;
  const sideD = element.parentIsDrawerbox !== false ? depth - 0.010 : depth;
  const bottomD = sideD - 0.004;
  const sidePz = depth / 2 - sideD / 2;
  addPanel(t, hSide, sideD, -(width / 2 - t / 2), (hSide - H_SIDE) / 2, sidePz);
  addPanel(t, hSide, sideD,  (width / 2 - t / 2), (hSide - H_SIDE) / 2, sidePz);
  addPanel(bottomW, hdf, bottomD, 0, -(H_SIDE / 2 - hdf / 2), -t / 2);
  addPanel(width - 2 * t, hBack, t, 0, (hBack - H_SIDE) / 2, -(depth / 2 - t / 2));
  addPanel(width - 2 * t, hFrontInner, t, 0, (hFrontInner - H_SIDE) / 2, depth / 2 - t / 2);
  const faceY = isExt ? 0 : (faceH - H_SIDE) / 2;
  addPanel(faceW, faceH, t, 0, faceY, depth / 2 + t / 2, frontColor);
  if (elementHasHandle(element)) {
    const handleLength = Math.min(faceW * 0.4, 0.150);
    addHandle(parent, new THREE.BoxGeometry(handleLength, 0.012, 0.012), 0, faceY, depth / 2 + t + 0.007, element.id);
  }
}

export function rebuildDrawerbox(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const t = PANEL_T;
  const makeMat = () => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const addP = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat());
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { elementId: element.id };
    parent.add(m);
  };
  addP(t, height, depth, -(width / 2 - t / 2), 0, 0);
  addP(t, height, depth, (width / 2 - t / 2), 0, 0);
  if (element.hasBottomPanel) {
    addP(width - 2 * t, t, depth, 0, -(height / 2 - t / 2), 0);
  }
  if (element.hasTopRails) {
    const railW = width - 2 * t;
    const railD = 0.100;
    const railY = height / 2 - t / 2;
    addP(railW, t, railD, 0, railY,  depth / 2 - railD / 2);
    addP(railW, t, railD, 0, railY, -depth / 2 + railD / 2);
  }
}

export function rebuildBlenda(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(geo, mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildPlinth(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(geo, mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildDivider(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(geo, mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildFront(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.3, metalness: 0.15,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });
  const panel = new THREE.Mesh(geo, mat);
  panel.userData = { elementId: element.id };
  parent.add(panel);

  if (elementHasHandle(element)) {
    const handleLength = Math.min(height * 0.4, 0.128);
    const handleX = element.frontSide === 'right' ? -(width / 2 - 0.05) : width / 2 - 0.05;
    addHandle(parent, new THREE.BoxGeometry(0.012, handleLength, 0.012), handleX, 0, depth / 2 + 0.007, element.id);
  }
}

export function rebuildHdf(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const backMat   = new THREE.MeshStandardMaterial({ color: HDF_COLOR, emissive, roughness: 0.6, metalness: 0.05 });
  const insideMat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.6, metalness: 0.05 });
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front/inside), -Z (back/outside)
  const mats = [backMat, backMat, backMat, backMat, insideMat, backMat];
  const panel = new THREE.Mesh(geo, mats);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildRod(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const geo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, element.dimensions.width, 24);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.25, metalness: 0.7,
  });
  const rod = new THREE.Mesh(geo, mat);
  rod.rotation.z = Math.PI / 2;
  rod.castShadow = true;
  rod.receiveShadow = true;
  rod.userData = { elementId: element.id };
  parent.add(rod);
}

export function rebuildMaskowanica(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(geo, mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildBoxKuchenny(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  const { width, height, depth } = element.dimensions;
  const t = PANEL_T;
  const RAIL_D = 0.100;
  clearChildren(parent);

  const innerW = width - 2 * t;
  const panels = [
    { w: t,      h: height, d: depth,  px: -width / 2 + t / 2, py: 0,                   pz: 0 },
    { w: t,      h: height, d: depth,  px:  width / 2 - t / 2, py: 0,                   pz: 0 },
    { w: innerW, h: t,      d: depth,  px: 0,                   py: -height / 2 + t / 2, pz: 0 },
    { w: innerW, h: t,      d: RAIL_D, px: 0,                   py:  height / 2 - t / 2, pz:  depth / 2 - RAIL_D / 2 },
    { w: innerW, h: t,      d: RAIL_D, px: 0,                   py:  height / 2 - t / 2, pz: -depth / 2 + RAIL_D / 2 },
  ];

  for (const p of panels) {
    const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(geo, mat);
    panel.position.set(p.px, p.py, p.pz);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData = { elementId: element.id };
    parent.add(panel);
  }
}

export function rebuildRearboard(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(geo, mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildLeg(parent: THREE.Mesh, element: BoxElement, _color: THREE.Color, _emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, height, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x111111), emissive: new THREE.Color(0x000000), roughness: 0.4, metalness: 0.3,
  });
  const ox = width  / 2 - LEG_CORNER_OFFSET;
  const oz = depth  / 2 - LEG_CORNER_OFFSET;
  const corners: [number, number][] = [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]];
  for (const [cx, cz] of corners) {
    const leg = new THREE.Mesh(geo, mat);
    leg.position.set(cx, 0, cz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    leg.userData = { elementId: element.id };
    parent.add(leg);
  }
}

import * as THREE from 'three';
import type { BoxElement } from './types';

const PANEL_T = 0.018;
const PANEL_COLOR = new THREE.Color(0xc8a97a);
const HDF_COLOR = new THREE.Color(0x5c4033);
const ROD_RADIUS = 0.0125;
const LEG_RADIUS = 0.02;
const LEG_CORNER_OFFSET = 0.03;

/** Remove non-handle children from a parent mesh, disposing geometry and material. */
function clearChildren(parent: THREE.Mesh) {
  parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry.dispose();
      (c.material as THREE.MeshStandardMaterial).dispose();
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

export function rebuildDrawer(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, depth } = element.dimensions;
  const t = PANEL_T;
  const H_SIDE        = 0.145;
  const H_BACK        = 0.100;
  const H_FRONT_INNER = 0.130;
  const H_FRONT_FACE  = 0.170;
  const makeMat = () => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const addPanel = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat());
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { elementId: element.id };
    parent.add(mesh);
  };
  addPanel(t, H_SIDE, depth - t, -(width / 2 - t / 2), 0, -t / 2);
  addPanel(t, H_SIDE, depth - t,  (width / 2 - t / 2), 0, -t / 2);
  addPanel(width - 2 * t, t, depth - t, 0, -(H_SIDE / 2 - t / 2), -t / 2);
  addPanel(width - 2 * t, H_BACK, t, 0, (H_BACK - H_SIDE) / 2, -(depth / 2 - t / 2));
  addPanel(width - 2 * t, H_FRONT_INNER, t, 0, (H_FRONT_INNER - H_SIDE) / 2, depth / 2 - t / 2);
  addPanel(width + 2 * t - 0.004, H_FRONT_FACE, t, 0, (H_FRONT_FACE - H_SIDE) / 2, depth / 2 + t / 2);
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
  addP(width - 2 * t, t, depth, 0, height / 2 - t / 2, 0);
  if (element.hasBottomPanel) {
    addP(width - 2 * t, t, depth, 0, -(height / 2 - t / 2), 0);
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

export function rebuildFront(parent: THREE.Mesh, element: BoxElement, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: PANEL_COLOR, emissive, roughness: 0.3, metalness: 0.15,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });
  const panel = new THREE.Mesh(geo, mat);
  panel.userData = { elementId: element.id };
  parent.add(panel);
}

export function rebuildHdf(parent: THREE.Mesh, element: BoxElement, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: HDF_COLOR, emissive, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(geo, mat);
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

export function rebuildLeg(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const geo = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, height, 16);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.4, metalness: 0.3,
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

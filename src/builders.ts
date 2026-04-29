import * as THREE from 'three';
import type { BoxElement } from './types';
import { PANEL_T, HDF_T, HDF_INSET, DRAWER_BOX_REAR_OFFSET, BOX_OVERLAY_Y_OFFSET, COUNTERTOP_MAX_SHEET, FRONT_INSET } from './constants';

export const HDF_GRAY = '#8a8a8a';
const HDF_COLOR = new THREE.Color(HDF_GRAY);
const ROD_RADIUS = 0.0125;
const LEG_RADIUS = 0.02;
const LEG_CORNER_OFFSET = 0.03;
const HANDLE_MAT = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 });
const CARGO_CHROME_MAT = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xc8c8c8), roughness: 0.2, metalness: 0.85 });
const CARGO_WHITE_MAT  = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xf2f2f2), roughness: 0.6, metalness: 0.0 });
const CARGO_DARK_MAT   = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x3a3a3a), roughness: 0.4, metalness: 0.7 });

export function elementHasHandle(e: BoxElement): boolean {
  if (e.tipOn) return false;
  if (e.wysow) return true;
  if (e.type === 'drawer') return e.noHandle === false;
  return !e.noHandle;
}

function addHandle(parent: THREE.Mesh, geo: THREE.BoxGeometry, x: number, y: number, z: number, elementId: string) {
  const handle = new THREE.Mesh(geo, HANDLE_MAT);
  handle.position.set(x, y, z);
  handle.userData = { elementId };
  parent.add(handle);
}

/** Remove non-handle children from a parent mesh, disposing geometry and material. */
function disposeMesh(c: THREE.Object3D) {
  if (c instanceof THREE.Mesh) {
    c.geometry.dispose();
    const mat = c.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
    Array.isArray(mat) ? mat.forEach(m => m.dispose()) : mat.dispose();
  }
  c.children.slice().forEach(disposeMesh);
}

function clearChildren(parent: THREE.Mesh) {
  parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
    disposeMesh(c);
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
  const { width, height, depth } = element.dimensions;
  const t = PANEL_T;
  const openOffset = element.drawerOpen ? depth * 0.75 : 0;

  const group = new THREE.Group();
  group.userData = { elementId: element.id };
  parent.add(group);

  if (element.drawerSystemType) {
    const boxH = height;
    const faceW = element.adjustedFrontWidth ?? (width + 2 * t - 0.004);
    const faceH = element.adjustedFrontHeight ?? element.frontHeight ?? (boxH + 0.030);
    const bottomW = width - 0.042;
    const bottomD = depth - DRAWER_BOX_REAR_OFFSET;
    const backW = bottomW - 0.012;

    const makeMat = (c: THREE.Color, opts?: { metalness?: number; roughness?: number }) =>
      new THREE.MeshStandardMaterial({ color: c, emissive, roughness: opts?.roughness ?? 0.4, metalness: opts?.metalness ?? 0.05, side: THREE.DoubleSide });
    const addPanel = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.MeshStandardMaterial) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { elementId: element.id };
      group.add(mesh);
    };
    const woodMat = makeMat(color);
    const frontMat = makeMat(frontColor ?? color);
    const metalColor = new THREE.Color(0x888899);
    const metalMat = makeMat(metalColor, { metalness: 0.7, roughness: 0.25 });
    const metalT = 0.0015;

    addPanel(metalT, boxH, depth, -(bottomW / 2 + metalT / 2), 0, 0, metalMat);
    addPanel(metalT, boxH, depth, (bottomW / 2 + metalT / 2), 0, 0, metalMat);
    addPanel(bottomW, t, bottomD, 0, -(boxH / 2 - t / 2), 0, woodMat);
    addPanel(backW, boxH, t, 0, 0, -(depth / 2 - t / 2), woodMat);
    const isOverlay = element.externalFront !== false;
    const faceY = (faceH - boxH) / 2 - (isOverlay ? BOX_OVERLAY_Y_OFFSET : 0);
    addPanel(faceW, faceH, t, 0, faceY, depth / 2 + t / 2, frontMat);

    if (elementHasHandle(element)) {
      const handleLength = Math.min(faceW * 0.4, 0.150);
      addHandle(parent, new THREE.BoxGeometry(handleLength, 0.012, 0.012), 0, faceY, depth / 2 + t + 0.007 + openOffset, element.id);
    }
    group.position.z = openOffset;
    return;
  }

  const H_SIDE        = 0.145;
  const H_BACK        = 0.100;
  const H_FRONT_INNER = 0.130;
  const H_FRONT_FACE  = 0.170;
  const isExt = element.externalFront === true;
  const faceW = element.adjustedFrontWidth  ?? (element.parentIsDrawerbox === false ? width : width + 2 * t);
  const faceH = element.adjustedFrontHeight ?? element.frontHeight ?? H_FRONT_FACE;
  const extraH = Math.max(0, faceH - H_FRONT_FACE);
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
    group.add(mesh);
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
    addHandle(parent, new THREE.BoxGeometry(handleLength, 0.012, 0.012), 0, faceY, depth / 2 + t + 0.007 + openOffset, element.id);
  }
  group.position.z = openOffset;
}

export function rebuildDrawerbox(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const t = PANEL_T;
  const group = new THREE.Group();
  group.userData = { elementId: element.id };
  group.position.z = element.drawerOpen ? depth * 0.75 : 0;
  parent.add(group);
  const makeMat = () => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const addP = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat());
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { elementId: element.id };
    group.add(m);
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

  if (element.splitFront && element.splitFrontSecW) {
    const secW = element.splitFrontSecW;
    const secOffsetX = element.splitFrontSecOffsetX ?? 0;
    const secGeo = new THREE.BoxGeometry(secW, height, depth);
    const secPanel = new THREE.Mesh(secGeo, mat.clone());
    secPanel.position.x = secOffsetX;
    secPanel.userData = { elementId: element.id };
    parent.add(secPanel);
  }

  if (elementHasHandle(element)) {
    if (element.wysow) {
      const handleLength = Math.min(width * 0.4, 0.150);
      addHandle(parent, new THREE.BoxGeometry(handleLength, 0.012, 0.012), 0, 0, depth / 2 + 0.007, element.id);
    } else {
      const handleLength = Math.min(height * 0.4, 0.128);
      const handleX = (element.frontSide === 'right' || element.splitFront === 'left') ? -(width / 2 - 0.05) : width / 2 - 0.05;
      addHandle(parent, new THREE.BoxGeometry(0.012, handleLength, 0.012), handleX, 0, depth / 2 + 0.007, element.id);
    }
  }
}

export function rebuildHdf(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const backMat   = new THREE.MeshStandardMaterial({ color: HDF_COLOR, emissive, roughness: 0.6, metalness: 0.05 });
  const insideMat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.6, metalness: 0.05 });
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front/inside), -Z (back/outside)
  const mats = [backMat, backMat, backMat, backMat, insideMat, backMat];

  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData = { elementId: element.id };
  parent.add(panel);

  // For L-shaped corner boxkuchenny: add left arm outer side HDF panel
  if (element.hdfCornerW != null && element.hdfCornerD != null) {
    const W = element.hdfCornerW;
    const D = element.hdfCornerD;
    const sideH = height;

    // Left arm outer side: covers the full depth D of the left outer structural panel.
    // Back edge flush with inside face of panel 1 (global z = -D/2).
    // Front edge flush with front face of left outer structural panel (global z = +D/2).
    // Center local z = D/2 + HDF_T/2
    const mats3 = [insideMat, backMat, backMat, backMat, backMat, backMat];
    // Depth: starts at inner face of back panel (z=-D/2 in world = local z=+D/2+HDF_T/2-HDF_T = +D/2-HDF_T/2 ... )
    // Back edge at world z = cabZ-D/2 (inner face of main back HDF), front edge at cabZ+D/2-HDF_INSET.
    const sideD = D - HDF_INSET;
    const panel3 = new THREE.Mesh(
      new THREE.BoxGeometry(HDF_T, sideH, sideD),
      mats3,
    );
    panel3.position.set(-(W / 2 + HDF_T / 2), 0, D / 2 + HDF_T / 2 - HDF_INSET / 2);
    panel3.castShadow = true;
    panel3.receiveShadow = true;
    panel3.userData = { elementId: element.id };
    parent.add(panel3);
  }
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
  const { width: W, height: H, depth: D } = element.dimensions;
  const t = PANEL_T;
  const RAIL_D = 0.100;
  clearChildren(parent);

  let panels: { w: number; h: number; d: number; px: number; py: number; pz: number }[];

  if (element.isWall && element.isCorner) {
    const LA = element.cornerLeftArmDepth ?? D;
    const RA = element.cornerRightArmWidth ?? (W / 2);
    const BD = D / 2;
    const FD = Math.max(0.001, LA - BD);
    panels = [
      // Left arm front cap
      { w: W/2, h: H, d: t,   px: -W/4,                  py: 0,          pz: -BD + LA - t/2 },
      // Right arm right wall
      { w: t,   h: H, d: BD,  px: RA - t/2,               py: 0,          pz: -D/4 },
      // Bottom back section (left+right arms)
      { w: W/2 + RA - t, h: t, d: BD, px: (-W/2 + RA - t) / 2, py: -H/2 + t/2, pz: -D/4 },
      // Bottom front section (left arm only)
      { w: W/2, h: t, d: FD,  px: -W/4,                  py: -H/2 + t/2, pz: FD / 2 },
      // Top back section
      { w: W/2 + RA - t, h: t, d: BD, px: (-W/2 + RA - t) / 2, py:  H/2 - t/2, pz: -D/4 },
      // Top front section (left arm only)
      { w: W/2, h: t, d: FD,  px: -W/4,                  py:  H/2 - t/2, pz: FD / 2 },
      // Corner post at right arm inner face
      { w: t,   h: H, d: RAIL_D, px: RA - t/2,            py: 0,          pz: -RAIL_D/2 },
      // Helper post at back-left of left arm
      { w: t,   h: H, d: RAIL_D, px: -W/2 + t/2,          py: 0,          pz: -D/2 + RAIL_D/2 },
    ];
  } else {
    const innerW = W - 2 * t;
    panels = [
      { w: t,      h: H, d: D,      px: -W/2+t/2, py: 0,        pz: 0 },
      { w: t,      h: H, d: D,      px:  W/2-t/2, py: 0,        pz: 0 },
      { w: innerW, h: t, d: D,      px: 0,         py: -H/2+t/2, pz: 0 },
      ...(element.isWall
        ? [{ w: innerW, h: t, d: D,      px: 0,         py:  H/2-t/2, pz: 0 }]
        : [
            { w: innerW, h: t, d: RAIL_D, px: 0,         py:  H/2-t/2, pz:  D/2 - RAIL_D/2 },
            { w: innerW, h: t, d: RAIL_D, px: 0,         py:  H/2-t/2, pz: -D/2 + RAIL_D/2 },
          ]),
    ];
  }

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

export function rebuildCountertop(parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const GAP = 0.003;
  const pieces = Math.ceil(width / COUNTERTOP_MAX_SHEET);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.3, metalness: 0.15, side: THREE.DoubleSide });
  let offsetX = -width / 2;
  for (let i = 0; i < pieces; i++) {
    const pieceW = i < pieces - 1 ? COUNTERTOP_MAX_SHEET : width - COUNTERTOP_MAX_SHEET * (pieces - 1);
    const renderW = i < pieces - 1 ? pieceW - GAP : pieceW;
    const geo = new THREE.BoxGeometry(renderW, height, depth);
    const panel = new THREE.Mesh(geo, mat);
    panel.position.set(offsetX + renderW / 2, 0, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData = { elementId: element.id };
    parent.add(panel);
    offsetX += pieceW;
  }
}

export function rebuildCargo(parent: THREE.Mesh, element: BoxElement, _color: THREE.Color, _emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;

  const addBox = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.MeshStandardMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { elementId: element.id };
    parent.add(mesh);
  };

  const addRod = (len: number, r: number, px: number, py: number, pz: number, mat: THREE.MeshStandardMaterial, rotX = 0, rotZ = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    mesh.rotation.set(rotX, 0, rotZ);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.userData = { elementId: element.id };
    parent.add(mesh);
  };

  // Two vertical side rails (front face, left & right)
  const poleR = 0.009;
  const poleXL = -width / 2 + 0.018;
  const poleXR =  width / 2 - 0.018;
  const poleZ  =  depth / 2 - 0.018;
  addRod(height, poleR, poleXL, 0, poleZ,  CARGO_CHROME_MAT);
  addRod(height, poleR, poleXR, 0, poleZ,  CARGO_CHROME_MAT);
  addRod(height, poleR, poleXL, 0, -depth / 2 + 0.018, CARGO_CHROME_MAT);
  addRod(height, poleR, poleXR, 0, -depth / 2 + 0.018, CARGO_CHROME_MAT);

  // Top mounting mechanism
  const topY = height / 2;
  addBox(width - 0.010, 0.022, 0.055, 0, topY - 0.011, depth / 2 - 0.040, CARGO_DARK_MAT);
  addRod(width - 0.020, 0.005, 0, topY - 0.022, depth / 2 - 0.070, CARGO_CHROME_MAT, 0, Math.PI / 2);

  // Baskets
  const basketCount = Math.min(6, Math.max(3, Math.round(height / 0.200)));
  const slotH       = height / basketCount;
  const shelfT      = 0.014;
  const innerW      = width  - 0.044;
  const innerD      = depth  - 0.050;
  const guardH      = Math.min(0.095, slotH * 0.42);
  const guardHBack  = guardH * 0.55;
  const wr          = 0.0035; // wire radius

  for (let i = 0; i < basketCount; i++) {
    const baseY = -height / 2 + slotH * i + 0.025;

    // White bottom shelf
    addBox(innerW, shelfT, innerD, 0, baseY + shelfT / 2, -0.005, CARGO_WHITE_MAT);

    // Side guards — 2 horizontal wires per side, front-to-back
    const sideY1 = baseY + shelfT + guardHBack * 0.45;
    const sideY2 = baseY + shelfT + guardH;
    addRod(innerD, wr, poleXL, sideY1, -0.005, CARGO_CHROME_MAT, Math.PI / 2);
    addRod(innerD, wr, poleXR, sideY1, -0.005, CARGO_CHROME_MAT, Math.PI / 2);
    addRod(innerD, wr, poleXL, sideY2, -0.005, CARGO_CHROME_MAT, Math.PI / 2);
    addRod(innerD, wr, poleXR, sideY2, -0.005, CARGO_CHROME_MAT, Math.PI / 2);

    // Front guard — lower bar + upper bar + 3 vertical connectors
    const fz = depth / 2 - 0.018;
    addRod(innerW, wr, 0, baseY + shelfT + wr, fz, CARGO_CHROME_MAT, 0, Math.PI / 2);
    addRod(innerW, wr, 0, baseY + shelfT + guardH, fz, CARGO_CHROME_MAT, 0, Math.PI / 2);
    for (let j = 0; j <= 2; j++) {
      const fx = -innerW / 2 + (innerW / 2) * j;
      const connH = j === 1 ? guardH : guardH * 0.65;
      addRod(connH, wr, fx, baseY + shelfT + connH / 2, fz, CARGO_CHROME_MAT);
    }

    // Back bar
    addRod(innerW, wr, 0, baseY + shelfT + guardHBack, -depth / 2 + 0.020, CARGO_CHROME_MAT, 0, Math.PI / 2);

    // Bottom cross-wires (3 running front-to-back under shelf)
    for (let j = 0; j <= 2; j++) {
      const wx = -innerW / 2 + (innerW / 2) * j;
      addRod(innerD, wr * 0.8, wx, baseY + shelfT / 2, -0.005, CARGO_CHROME_MAT, Math.PI / 2);
    }
  }
}

function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2, y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 3 / 2, false);
  return shape;
}

export function rebuildCornerSystem(parent: THREE.Mesh, element: BoxElement, _color: THREE.Color, _emissive: THREE.Color) {
  clearChildren(parent);
  const { width, height, depth } = element.dimensions;
  const modelType = element.cornerSystemModelType;

  if (modelType === 'nerka') {
    const trayCount = 2;
    const trayW = width - 0.04;
    const trayD = depth - 0.04;
    const cornerR = Math.min(trayW, trayD) * 0.18;
    const trayH = 0.012;
    const rimT = 0.006;
    const spacingY = height / (trayCount + 1);

    const poleR = 0.010;
    const poleOffsets: [number, number][] = [[-trayW * 0.3, 0], [trayW * 0.3, 0]];
    for (const [px, pz] of poleOffsets) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, height, 12), CARGO_CHROME_MAT);
      pole.position.set(px, 0, pz);
      pole.userData = { elementId: element.id };
      parent.add(pole);
    }

    const trayShape = makeRoundedRectShape(trayW, trayD, cornerR);
    const trayGeo = new THREE.ExtrudeGeometry(trayShape, { depth: trayH, bevelEnabled: false });
    const rimCurve = new THREE.CatmullRomCurve3(
      trayShape.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0)),
      true
    );
    const rimGeo = new THREE.TubeGeometry(rimCurve, 64, rimT, 6, true);

    for (let i = 1; i <= trayCount; i++) {
      const y = -height / 2 + spacingY * i;

      const tray = new THREE.Mesh(trayGeo, CARGO_WHITE_MAT);
      tray.rotation.x = -Math.PI / 2;
      tray.position.set(0, y, 0);
      tray.castShadow = true;
      tray.receiveShadow = true;
      tray.userData = { elementId: element.id };
      parent.add(tray);

      const rim = new THREE.Mesh(rimGeo, CARGO_CHROME_MAT);
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(0, y + trayH, 0);
      rim.userData = { elementId: element.id };
      parent.add(rim);
    }
    return;
  }

  // Default: rotating round trays (lazy susan)
  const poleR = 0.012;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, height, 16), CARGO_CHROME_MAT);
  pole.userData = { elementId: element.id };
  parent.add(pole);

  const trayCount = 2;
  const trayR = Math.min(width, depth) / 2 - 0.02;
  const trayH = 0.012;
  const spacingY = height / (trayCount + 1);
  for (let i = 1; i <= trayCount; i++) {
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(trayR, trayR, trayH, 32), CARGO_WHITE_MAT);
    tray.position.set(0, -height / 2 + spacingY * i, 0);
    tray.castShadow = true;
    tray.receiveShadow = true;
    tray.userData = { elementId: element.id };
    parent.add(tray);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(trayR, 0.006, 8, 32), CARGO_CHROME_MAT);
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(tray.position);
    rim.userData = { elementId: element.id };
    parent.add(rim);
  }
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

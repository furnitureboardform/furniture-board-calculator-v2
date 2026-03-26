import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BoxElement } from './types';

interface UseThreeSceneOptions {
  elements: BoxElement[];
  selectedId: string | null;
  boardSize: { width: number; depth: number };
  onSelect: (id: string | null) => void;
  onDimensionChange: (id: string, axis: 'width' | 'height' | 'depth', delta: number, dir: number) => void;
  onPositionChange: (id: string, dx: number, dz: number) => void;
  onYMove: (id: string, dy: number) => void;
  onDragStart?: (id: string) => void;
}

const PANEL_T = 0.018; // panel thickness in metres (~18 mm)
const PANEL_COLOR = new THREE.Color(0xc8a97a); // light wood brown

/** Builds a rectangular grid as LineSegments (one line per cellSize metres). */
function makeRectGrid(w: number, d: number, cellSize: number, color: number): THREE.LineSegments {
  const pts: number[] = [];
  const stepsX = Math.max(1, Math.round(w / cellSize));
  const stepsZ = Math.max(1, Math.round(d / cellSize));
  for (let i = 0; i <= stepsZ; i++) {
    const z = -d / 2 + (i / stepsZ) * d;
    pts.push(-w / 2, 0, z, w / 2, 0, z);
  }
  for (let i = 0; i <= stepsX; i++) {
    const x = -w / 2 + (i / stepsX) * w;
    pts.push(x, 0, -d / 2, x, 0, d / 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
  return new THREE.LineSegments(geo, mat);
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseThreeSceneOptions
) {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const handleMapRef = useRef<Map<string, { mesh: THREE.Mesh; axis: 'width' | 'height' | 'depth'; dir: number; elementId: string }>>(new Map());
  const animFrameRef = useRef<number>(0);
  const boardMeshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.LineSegments | null>(null);
  const lastBoardSizeRef = useRef<{ width: number; depth: number } | null>(null);
  const isDraggingHandleRef = useRef(false);
  const dragStateRef = useRef<{
    handleKey: string;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);
  const isDraggingBoxRef = useRef(false);
  const isDraggingBoxYRef = useRef(false);
  const moveDragStateRef = useRef<{
    elementId: string;
    lastWorldPos: THREE.Vector3;
  } | null>(null);
  const moveDragYStateRef = useRef<{
    elementId: string;
    lastClientY: number;
  } | null>(null);
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const buildHandleKey = (elementId: string, axis: string, dir: number) =>
    `${elementId}_${axis}_${dir}`;

  const createHandleMesh = useCallback(
    (elementId: string, axis: 'width' | 'height' | 'depth', dir: number, color: number) => {
      const geo = new THREE.SphereGeometry(0.07, 12, 12);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { isHandle: true, elementId, axis, dir };
      const key = buildHandleKey(elementId, axis, dir);
      handleMapRef.current.set(key, { mesh, axis, dir, elementId });
      return mesh;
    },
    []
  );

  const placeHandles = useCallback(
    (parent: THREE.Mesh, element: BoxElement) => {
      const { width, height, depth } = element.dimensions;
      const axes: { axis: 'width' | 'height' | 'depth'; dir: number; offset: THREE.Vector3; color: number }[] = [
        { axis: 'width', dir: 1, offset: new THREE.Vector3(width / 2, 0, 0), color: 0xff4444 },
        { axis: 'width', dir: -1, offset: new THREE.Vector3(-width / 2, 0, 0), color: 0xff4444 },
        { axis: 'height', dir: 1, offset: new THREE.Vector3(0, height / 2, 0), color: 0x44ff44 },
        { axis: 'height', dir: -1, offset: new THREE.Vector3(0, -height / 2, 0), color: 0x44ff44 },
        { axis: 'depth', dir: 1, offset: new THREE.Vector3(0, 0, depth / 2), color: 0x4488ff },
        { axis: 'depth', dir: -1, offset: new THREE.Vector3(0, 0, -depth / 2), color: 0x4488ff },
      ];

      // Remove old handles only (keep panel children)
      parent.children.slice().filter((c) => c.userData.isHandle).forEach((c) => parent.remove(c));
      axes.forEach((a) => {
        const key = buildHandleKey(element.id, a.axis, a.dir);
        handleMapRef.current.delete(key);
      });

      axes.forEach(({ axis, dir, offset, color }) => {
        const handle = createHandleMesh(element.id, axis, dir, color);
        handle.position.copy(offset);
        parent.add(handle);
      });
    },
    [createHandleMesh]
  );

  const rebuildPanels = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      const { width, height, depth } = element.dimensions;
      const t = PANEL_T;
      // Remove previous panels (keep handle children)
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });

      // Sides span full height; top/bottom fit between sides (classic joinery)
      const innerW = width - 2 * t;
      const panels = [
        // Left side — full height
        { w: t,      h: height,  d: depth, px: -width / 2 + t / 2, py: 0,                    pz: 0 },
        // Right side — full height
        { w: t,      h: height,  d: depth, px:  width / 2 - t / 2, py: 0,                    pz: 0 },
        // Top — fits between sides
        { w: innerW, h: t,       d: depth, px: 0,                   py:  height / 2 - t / 2,  pz: 0 },
        // Bottom — fits between sides
        { w: innerW, h: t,       d: depth, px: 0,                   py: -height / 2 + t / 2,  pz: 0 },
      ];

      for (const p of panels) {
        const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive,
          roughness: 0.5,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const panel = new THREE.Mesh(geo, mat);
        panel.position.set(p.px, p.py, p.pz);
        panel.castShadow = true;
        panel.receiveShadow = true;
        panel.userData = { elementId: element.id };
        parent.add(panel);
      }
    },
    []
  );

  const rebuildShelf = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(geo, mat);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData = { elementId: element.id };
      parent.add(panel);
    },
    []
  );

  const rebuildDrawer = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
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
      // Left side (145mm)
      addPanel(t, H_SIDE, depth - t, -(width / 2 - t / 2), 0, -t / 2);
      // Right side (145mm)
      addPanel(t, H_SIDE, depth - t,  (width / 2 - t / 2), 0, -t / 2);
      // Bottom (between sides)
      addPanel(width - 2 * t, t, depth - t, 0, -(H_SIDE / 2 - t / 2), -t / 2);
      // Back (100mm, bottom-aligned)
      addPanel(width - 2 * t, H_BACK, t, 0, (H_BACK - H_SIDE) / 2, -(depth / 2 - t / 2));
      // Front inner (130mm, bottom-aligned)
      addPanel(width - 2 * t, H_FRONT_INNER, t, 0, (H_FRONT_INNER - H_SIDE) / 2, depth / 2 - t / 2);
      // Decorative front face (170mm tall, full drawerbox width -2mm each side, bottom-aligned)
      // Sits in front of the drawer box — back face flush with box front face
      addPanel(width + 2 * t - 0.004, H_FRONT_FACE, t, 0, (H_FRONT_FACE - H_SIDE) / 2, depth / 2 + t / 2);
    },
    []
  );

  const rebuildDrawerbox = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
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
      // Left side
      addP(t, height, depth, -(width / 2 - t / 2), 0, 0);
      // Right side
      addP(t, height, depth, (width / 2 - t / 2), 0, 0);
      // Top (between sides)
      addP(width - 2 * t, t, depth, 0, height / 2 - t / 2, 0);
      // Bottom (optional)
      if (element.hasBottomPanel) {
        addP(width - 2 * t, t, depth, 0, -(height / 2 - t / 2), 0);
      }
      // No front, no back
    },
    []
  );

  const rebuildBlenda = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
      const panel = new THREE.Mesh(geo, mat);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData = { elementId: element.id };
      parent.add(panel);
    },
    []
  );

  const rebuildPlinth = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
      const panel = new THREE.Mesh(geo, mat);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData = { elementId: element.id };
      parent.add(panel);
    },
    []
  );

  const rebuildDivider = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: 0.5,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(geo, mat);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData = { elementId: element.id };
      parent.add(panel);
    },
    []
  );

  const rebuildFront = useCallback(
    (parent: THREE.Mesh, element: BoxElement, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color: PANEL_COLOR,
        emissive,
        roughness: 0.3,
        metalness: 0.15,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const panel = new THREE.Mesh(geo, mat);
      panel.userData = { elementId: element.id };
      parent.add(panel);
    },
    []
  );

  const HDF_COLOR = new THREE.Color(0x5c4033); // dark brown for HDF hardboard

  const rebuildHdf = useCallback(
    (parent: THREE.Mesh, element: BoxElement, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color: HDF_COLOR,
        emissive,
        roughness: 0.6,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(geo, mat);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData = { elementId: element.id };
      parent.add(panel);
    },
    []
  );

  const ROD_RADIUS = 0.0125; // 25 mm diameter wardrobe rail

  const rebuildRod = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const geo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, element.dimensions.width, 24);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: 0.25,
        metalness: 0.7,
      });
      const rod = new THREE.Mesh(geo, mat);
      rod.rotation.z = Math.PI / 2; // lay along X axis
      rod.castShadow = true;
      rod.receiveShadow = true;
      rod.userData = { elementId: element.id };
      parent.add(rod);
    },
    []
  );

  const LEG_RADIUS = 0.02;        // 20 mm radius (40 mm diameter leg)
  const LEG_CORNER_OFFSET = 0.03; // 30 mm inset from each cabinet edge to leg centre

  const rebuildLeg = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const { width, height, depth } = element.dimensions;
      const geo = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, height, 16);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: 0.4,
        metalness: 0.3,
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
    },
    []
  );

  // Init scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(4, 3, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Grid (initial — replaced by boardSize effect)
    const grid = makeRectGrid(20, 20, 0.5, 0x444466);
    scene.add(grid);
    gridRef.current = grid;

    // Board floor plane
    const boardGeo = new THREE.PlaneGeometry(20, 20);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x252540,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.5,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.rotation.x = -Math.PI / 2;
    board.position.y = -0.001;
    board.receiveShadow = true;
    scene.add(board);
    boardMeshRef.current = board;

    // Animate
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      // Reset so the board-sync effect re-runs after StrictMode double-mount
      lastBoardSizeRef.current = null;
    };
  }, [containerRef]);

  // Sync board and grid to boardSize
  useEffect(() => {
    const { boardSize } = optionsRef.current;
    const prev = lastBoardSizeRef.current;
    if (prev && prev.width === boardSize.width && prev.depth === boardSize.depth) return;
    lastBoardSizeRef.current = { ...boardSize };

    const w = boardSize.width;
    const d = boardSize.depth;

    const scene = sceneRef.current;
    if (scene) {
      const oldGrid = gridRef.current;
      if (oldGrid) { scene.remove(oldGrid); oldGrid.geometry.dispose(); (oldGrid.material as THREE.Material).dispose(); }
      const newGrid = makeRectGrid(w, d, 0.5, 0x444466);
      scene.add(newGrid);
      gridRef.current = newGrid;
    }

    const board = boardMeshRef.current;
    if (board) {
      board.geometry.dispose();
      board.geometry = new THREE.PlaneGeometry(w, d);
    }
  });

  // Sync elements to scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const { elements, selectedId } = optionsRef.current;

    // Remove meshes for deleted elements
    meshMapRef.current.forEach((mesh, id) => {
      if (!elements.find((e) => e.id === id)) {
        scene.remove(mesh);
        meshMapRef.current.delete(id);
      }
    });

    elements.forEach((element) => {
      // Groups are logical only — no 3D mesh
      if (element.type === 'group') return;

      const { width, height, depth } = element.dimensions;
      const isSelected = element.id === selectedId;

      const color = PANEL_COLOR;
      const emissive = new THREE.Color(isSelected ? 0x224488 : 0x000000);

      if (meshMapRef.current.has(element.id)) {
        const mesh = meshMapRef.current.get(element.id)!;
        // Update invisible bbox
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(width, height, depth);
        if (element.type === 'cabinet' || element.type === 'drawerbox') mesh.raycast = () => {};
        else mesh.raycast = THREE.Mesh.prototype.raycast.bind(mesh);
        mesh.position.set(element.position.x, element.position.y + height / 2, element.position.z);
        // Rebuild visible panels
        if (element.type === 'shelf') rebuildShelf(mesh, element, color, emissive);
        else if (element.type === 'drawer') rebuildDrawer(mesh, element, color, emissive);
        else if (element.type === 'drawerbox') rebuildDrawerbox(mesh, element, color, emissive);
        else if (element.type === 'blenda') rebuildBlenda(mesh, element, color, emissive);
        else if (element.type === 'plinth') rebuildPlinth(mesh, element, color, emissive);
        else if (element.type === 'divider') rebuildDivider(mesh, element, color, emissive);
        else if (element.type === 'front') rebuildFront(mesh, element, emissive);
        else if (element.type === 'hdf') rebuildHdf(mesh, element, emissive);
        else if (element.type === 'rod') rebuildRod(mesh, element, color, emissive);
        else if (element.type === 'leg') rebuildLeg(mesh, element, color, emissive);
        else rebuildPanels(mesh, element, color, emissive);
        if (isSelected) placeHandles(mesh, element);
        else mesh.children.slice().filter((c) => c.userData.isHandle).forEach((c) => mesh.remove(c));
      } else {
        // Invisible bounding box — cabinet: disabled for raycasting (panels handle it)
        // Shelf: bbox used for raycasting
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        if (element.type === 'cabinet' || element.type === 'drawerbox') {
          mesh.raycast = () => {}; // panels will be hit instead
        }
        mesh.position.set(element.position.x, element.position.y + height / 2, element.position.z);
        mesh.userData = { elementId: element.id };
        scene.add(mesh);
        meshMapRef.current.set(element.id, mesh);
        if (element.type === 'shelf') rebuildShelf(mesh, element, color, emissive);
        else if (element.type === 'drawer') rebuildDrawer(mesh, element, color, emissive);
        else if (element.type === 'drawerbox') rebuildDrawerbox(mesh, element, color, emissive);
        else if (element.type === 'blenda') rebuildBlenda(mesh, element, color, emissive);
        else if (element.type === 'plinth') rebuildPlinth(mesh, element, color, emissive);
        else if (element.type === 'divider') rebuildDivider(mesh, element, color, emissive);
        else if (element.type === 'front') rebuildFront(mesh, element, emissive);
        else if (element.type === 'hdf') rebuildHdf(mesh, element, emissive);
        else if (element.type === 'rod') rebuildRod(mesh, element, color, emissive);
        else if (element.type === 'leg') rebuildLeg(mesh, element, color, emissive);
        else rebuildPanels(mesh, element, color, emissive);
        if (isSelected) placeHandles(mesh, element);
      }
      // Override position/rotation for open front panels
      if (element.type === 'front' && element.cabinetId) {
        const fmesh = meshMapRef.current.get(element.id);
        if (fmesh) {
          const cab = elements.find((e) => e.id === element.cabinetId);
          if (cab?.openFronts) {
            const W = element.dimensions.width;
            const isRight = element.frontSide === 'right';
            // Rotate around the hinge edge so doors open outward (+Z toward viewer)
            // Left hinge: rotation -π/2, pivot at x - W/2
            // Right hinge: rotation +π/2, pivot at x + W/2
            fmesh.rotation.y = isRight ? Math.PI / 2 : -Math.PI / 2;
            fmesh.position.x = isRight
              ? element.position.x + W / 2
              : element.position.x - W / 2;
            fmesh.position.z = element.position.z + W / 2;
          } else {
            fmesh.rotation.y = 0;
            // position already reset by main loop above
          }
        }
      }
    });
  });

  // Pointer events for selection and handle dragging
  useEffect(() => {
    const container = containerRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    if (!container || !renderer || !camera || !scene || !controls) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getMouseNDC = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      getMouseNDC(e);
      raycaster.setFromCamera(mouse, camera);

      // Check handles first
      const handleMeshes = Array.from(handleMapRef.current.values()).map((h) => h.mesh);
      const handleHits = raycaster.intersectObjects(handleMeshes);
      if (handleHits.length > 0) {
        const hit = handleHits[0].object as THREE.Mesh;
        const { elementId, axis, dir } = hit.userData as {
          elementId: string;
          axis: 'width' | 'height' | 'depth';
          dir: number;
        };
        const key = buildHandleKey(elementId, axis, dir);
        isDraggingHandleRef.current = true;
        dragStateRef.current = { handleKey: key, startMouseX: e.clientX, startMouseY: e.clientY };
        controls.enabled = false;
        e.stopPropagation();
        return;
      }

      // Check element boxes — ray against panel meshes (children) and shelf bboxes
      const allHittable: THREE.Mesh[] = [];
      meshMapRef.current.forEach((mesh) => {
        const el = optionsRef.current.elements.find((e) => e.id === mesh.userData.elementId);
        if (el?.type === 'cabinet' || el?.type === 'drawerbox') {
          // Hit against visible panels
          mesh.children.forEach((c) => {
            if (c instanceof THREE.Mesh && !c.userData.isHandle) allHittable.push(c);
          });
        } else {
          allHittable.push(mesh);
        }
      });
      const hits = raycaster.intersectObjects(allHittable, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.elementId as string;
        if (id === optionsRef.current.selectedId) {
          if (e.ctrlKey) {
            // Ctrl held: drag Y (vertical)
            isDraggingBoxYRef.current = true;
            moveDragYStateRef.current = { elementId: id, lastClientY: e.clientY };
            controls.enabled = false;
          } else {
            // Already selected — start moving it on XZ
            const worldPos = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane.current, worldPos);
            isDraggingBoxRef.current = true;
            optionsRef.current.onDragStart?.(id);
            moveDragStateRef.current = { elementId: id, lastWorldPos: worldPos };
            controls.enabled = false;
          }
        } else {
          optionsRef.current.onSelect(id);
        }
      } else {
        optionsRef.current.onSelect(null);
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      getMouseNDC(e);
      raycaster.setFromCamera(mouse, camera);

      if (isDraggingHandleRef.current && dragStateRef.current) {
        const { handleKey, startMouseX, startMouseY } = dragStateRef.current;
        const entry = handleMapRef.current.get(handleKey);
        if (entry) {
          const dx = e.clientX - startMouseX;
          const dy = e.clientY - startMouseY;
          let delta = 0;
          if (entry.axis === 'height') {
            delta = (-dy / container.clientHeight) * 5 * entry.dir;
          } else {
            delta = (dx / container.clientWidth) * 5 * entry.dir;
          }
          optionsRef.current.onDimensionChange(entry.elementId, entry.axis, delta, entry.dir);
          dragStateRef.current.startMouseX = e.clientX;
          dragStateRef.current.startMouseY = e.clientY;
        }
        return;
      }

      if (isDraggingBoxRef.current && moveDragStateRef.current) {
        const worldPos = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane.current, worldPos);
        const last = moveDragStateRef.current.lastWorldPos;
        const dx = worldPos.x - last.x;
        const dz = worldPos.z - last.z;
        optionsRef.current.onPositionChange(moveDragStateRef.current.elementId, dx, dz);
        moveDragStateRef.current.lastWorldPos = worldPos;
        return;
      }

      if (isDraggingBoxYRef.current && moveDragYStateRef.current) {
        const dy = -(e.clientY - moveDragYStateRef.current.lastClientY) / container.clientHeight * 6;
        optionsRef.current.onYMove(moveDragYStateRef.current.elementId, dy);
        moveDragYStateRef.current.lastClientY = e.clientY;
        return;
      }

      // Cursor hint: show 'grab' when hovering selected box
      const allHoverable: THREE.Mesh[] = [];
      meshMapRef.current.forEach((mesh) => {
        const el = optionsRef.current.elements.find((e) => e.id === mesh.userData.elementId);
        if (el?.type === 'cabinet') {
          mesh.children.forEach((c) => {
            if (c instanceof THREE.Mesh && !c.userData.isHandle) allHoverable.push(c);
          });
        } else {
          allHoverable.push(mesh);
        }
      });
      const hits = raycaster.intersectObjects(allHoverable, false);
      if (hits.length > 0 && hits[0].object.userData.elementId === optionsRef.current.selectedId) {
        container.style.cursor = 'grab';
      } else {
        container.style.cursor = '';
      }
    };

    const onPointerUp = () => {
      if (isDraggingHandleRef.current) {
        isDraggingHandleRef.current = false;
        dragStateRef.current = null;
        controls.enabled = true;
      }
      if (isDraggingBoxRef.current) {
        isDraggingBoxRef.current = false;
        moveDragStateRef.current = null;
        controls.enabled = true;
        container.style.cursor = '';
      }
      if (isDraggingBoxYRef.current) {
        isDraggingBoxYRef.current = false;
        moveDragYStateRef.current = null;
        controls.enabled = true;
        container.style.cursor = '';
      }
    };

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    return () => {
      container.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [containerRef]);
}

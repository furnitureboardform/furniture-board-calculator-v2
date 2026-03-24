import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BoxElement } from './types';

interface UseThreeSceneOptions {
  elements: BoxElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDimensionChange: (id: string, axis: 'width' | 'height' | 'depth', delta: number, dir: number) => void;
  onPositionChange: (id: string, dx: number, dz: number) => void;
  onYMove: (id: string, dy: number) => void;
  onDragStart?: (id: string) => void;
}

const PANEL_T = 0.018; // panel thickness in metres (~18 mm)
const PANEL_COLOR = new THREE.Color(0xc8a97a); // light wood brown

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

  const LEG_RADIUS = 0.02; // 20 mm radius (40 mm diameter leg)

  const rebuildLeg = useCallback(
    (parent: THREE.Mesh, element: BoxElement, color: THREE.Color, emissive: THREE.Color) => {
      parent.children.slice().filter((c) => !c.userData.isHandle).forEach((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.MeshStandardMaterial).dispose();
        }
        parent.remove(c);
      });
      const geo = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, element.dimensions.height, 16);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: 0.4,
        metalness: 0.3,
      });
      const leg = new THREE.Mesh(geo, mat);
      leg.castShadow = true;
      leg.receiveShadow = true;
      leg.userData = { elementId: element.id };
      parent.add(leg);
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

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x444466, 0x333355);
    scene.add(grid);

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
    };
  }, [containerRef]);

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
      const { width, height, depth } = element.dimensions;
      const isSelected = element.id === selectedId;

      const color = PANEL_COLOR;
      const emissive = new THREE.Color(isSelected ? 0x224488 : 0x000000);

      if (meshMapRef.current.has(element.id)) {
        const mesh = meshMapRef.current.get(element.id)!;
        // Update invisible bbox
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(width, height, depth);
        if (element.type === 'cabinet') mesh.raycast = () => {};
        else mesh.raycast = THREE.Mesh.prototype.raycast.bind(mesh);
        mesh.position.set(element.position.x, element.position.y + height / 2, element.position.z);
        // Rebuild visible panels
        if (element.type === 'shelf') rebuildShelf(mesh, element, color, emissive);
        else if (element.type === 'divider') rebuildDivider(mesh, element, color, emissive);
        else if (element.type === 'front') rebuildFront(mesh, element, emissive);
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
        if (element.type === 'cabinet') {
          mesh.raycast = () => {}; // panels will be hit instead
        }
        mesh.position.set(element.position.x, element.position.y + height / 2, element.position.z);
        mesh.userData = { elementId: element.id };
        scene.add(mesh);
        meshMapRef.current.set(element.id, mesh);
        if (element.type === 'shelf') rebuildShelf(mesh, element, color, emissive);
        else if (element.type === 'divider') rebuildDivider(mesh, element, color, emissive);
        else if (element.type === 'front') rebuildFront(mesh, element, emissive);
        else if (element.type === 'rod') rebuildRod(mesh, element, color, emissive);
        else if (element.type === 'leg') rebuildLeg(mesh, element, color, emissive);
        else rebuildPanels(mesh, element, color, emissive);
        if (isSelected) placeHandles(mesh, element);
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
        if (el?.type === 'cabinet') {
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

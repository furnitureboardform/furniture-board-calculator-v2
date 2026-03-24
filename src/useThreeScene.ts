import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BoxElement } from './types';

interface UseThreeSceneOptions {
  elements: BoxElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDimensionChange: (id: string, axis: 'width' | 'height' | 'depth', delta: number) => void;
  onPositionChange: (id: string, dx: number, dz: number) => void;
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
  const isDraggingHandleRef = useRef(false);
  const dragStateRef = useRef<{
    handleKey: string;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);
  const isDraggingBoxRef = useRef(false);
  const moveDragStateRef = useRef<{
    elementId: string;
    lastWorldPos: THREE.Vector3;
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

      // Remove old handles
      parent.children.slice().forEach((c) => parent.remove(c));
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

      if (meshMapRef.current.has(element.id)) {
        const mesh = meshMapRef.current.get(element.id)!;
        // Update geometry
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(width, height, depth);
        mesh.position.set(element.position.x, element.position.y + height / 2, element.position.z);
        (mesh.material as THREE.MeshStandardMaterial).color.set(element.color);
        (mesh.material as THREE.MeshStandardMaterial).emissive.set(
          isSelected ? 0x224488 : 0x000000
        );
        if (isSelected) placeHandles(mesh, element);
        else mesh.children.slice().forEach((c) => mesh.remove(c));
      } else {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshStandardMaterial({
          color: element.color,
          emissive: isSelected ? 0x224488 : 0x000000,
          roughness: 0.5,
          metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(element.position.x, element.position.y + height / 2, element.position.z);
        mesh.userData = { elementId: element.id };
        scene.add(mesh);
        meshMapRef.current.set(element.id, mesh);
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

      // Check element boxes
      const meshes = Array.from(meshMapRef.current.values());
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.elementId as string;
        if (id === optionsRef.current.selectedId) {
          // Already selected — start moving it
          const worldPos = new THREE.Vector3();
          raycaster.ray.intersectPlane(groundPlane.current, worldPos);
          isDraggingBoxRef.current = true;
          moveDragStateRef.current = { elementId: id, lastWorldPos: worldPos };
          controls.enabled = false;
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
          optionsRef.current.onDimensionChange(entry.elementId, entry.axis, delta);
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

      // Cursor hint: show 'grab' when hovering selected box
      const meshes = Array.from(meshMapRef.current.values());
      const hits = raycaster.intersectObjects(meshes, false);
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

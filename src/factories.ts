import type { BoxElement } from './types';
import { COLORS } from './constants';

let colorIndex = 0;
export let boxCounter = 1;
export let shelfCounter = 1;
export let dividerCounter = 1;
export let frontCounter = 1;
export let rodCounter = 1;
export let legCounter = 1;
export let hdfCounter = 1;
export let drawerCounter = 1;
export let drawerboxCounter = 1;
export let blendaCounter = 1;
export let plinthCounter = 1;
export let groupCounter = 1;

export function nextColor(): string {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

export function currentColor(): string {
  return COLORS[colorIndex % COLORS.length];
}

export function createBox(): BoxElement {
  const color = nextColor();
  return {
    id: crypto.randomUUID(),
    name: `Box ${boxCounter++}`,
    type: 'cabinet',
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 0, z: 0 },
    color,
  };
}

export function createShelf(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  return {
    id: crypto.randomUUID(),
    name: `Półka ${shelfCounter++}`,
    type: 'shelf',
    dimensions: { width: 0.8, height: 0.018, depth: 0.38 },
    position: { x: 0, y: 0.3, z: 0 },
    color,
  };
}

import type { BoxElement } from './types';
import { COLORS } from './constants';

const DEFAULT_FINISH_ID = 'A2T61OgxOb5IpWNoMzsW';

let colorIndex = 0;

export const counters = {
  box: 1,
  shelf: 1,
  divider: 1,
  front: 1,
  rod: 1,
  leg: 1,
  hdf: 1,
  drawer: 1,
  drawerbox: 1,
  blenda: 1,
  plinth: 1,
  maskowanica: 1,
  board: 1,
  group: 1,
  szafkaDolna: 1,
  countertop: 1,
  cargo: 1,
  cornersystem: 1,
};

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
    name: `Box ${counters.box++}`,
    type: 'cabinet',
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 0, z: 0 },
    color,
    finishId: DEFAULT_FINISH_ID,
  };
}

export function createBoxKuchenny(): BoxElement {
  const color = nextColor();
  return {
    id: crypto.randomUUID(),
    name: `Box kuchenny ${counters.szafkaDolna++}`,
    type: 'boxkuchenny',
    dimensions: { width: 0.6, height: 0.72, depth: 0.53 },
    position: { x: 0, y: 0, z: 0 },
    color,
    finishId: DEFAULT_FINISH_ID,
  };
}

export function createBoard(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  return {
    id: crypto.randomUUID(),
    name: `Płyta ${counters.board++}`,
    type: 'board',
    dimensions: { width: 0.6, height: 0.6, depth: 0.018 },
    position: { x: 0, y: 0.3, z: 0 },
    color,
    finishId: DEFAULT_FINISH_ID,
  };
}

export function createShelf(): BoxElement {
  const color = COLORS[colorIndex % COLORS.length];
  return {
    id: crypto.randomUUID(),
    name: `Półka ${counters.shelf++}`,
    type: 'shelf',
    dimensions: { width: 0.8, height: 0.018, depth: 0.38 },
    position: { x: 0, y: 0.3, z: 0 },
    color,
    finishId: DEFAULT_FINISH_ID,
  };
}

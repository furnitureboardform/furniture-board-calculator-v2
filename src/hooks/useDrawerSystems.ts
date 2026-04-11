import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DrawerSystemOption } from '../types';

export function useDrawerSystems() {
  const [systems, setSystems] = useState<DrawerSystemOption[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'drawers'), orderBy('createdAt')))
      .then((snap) => {
        setSystems(snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            label: String(raw.label ?? ''),
            brand: String(raw.type ?? raw.brand ?? ''),
            depth: Number(raw.depthMm ?? 0) / 1000,
            height: Number(raw.heightMm ?? 0) / 1000,
            price: Number(raw.pricePln ?? 0),
          } as DrawerSystemOption;
        }));
      })
      .catch((err) => console.error('useDrawerSystems:', err));
  }, []);

  return systems;
}

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CargoOption } from '../types';

export function useCargo() {
  const [cargoOptions, setCargoOptions] = useState<CargoOption[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'cargo'))
      .then((snap) => {
        setCargoOptions(snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            label: String(raw.label ?? raw.name ?? d.id),
            widthMm: Number(raw.widthMm ?? 0),
            heightMm: Number(raw.heightMm ?? 0),
            depthMm: Number(raw.depthMm ?? 0),
          } as CargoOption;
        }));
      })
      .catch((err) => console.error('useCargo:', err));
  }, []);

  return cargoOptions;
}

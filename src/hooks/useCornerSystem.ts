import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CornerSystemOption } from '../types';

export function useCornerSystem() {
  const [cornerSystemOptions, setCornerSystemOptions] = useState<CornerSystemOption[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'cornerSystems'))
      .then((snap) => {
        setCornerSystemOptions(snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            label: String(raw.label ?? raw.name ?? d.id),
            side: (raw.type === 'right' || raw.type === 'prawy') ? 'right' : 'left',
            modelType: raw.modelType ? String(raw.modelType) : undefined,
            widthMm: Number(raw.widthMm ?? 0),
            depthMm: Number(raw.depthMm ?? 0),
            heightFromMm: Number(raw.heightFromMm ?? 0),
            heightToMm: Number(raw.heightToMm ?? 9999),
            pricePln: raw.pricePln !== undefined ? Number(raw.pricePln) : undefined,
          } as CornerSystemOption;
        }));
      })
      .catch((err) => console.error('useCornerSystem:', err));
  }, []);

  return cornerSystemOptions;
}

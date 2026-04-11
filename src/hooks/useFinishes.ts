import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { extractDominantColor } from './colorUtils';

export interface FinishOption {
  id: string;
  label: string;
  brand: string;
  type: 'laminat' | 'okleina' | 'akryl' | 'lakier';
  pricePerSqmPln: number;
  imageBase64?: string;
  colorHex?: string;
}

export function useFinishes(collectionName = 'finishes', ordered = true) {
  const [finishes, setFinishes] = useState<FinishOption[]>([]);

  useEffect(() => {
    const col = collection(db, collectionName);
    const q = ordered ? query(col, orderBy('createdAt', 'desc')) : query(col);
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinishOption));
      const withColors = await Promise.all(raw.map(async (f) => {
        if (f.imageBase64 && !f.colorHex) {
          const colorHex = await extractDominantColor(f.imageBase64);
          return { ...f, colorHex };
        }
        return f;
      }));
      setFinishes(withColors);
    });
    return unsub;
  }, [collectionName, ordered]);

  return finishes;
}

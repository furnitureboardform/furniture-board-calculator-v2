import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_COUNTERTOP_THICKNESS_MM } from '../constants';
import { extractDominantColor } from './colorUtils';

export interface CountertopOption {
  id: string;
  label: string;
  brand: string;
  thicknessMm: number;
  pricePerSqmPln: number;
  imageBase64?: string;
  colorHex?: string;
}

export function useCountertops() {
  const [countertops, setCountertops] = useState<CountertopOption[]>([]);

  useEffect(() => {
    let mounted = true;
    getDocs(query(collection(db, 'countertops'), orderBy('createdAt')))
      .then(async (snap) => {
        const raw = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            label: String(data.label ?? ''),
            brand: String(data.brand ?? ''),
            thicknessMm: Number(data.thicknessMm ?? DEFAULT_COUNTERTOP_THICKNESS_MM),
            pricePerSqmPln: Number(data.pricePerSqmPln ?? 0),
            imageBase64: data.imageBase64 ?? undefined,
            colorHex: data.colorHex ?? undefined,
          } as CountertopOption;
        });
        const withColors = await Promise.all(raw.map(async (c) => {
          if (c.imageBase64 && !c.colorHex) {
            const colorHex = await extractDominantColor(c.imageBase64, '#8b6914');
            return { ...c, colorHex };
          }
          return c;
        }));
        if (mounted) setCountertops(withColors);
      })
      .catch((err) => console.error('useCountertops:', err));
    return () => { mounted = false; };
  }, []);

  return countertops;
}

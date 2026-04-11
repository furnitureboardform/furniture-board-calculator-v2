import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_COUNTERTOP_THICKNESS_MM } from '../constants';

export interface CountertopOption {
  id: string;
  label: string;
  brand: string;
  thicknessMm: number;
  pricePln: number;
  imageBase64?: string;
}

export function useCountertops() {
  const [countertops, setCountertops] = useState<CountertopOption[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'countertops'), orderBy('createdAt')))
      .then((snap) => {
        setCountertops(snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            label: String(raw.label ?? ''),
            brand: String(raw.brand ?? ''),
            thicknessMm: Number(raw.thicknessMm ?? DEFAULT_COUNTERTOP_THICKNESS_MM),
            pricePln: Number(raw.pricePln ?? 0),
            imageBase64: raw.imageBase64 ?? undefined,
          } as CountertopOption;
        }));
      })
      .catch((err) => console.error('useCountertops:', err));
  }, []);

  return countertops;
}

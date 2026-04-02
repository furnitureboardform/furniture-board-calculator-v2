import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FinishOption {
  id: string;
  label: string;
  brand: string;
  type: 'laminat' | 'okleina' | 'akryl' | 'lakier';
  pricePerSqmPln: number;
  imageBase64?: string;
}

export function useFinishes() {
  const [finishes, setFinishes] = useState<FinishOption[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'finishes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setFinishes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinishOption)));
    });
    return unsub;
  }, []);

  return finishes;
}

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface HandleOption {
  id: string;
  label: string;
  brand: string;
  pricePln: number;
  imageBase64?: string;
}

export function useHandles() {
  const [handles, setHandles] = useState<HandleOption[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'handles'), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HandleOption));
      setHandles(docs.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '')));
    }, (err) => console.error('useHandles:', err));
    return unsub;
  }, []);

  return handles;
}

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
  colorHex?: string;
}

function extractDominantColor(imageBase64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      resolve(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    };
    img.onerror = () => resolve('#c8a97a');
    img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  });
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

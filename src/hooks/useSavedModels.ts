import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { BoardSize, BoxElement } from '../types';

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export interface SavedModel {
  id: string;
  name: string;
  createdAt: Date;
  elements: BoxElement[];
  boardSize?: BoardSize;
}

export function useSavedModels() {
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'models'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const models: SavedModel[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name as string,
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        elements: d.data().elements as BoxElement[],
        boardSize: d.data().boardSize as BoardSize | undefined,
      }));
      setSavedModels(models);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const saveModel = async (name: string, elements: BoxElement[], boardSize?: BoardSize) => {
    const payload = stripUndefined({ name, elements, boardSize });
    const docRef = await addDoc(collection(db, 'models'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    const newModel: SavedModel = { id: docRef.id, name, createdAt: new Date(), elements, boardSize };
    setSavedModels((prev) => [newModel, ...prev]);
    return docRef.id;
  };

  const deleteModel = async (id: string) => {
    await deleteDoc(doc(db, 'models', id));
    setSavedModels((prev) => prev.filter((m) => m.id !== id));
  };

  const overwriteModel = async (id: string, elements: BoxElement[], boardSize?: BoardSize) => {
    const payload = stripUndefined({ elements, boardSize });
    await setDoc(doc(db, 'models', id), payload, { merge: true });
    setSavedModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, elements, boardSize } : m))
    );
  };

  return { savedModels, loading, saveModel, deleteModel, overwriteModel, fetchModels };
}

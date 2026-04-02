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
import type { BoxElement } from '../types';

export interface SavedModel {
  id: string;
  name: string;
  createdAt: Date;
  elements: BoxElement[];
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
      }));
      setSavedModels(models);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const saveModel = async (name: string, elements: BoxElement[]) => {
    const docRef = await addDoc(collection(db, 'models'), {
      name,
      elements,
      createdAt: serverTimestamp(),
    });
    const newModel: SavedModel = { id: docRef.id, name, createdAt: new Date(), elements };
    setSavedModels((prev) => [newModel, ...prev]);
    return docRef.id;
  };

  const deleteModel = async (id: string) => {
    await deleteDoc(doc(db, 'models', id));
    setSavedModels((prev) => prev.filter((m) => m.id !== id));
  };

  const overwriteModel = async (id: string, elements: BoxElement[]) => {
    await setDoc(doc(db, 'models', id), { elements }, { merge: true });
    setSavedModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, elements } : m))
    );
  };

  return { savedModels, loading, saveModel, deleteModel, overwriteModel, fetchModels };
}

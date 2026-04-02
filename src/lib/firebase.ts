import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDWdAyjh4oSw7xbc6j-KBAOl7boREHGOIw',
  authDomain: 'furniture-fa9a9.firebaseapp.com',
  projectId: 'furniture-fa9a9',
  storageBucket: 'furniture-fa9a9.firebasestorage.app',
  messagingSenderId: '609521866144',
  appId: '1:609521866144:web:3b114a0d2842053fc580c5',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

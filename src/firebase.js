import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAOJsK07IzQXXXP-9RRu2Yfvaoo1csSjmg",
  authDomain: "king-game-de3f6.firebaseapp.com",
  projectId: "king-game-de3f6",
  storageBucket: "king-game-de3f6.firebasestorage.app",
  messagingSenderId: "716700061040",
  appId: "1:716700061040:web:e0c18ab4e25f8041c5d3b5",
  measurementId: "G-X3K2BWCMXQ",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

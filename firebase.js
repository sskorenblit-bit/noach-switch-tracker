import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD-HdtyjxleUVhYtqDsgubrsGmznUjh1X0",
  authDomain: "noach-switch-tracker.firebaseapp.com",
  projectId: "noach-switch-tracker",
  storageBucket: "noach-switch-tracker.firebasestorage.app",
  messagingSenderId: "937495175962",
  appId: "1:937495175962:web:d04a78764d7bdb63b002a3"
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);

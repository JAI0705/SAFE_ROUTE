// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBK49ENdI873Fz4LbJjSrUUGWP4VcrjPzw",
  authDomain: "safe-route-127fd.firebaseapp.com",
  projectId: "safe-route-127fd",
  storageBucket: "safe-route-127fd.appspot.com",
  messagingSenderId: "846278661816",
  appId: "1:846278661816:web:7ffb7511b84cd95ed6464d",
  measurementId: "G-NMD0018HQP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

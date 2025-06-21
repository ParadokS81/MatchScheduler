// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy7k2ivo3x0LBLM0GKG6-AAaKfP8-snbs",
  authDomain: "quakeworld-match-scheduler.firebaseapp.com",
  projectId: "quakeworld-match-scheduler",
  storageBucket: "quakeworld-match-scheduler.firebasestorage.app",
  messagingSenderId: "697734297374",
  appId: "1:697734297374:web:40a0310889774e56a87b0f",
  measurementId: "G-YV0XPLSC25"
};

// Initialize Firebase (using compat version as specified in PRD)
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Initialize Functions
const functions = firebase.functions(); 
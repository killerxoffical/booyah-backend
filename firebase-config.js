// Include this file AFTER the Firebase compat SDKs in your HTML files

const firebaseConfig = {
  apiKey: "AIzaSyAwhCQ6UN-xmI2xMKsT5V_11LrHCDYn4Yo",
  authDomain: "booyahdaylive.firebaseapp.com",
  projectId: "booyahdaylive",
  storageBucket: "booyahdaylive.firebasestorage.app",
  messagingSenderId: "607763134560",
  appId: "1:607763134560:web:c35120fcef7e5877d1ab05"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Helper function to generate a random UID for display (e.g. 8 digits)
function generateDisplayUID() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

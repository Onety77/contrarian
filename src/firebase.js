import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAdYOWVOY1KSc6Ns1l3CV3sW-Y6kxhJHWg",
  authDomain: "the-contrarian.firebaseapp.com",
  projectId: "the-contrarian",
  storageBucket: "the-contrarian.firebasestorage.app",
  messagingSenderId: "1043559632677",
  appId: "1:1043559632677:web:4a9bd084a7782c3e98d4cc"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

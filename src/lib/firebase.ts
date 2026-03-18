import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'

const env = (key: string) => (import.meta.env[key] as string || '').trim()

const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestore = getFirestore(app)
export const functions = getFunctions(app, 'asia-northeast3')

// Connect to emulator in development
if (import.meta.env.DEV && env('VITE_FIREBASE_FUNCTIONS_EMULATOR')) {
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

// B-03: Typed callable function helper
export function callable<TData, TResult>(name: string) {
  return httpsCallable<TData, TResult>(functions, name)
}

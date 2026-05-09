import { initializeApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getDatabase, ref, get, push } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyA1hWDQQtz1deLvzrqDUp9F4dnLUojKyik",
  authDomain: "minha-cobra-3c5f5.firebaseapp.com",
  databaseURL: "https://minha-cobra-3c5f5-default-rtdb.firebaseio.com",
  projectId: "minha-cobra-3c5f5",
  storageBucket: "minha-cobra-3c5f5.firebasestorage.app",
  messagingSenderId: "47670491084",
  appId: "1:47670491084:web:53c9f93aa5f9ed1aee8f69",
  measurementId: "G-0DHT39G705"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

export type LeaderboardEntry = {
  name: string
  score: number
  date: string
}

const LEADERBOARD_PATH = 'leaderboard'

// ── Auth ─────────────────────────────────────────────────────────────────────
export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function loginEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signupEmail(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  return cred
}

export async function loginGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function logout() {
  return signOut(auth)
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
/**
 * Fetch top 5 leaderboard entries from Realtime Database.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const leaderboardRef = ref(db, LEADERBOARD_PATH)
    const snapshot = await get(leaderboardRef)
    if (!snapshot.exists()) return []

    const data = snapshot.val()
    const entries: LeaderboardEntry[] = Object.values(data)
    entries.sort((a, b) => b.score - a.score)
    return entries.slice(0, 5)
  } catch (err) {
    console.error('Error fetching leaderboard:', err)
    return []
  }
}

/**
 * Submit a score to the Realtime Database.
 */
export async function submitScoreRTDB(name: string, score: number): Promise<LeaderboardEntry[]> {
  if (score <= 0) return fetchLeaderboard()

  try {
    const leaderboardRef = ref(db, LEADERBOARD_PATH)
    const newEntry: LeaderboardEntry = {
      name,
      score,
      date: new Date().toISOString().slice(0, 10),
    }
    await push(leaderboardRef, newEntry)

    return fetchLeaderboard()
  } catch (err) {
    console.error('Error submitting score:', err)
    return fetchLeaderboard()
  }
}

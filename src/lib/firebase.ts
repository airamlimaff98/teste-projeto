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
import { getDatabase, ref, get, push, set, remove, onValue, onDisconnect } from 'firebase/database'

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
  mode: 'classic' | 'immortal'
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

// ── Presence (online users) ─────────────────────────────────────────────────
export type OnlineUser = {
  uid: string
  name: string
  email: string
  onlineSince: string
}

const PRESENCE_PATH = 'presence'

/**
 * Start tracking this user's presence. Sets an onDisconnect handler
 * so they're auto-removed if they close the tab.
 */
export async function trackPresence(user: User) {
  const presenceRef = ref(db, `${PRESENCE_PATH}/${user.uid}`)
  const data = {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Player',
    email: user.email || '',
    onlineSince: new Date().toISOString(),
  }
  await set(presenceRef, data)
  onDisconnect(presenceRef).remove()
}

/**
 * Remove this user's presence entry on sign out.
 */
export async function untrackPresence(user: User) {
  const presenceRef = ref(db, `${PRESENCE_PATH}/${user.uid}`)
  await remove(presenceRef)
}

/**
 * Listen to realtime presence updates.
 * Returns an unsubscribe function.
 */
export function onPresenceChange(cb: (users: OnlineUser[]) => void) {
  const presenceRef = ref(db, PRESENCE_PATH)
  const unsub = onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) {
      cb([])
      return
    }
    const data = snapshot.val()
    const users: OnlineUser[] = Object.values(data)
    cb(users)
  })
  return unsub
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
/**
 * Fetch top 5 leaderboard entries from Realtime Database, optionally filtered by mode.
 */
export async function fetchLeaderboard(mode?: 'classic' | 'immortal'): Promise<LeaderboardEntry[]> {
  try {
    const leaderboardRef = ref(db, LEADERBOARD_PATH)
    const snapshot = await get(leaderboardRef)
    if (!snapshot.exists()) return []

    const data = snapshot.val()
    let entries: LeaderboardEntry[] = Object.values(data)

    // Filter by mode if specified
    if (mode) {
      entries = entries.filter(e => e.mode === mode)
    }

    // Deduplicate: keep only the highest score per name
    const best = new Map<string, LeaderboardEntry>()
    for (const entry of entries) {
      const existing = best.get(entry.name)
      if (!existing || entry.score > existing.score) {
        best.set(entry.name, entry)
      }
    }

    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  } catch (err) {
    console.error('Error fetching leaderboard:', err)
    return []
  }
}

/**
 * Submit a score to the Realtime Database.
 */
export async function submitScoreRTDB(name: string, score: number, mode: 'classic' | 'immortal' = 'classic'): Promise<LeaderboardEntry[]> {
  if (score <= 0) return fetchLeaderboard(mode)

  try {
    const leaderboardRef = ref(db, LEADERBOARD_PATH)
    const newEntry: LeaderboardEntry = {
      name,
      score,
      date: new Date().toISOString().slice(0, 10),
      mode,
    }
    await push(leaderboardRef, newEntry)

    return fetchLeaderboard(mode)
  } catch (err) {
    console.error('Error submitting score:', err)
    return fetchLeaderboard(mode)
  }
}

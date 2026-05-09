import { useState, useEffect } from 'react'
import {
  onAuthChange,
  logout,
  trackPresence,
  untrackPresence,
  onPresenceChange,
} from './lib/firebase'
import type { User } from 'firebase/auth'
import type { OnlineUser } from './lib/firebase'
import SnakeGame from './components/SnakeGame'
import AuthScreen from './components/AuthScreen'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [showOnline, setShowOnline] = useState(false)

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u)
      setLoading(false)
      if (u) trackPresence(u)
    })
    return () => {
      unsub()
      if (user) untrackPresence(user)
    }
  }, [])

  // Listen to presence when authenticated
  useEffect(() => {
    if (!user) { setOnlineUsers([]); return }
    const unsub = onPresenceChange((users) => setOnlineUsers(users))
    return unsub
  }, [user])

  const handleLogout = async () => {
    if (user) await untrackPresence(user)
    logout()
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return (
    <div className="app-snake">
      <div className="app-topbar">
        <div className="app-topbar-left">
          <span className="app-user">👤 {user.displayName || user.email}</span>
          <button className="app-online-toggle" onClick={() => setShowOnline((v) => !v)}>
            🟢 {onlineUsers.length}
          </button>
        </div>
        <button className="app-logout" onClick={handleLogout}>Sign out</button>
      </div>

      {showOnline && (
        <div className="online-panel">
          <div className="online-header">
            <span>🟢 Online — {onlineUsers.length}</span>
            <button className="online-close" onClick={() => setShowOnline(false)}>✕</button>
          </div>
          <div className="online-list">
            {onlineUsers.length === 0
              ? <p className="online-empty">No one online</p>
              : onlineUsers.map((u) => (
                  <div key={u.uid} className="online-row">
                    <span className="online-dot" />
                    <span className="online-name">{u.name}</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      <SnakeGame playerName={user.displayName || user.email?.split('@')[0] || 'Player'} />
    </div>
  )
}

export default App

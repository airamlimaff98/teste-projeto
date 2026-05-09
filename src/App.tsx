import { useState, useEffect } from 'react'
import { onAuthChange, logout } from './lib/firebase'
import type { User } from 'firebase/auth'
import SnakeGame from './components/SnakeGame'
import AuthScreen from './components/AuthScreen'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <div className="app-snake">
      <div className="app-topbar">
        <span className="app-user">👤 {user.displayName || user.email}</span>
        <button className="app-logout" onClick={logout}>Sign out</button>
      </div>
      <SnakeGame playerName={user.displayName || user.email?.split('@')[0] || 'Player'} />
    </div>
  )
}

export default App

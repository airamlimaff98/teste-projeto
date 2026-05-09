import { useState, useRef, useCallback } from 'react'
import { loginEmail, signupEmail, loginGoogle } from '../lib/firebase'
import './AuthScreen.css'

type AuthMode = 'login' | 'signup'

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = emailRef.current?.value.trim() || ''
    const password = passwordRef.current?.value || ''
    const name = nameRef.current?.value.trim() || ''

    if (!email || !password) {
      setError('Fill in all fields.')
      setLoading(false)
      return
    }

    if (mode === 'signup' && !name) {
      setError('Enter your name.')
      setLoading(false)
      return
    }

    try {
      if (mode === 'login') {
        await loginEmail(email, password)
      } else {
        await signupEmail(email, password, name)
      }
    } catch (err: any) {
      const msg = err?.code
        ? err.code.replace('auth/', '').replace(/-/g, ' ')
        : 'An error occurred.'
      setError(msg.charAt(0).toUpperCase() + msg.slice(1))
    } finally {
      setLoading(false)
    }
  }, [mode])

  const handleGoogle = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await loginGoogle()
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🐍</span>
          <h1>SNAKE</h1>
          <p className="auth-subtitle">Sign in to play</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              ref={nameRef}
              className="auth-input"
              type="text"
              placeholder="Your name"
              maxLength={24}
              autoFocus
            />
          )}
          <input
            ref={emailRef}
            className="auth-input"
            type="email"
            placeholder="Email"
            autoFocus={mode === 'login'}
          />
          <input
            ref={passwordRef}
            className="auth-input"
            type="password"
            placeholder="Password"
          />

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-btn auth-btn--primary" type="submit" disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="auth-btn auth-btn--google" onClick={handleGoogle} disabled={loading}>
          <svg viewBox="0 0 48 48" width="18" height="18">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.56l7.97-5.97z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="auth-toggle">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setMode('signup'); setError('') }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('login'); setError('') }}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}

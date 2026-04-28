import { useState } from 'react'
import styles from './LoginPage.module.css'

interface LoginPageProps {
  onLogin: (session: { role: 'admin' | 'client'; email: string }) => void
}

const AFFINE_LOGO_URL = 'https://acis.affineanalytics.co.in/assets/images/logo_small.png'
const CREDENTIALS = {
  admin: { email: 'admin@affine.ai', password: 'affine@123' },
  client: { email: 'client.user@affine.ai', password: 'affine@098' },
} as const

export function LoginPage({ onLogin }: LoginPageProps) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ loginId?: string; password?: string }>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const nextErrors: { loginId?: string; password?: string } = {}
    if (!loginId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)) {
      nextErrors.loginId = 'Please enter a valid login id.'
    }
    if (!password) {
      nextErrors.password = 'Password is required.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate()) return

    setLoading(true)
    setApiError('')
    try {
      const normalizedEmail = loginId.trim().toLowerCase()
      const matchedAdmin =
        normalizedEmail === CREDENTIALS.admin.email && password === CREDENTIALS.admin.password
      const matchedClient =
        normalizedEmail === CREDENTIALS.client.email && password === CREDENTIALS.client.password

      if (!matchedAdmin && !matchedClient) {
        throw new Error('Invalid Login ID or Password.')
      }

      if (matchedClient) {
        try {
          await fetch('/api/start-mail/onboarding-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'client',
              sender: 'sowmya.sri@affine.ai',
              recipient: 'sowmya.sri0112@gmail.com',
              client_name: 'Annex Analytics',
              product_name: 'Cortexa',
            }),
          })
        } catch (emailErr) {
          // Login should continue even if onboarding email fails.
          console.error('Failed to trigger onboarding email after login', emailErr)
        }
      }

      onLogin({
        role: matchedAdmin ? 'admin' : 'client',
        email: normalizedEmail,
      })
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <img src={AFFINE_LOGO_URL} alt="Affine logo" className={styles.brandLogo} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>AFFINE</span>
            <span className={styles.brandTag}>Command the new</span>
          </div>
        </div>
        <h1 className={styles.headline}>IntegrateIQ AI</h1>
      </div>

      <div className={styles.right}>
        <div className={styles.box}>
          <h2 className={styles.title}>Login</h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label}>LogIn ID</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>✉</span>
                <input
                  type="email"
                  className={`${styles.input} ${errors.loginId ? styles.inputError : ''}`}
                  placeholder="Enter your login ID"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {errors.loginId && <p className={styles.error}>{errors.loginId}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  type="password"
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {errors.password && <p className={styles.error}>{errors.password}</p>}
            </div>

            {apiError ? <p className={`${styles.error} ${styles.apiError}`}>{apiError}</p> : null}

            <button type="submit" className={styles.btnLogin} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

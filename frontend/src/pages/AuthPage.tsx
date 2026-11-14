import { useState, type FormEvent } from 'react'
import { api, explain } from '../lib/api'

export default function AuthPage({ signup, onLogin, onSwitch }: { signup: boolean; onLogin: (token: string) => void; onSwitch: () => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const credentials = { cust_mail: String(data.get('cust_mail')).trim(), password: String(data.get('password')) }
    setBusy(true); setError('')
    try {
      if (signup) {
        const lname = String(data.get('lname')).trim()
        await api('/signup', '', { ...credentials, fname: String(data.get('fname')).trim(), ...(lname && { lname }), cust_cont: String(data.get('cust_cont')).trim() })
      }
      const session = await api<{ token: string }>('/login', '', credentials)
      onLogin(session.token)
    } catch (error) { setError(explain(error)) }
    finally { setBusy(false) }
  }
  return <section className="panel form-panel"><p className="eyebrow">TABLE & TAKEAWAY</p><h1>{signup ? 'Create your account' : 'Log in'}</h1>
    <form onSubmit={submit}>
      {signup && <><div className="form-grid"><label>First name<input name="fname" required maxLength={50} autoComplete="given-name" /></label><label>Last name<input name="lname" maxLength={50} autoComplete="family-name" /></label></div><label>Phone number<input name="cust_cont" type="tel" required pattern="[+]?[0-9]{10,14}" autoComplete="tel" /></label></>}
      <label>Email address<input name="cust_mail" type="email" required maxLength={100} autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={signup ? 'new-password' : 'current-password'} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>
    </form>
    <p>{signup ? 'Already have an account?' : 'New here?'} <a href={signup ? '#/login' : '#/signup'} onClick={onSwitch}>{signup ? 'Log in' : 'Create an account'}</a></p>
  </section>
}

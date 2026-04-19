import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.username || !form.password) { toast.error('Please fill all fields.'); return }
    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-surface-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-surface-900 text-4xl font-bold mb-2">Restaurant<br/><span className="text-brand-600">Manager</span></h1>
          <p className="text-surface-500 text-sm">Admin Portal — Sign in to continue</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label className="label">Username</label>
              <input className="input" type="text" placeholder="admin" autoFocus
                value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} />
            </div>
            <button type="submit" className="btn-primary btn w-full btn-lg justify-center" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-surface-500 text-xs mt-6">
          Default login: <span className="text-surface-800">admin</span> or <span className="text-surface-800">admin@restaurant.com</span>
          {' · '}
          Password: <span className="text-surface-800">Admin@1234</span>
        </p>
      </div>
    </div>
  )
}

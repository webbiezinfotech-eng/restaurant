import { createContext, useContext, useState, useEffect } from "react"
import { authAPI } from "../services/api"
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => { try { return JSON.parse(localStorage.getItem("admin_user")) } catch { return null } })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (token) { authAPI.me().then(r => { setAdmin(r.data.data); setLoading(false) }).catch(() => { localStorage.clear(); setAdmin(null); setLoading(false) }) }
    else setLoading(false)
  }, [])
  const login = async (username, password) => {
    const res = await authAPI.login({ username, password })
    const { token, admin: user } = res.data.data
    localStorage.setItem("auth_token", token)
    localStorage.setItem("admin_user", JSON.stringify(user))
    setAdmin(user); return user
  }
  const logout = async () => {
    try { await authAPI.logout() } catch {}
    localStorage.clear(); setAdmin(null)
  }
  return <AuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated: !!admin }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Tables from './pages/tables/Tables'
import OrderPage from './pages/orders/OrderPage'
import RunningOrders from './pages/orders/RunningOrders'
import Bills from './pages/billing/Bills'
import BillDetail from './pages/billing/BillDetail'
import Categories from './pages/menu/Categories'
import MenuItems from './pages/menu/MenuItems'
import Reports from './pages/reports/Reports'
import Settings from './pages/settings/Settings'
import GuestHouse from './pages/guesthouse/GuestHouse'

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center text-surface-400 text-sm">Loading...</div>
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tables" element={<Tables />} />
          <Route path="orders/new/:type" element={<OrderPage />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="orders" element={<RunningOrders />} />
          <Route path="bills" element={<Bills />} />
          <Route path="bills/:billNumber" element={<BillDetail />} />
          <Route path="menu/categories" element={<Categories />} />
          <Route path="menu/items" element={<MenuItems />} />
          <Route path="reports" element={<Reports />} />
          <Route path="guest-house" element={<GuestHouse />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}

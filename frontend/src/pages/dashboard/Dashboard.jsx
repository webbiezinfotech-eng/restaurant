import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI } from '../../services/api'
import { formatCurrency, formatDateTime, orderTypeLabel } from '../../utils/format'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Pagination from '../../components/ui/Pagination'

function StatCard({ label, value, icon, color = 'brand', sub }) {
  const colors = { brand: 'bg-brand-50 text-brand-600', green: 'bg-green-50 text-green-600', blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-700' }
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-surface-500 font-medium">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${colors[color]}`}>{icon}</span>
      </div>
      <div className="text-2xl font-display font-bold text-surface-900">{value}</div>
      {sub && <div className="text-xs text-surface-400">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [recentSearch, setRecentSearch] = useState('')
  const perPage = 6
  const navigate = useNavigate()

  useEffect(() => {
    dashboardAPI.get().then(r => { setData(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (!data) return <div className="text-surface-400 text-center py-20">Failed to load dashboard.</div>

  const sym = '₹'
  const recentOrders = (data.recent_orders || []).filter(o => {
    const q = recentSearch.trim().toLowerCase()
    if (!q) return true
    return String(o.order_number || '').toLowerCase().includes(q)
      || String(o.table_label || '').toLowerCase().includes(q)
      || String(o.guest_name || '').toLowerCase().includes(q)
      || String(o.status || '').toLowerCase().includes(q)
  })
  const pages = Math.max(1, Math.ceil(recentOrders.length / perPage))
  const pagedRecentOrders = recentOrders.slice((page - 1) * perPage, page * perPage)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">Today's overview — {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/tables')} className="btn-primary btn">+ Dine In Order</button>
          <button onClick={() => navigate('/orders/new/guest-house')} className="btn-secondary btn">+ Guest House</button>
        </div>
      </div>

      {/* Operational cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Running Orders" value={data.running_orders}     icon="⚡" color="amber" />
        <StatCard label="Active Tables"  value={data.active_tables}      icon="⊞" color="blue" />
        <StatCard label="Bills Closed"   value={data.closed_bills_today} icon="✓" color="green" sub="Today" />
        <StatCard label="Total Orders"   value={data.today_orders}       icon="📋" color="brand" sub="Billed today" />
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="font-display font-bold text-surface-900 text-lg">Recent Orders</h2>
          <div className="flex items-center gap-2">
            <input
              className="input w-56"
              placeholder="Search recent orders..."
              value={recentSearch}
              onChange={e => { setRecentSearch(e.target.value); setPage(1) }}
            />
            <button onClick={() => navigate('/orders')} className="btn-ghost btn btn-sm text-brand-500">View all →</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto">
            <thead><tr>
              <th className="th">Order #</th><th className="th">Type</th><th className="th">Table / Guest</th>
              <th className="th">Status</th><th className="th">Amount</th><th className="th">Time</th>
            </tr></thead>
            <tbody>
              {recentOrders.length === 0
                ? <tr><td colSpan={6} className="td text-center text-surface-400 py-8">No recent orders</td></tr>
                : pagedRecentOrders.map(o => (
                  <tr key={o.id} className="hover:bg-surface-50 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="td font-mono text-xs font-medium text-brand-600">{o.order_number}</td>
                    <td className="td"><StatusBadge status={o.order_type} /></td>
                    <td className="td text-surface-600">{o.table_label || o.guest_name || '—'}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                    <td className="td font-medium">{formatCurrency(o.grand_total, sym)}</td>
                    <td className="td text-surface-400 text-xs">{formatDateTime(o.created_at)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} onPage={setPage} />
    </div>
  )
}

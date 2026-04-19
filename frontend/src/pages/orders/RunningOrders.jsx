import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { orderAPI } from '../../services/api'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatCurrency, formatDateTime, orderTypeLabel } from '../../utils/format'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import Pagination from '../../components/ui/Pagination'

export default function RunningOrders() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const perPage = 10
  const navigate = useNavigate()

  const load = () => {
    orderAPI.list({ status: 'running' }).then(r => { setOrders(r.data.data.orders); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv) }, [])
  const filteredOrders = orders.filter(o => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return String(o.order_number || '').toLowerCase().includes(q)
      || String(o.table_label || '').toLowerCase().includes(q)
      || String(o.guest_name || '').toLowerCase().includes(q)
      || String(o.order_type || '').toLowerCase().includes(q)
  })
  useEffect(() => { setPage(1) }, [filteredOrders.length, search])
  const pages = Math.max(1, Math.ceil(filteredOrders.length / perPage))
  const pagedOrders = filteredOrders.slice((page - 1) * perPage, page * perPage)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Running Orders</h1>
          <p className="text-sm text-surface-400">{orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/tables')} className="btn-primary btn">+ Dine In</button>
          <button onClick={() => navigate('/orders/new/guest-house')} className="btn-secondary btn">+ Guest House</button>
          <button onClick={load} className="btn-ghost btn">↻</button>
        </div>
      </div>
      <div className="mb-4">
        <input
          className="input w-full sm:w-80"
          placeholder="Search order #, table, guest..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      : orders.length === 0
        ? <EmptyState icon="📋" title="No running orders" message="All clear! Create a new dine-in or guest house order." />
        : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="table-auto">
              <thead><tr>
                <th className="th">Order #</th><th className="th">Type</th><th className="th">Table / Guest</th>
                <th className="th">Items</th><th className="th">Total</th><th className="th">Started</th><th className="th">Action</th>
              </tr></thead>
              <tbody>
                {pagedOrders.map(o => (
                  <tr key={o.id} className="hover:bg-surface-50">
                    <td className="td font-mono text-xs font-medium text-brand-600">{o.order_number}</td>
                    <td className="td"><StatusBadge status={o.order_type} /></td>
                    <td className="td">{o.table_label || o.guest_name || '—'}</td>
                    <td className="td">{o.item_count}</td>
                    <td className="td font-medium">{formatCurrency(o.grand_total)}</td>
                    <td className="td text-surface-400 text-xs">{formatDateTime(o.created_at)}</td>
                    <td className="td">
                      <button onClick={() => navigate(`/orders/${o.id}`)} className="btn-primary btn btn-sm">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )
      }
      <Pagination page={page} pages={pages} onPage={setPage} />
    </div>
  )
}

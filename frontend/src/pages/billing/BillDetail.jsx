import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { billingAPI, orderAPI } from '../../services/api'
import BillReceipt, { BILL_RECEIPT_SCREEN_CSS } from '../../components/billing/BillReceipt'
import Spinner from '../../components/ui/Spinner'
import StatusBadge from '../../components/ui/StatusBadge'
import toast from 'react-hot-toast'
import { printKOT, directPrint, isAndroidDevice } from '../../utils/thermalPrint'

export default function BillDetail() {
  const { billNumber } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [settleMode, setSettleMode] = useState('cash')
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    billingAPI.show(billNumber).then(r => { setData(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [billNumber])

  const handlePrint = async () => {
    if (!data?.bill_number) return
    if (isAndroidDevice()) {
      const result = await directPrint({ type: 'bill', bill: data, settings: data.settings || {} })
      if (result.ok) {
        toast.success(result.message || 'Bill printed!')
        return
      }
    }
    const w = window.open(`/print/bill/${encodeURIComponent(data.bill_number)}`, '_blank', 'width=450,height=750')
    if (!w) toast.error('Popup blocked — browser settings mein allow karo.')
  }

  const handleKOTPrint = async () => {
    if (!data?.order_id) return
    if (isAndroidDevice()) {
      try {
        const orderRes = await orderAPI.show(data.order_id)
        const result = await printKOT(orderRes.data.data)
        if (result.ok && result.method !== 'browser') {
          toast.success(result.message || 'KOT printed!')
          return
        }
      } catch { /* fall through */ }
    }
    const w = window.open(`/print/kot/${data.order_id}`, '_blank', 'width=450,height=750')
    if (!w) toast.error('Popup blocked — browser settings mein allow karo.')
  }

  const markAsPaid = async () => {
    setSettling(true)
    try {
      const r = await billingAPI.markPaid(billNumber, { payment_mode: settleMode })
      setData(r.data.data)
      toast.success('Bill marked as paid.')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update payment.')
    } finally {
      setSettling(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!data) return <div className="text-center py-20 text-surface-400">Bill not found.</div>

  const bill = data
  const settings = data?.settings || {}
  const isGuestHouse = bill.order_type === 'guest_house'

  return (
    <div>
      <style>{BILL_RECEIPT_SCREEN_CSS}</style>
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bills')} className="btn-ghost btn">← Bills</button>
          <h1 className="page-title">Bill #{bill.bill_number}</h1>
          <StatusBadge status={bill.payment_status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {bill.payment_status !== 'paid' && (
            <div className="flex items-center gap-2">
              <select className="input" value={settleMode} onChange={e => setSettleMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">Online (UPI)</option>
              </select>
              <button onClick={markAsPaid} className="btn-primary btn" disabled={settling}>
                {settling ? 'Updating…' : 'Mark Paid'}
              </button>
            </div>
          )}
          <button onClick={handleKOTPrint} className="btn-secondary btn">🖨 KOT Print</button>
          <button onClick={handlePrint} className="btn-primary btn">🖨 Print Bill</button>
          <button onClick={() => navigate(`/orders/${bill.order_id}`)} className="btn-secondary btn">
            {isGuestHouse ? 'Add Items / Order' : 'View Order'}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        <div className="card shadow-card-lg overflow-hidden rounded-2xl">
          <BillReceipt bill={bill} settings={settings} className="bill-receipt-screen" />
        </div>
      </div>
    </div>
  )
}

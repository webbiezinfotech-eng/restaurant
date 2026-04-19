import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { billingAPI } from '../../services/api'
import { formatCurrency, formatDateTime, orderTypeLabel, paymentModeLabel } from '../../utils/format'
import Spinner from '../../components/ui/Spinner'
import StatusBadge from '../../components/ui/StatusBadge'
import toast from 'react-hot-toast'
// import { useEffect } from "react";


function PrintableBill({ bill, settings }) {


useEffect(() => {
  setTimeout(() => {
    window.print();
  }, 500);
}, []);

  const sym = settings?.currency_symbol || '₹'
  return (
    <div className="font-mono text-[13px] leading-relaxed max-w-sm mx-auto bg-white p-6 sm:p-7 rounded-2xl border border-surface-200 shadow-sm">
      <div className="text-center mb-4">
        <h2 className="text-[28px] leading-none font-black tracking-tight">{settings?.business_name || 'Restaurant'}</h2>
        <p className="text-[11px] text-surface-500 mt-2">{settings?.business_address}</p>
        <p className="text-[11px] text-surface-500">{settings?.business_phone}</p>
        <div className="border-t border-dashed border-surface-300 my-3" />
        <p className="font-bold text-sm tracking-[0.2em] text-surface-700">TAX INVOICE</p>
      </div>

      <div className="space-y-1 text-[11px] mb-3">
        <div className="grid grid-cols-2 gap-x-4">
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="text-surface-500 shrink-0">Bill #</span>
            <span className="font-bold text-right truncate">{bill.bill_number}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="text-surface-500 shrink-0">Order #</span>
            <span className="text-right truncate">{bill.order_number}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-surface-500">Date</span>
            <span className="text-right">{formatDateTime(bill.paid_at || bill.created_at)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-surface-500">Type</span>
            <span className="text-right">{orderTypeLabel(bill.order_type)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-surface-500">{bill.table_label ? 'Table' : (bill.guest_room ? 'Room' : 'Table')}</span>
            <span className="text-right">{bill.table_label || bill.guest_room || '-'}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-surface-500">Payment</span>
            <span className="text-right">{paymentModeLabel(bill.payment_mode)}</span>
          </div>
        </div>
        {bill.guest_name && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-surface-500">Guest</span>
            <span className="text-right truncate">{bill.guest_name}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-surface-300 my-3" />
      <table className="w-full text-[12px]">
        <thead><tr className="border-b border-surface-300">
          <th className="text-left pb-1.5">Item</th><th className="text-center pb-1.5">Qty</th><th className="text-right pb-1.5">Rate</th><th className="text-right pb-1.5">Amt</th>
        </tr></thead>
        <tbody>
          {bill.items?.map((item, i) => (
            <tr key={i} className="border-b border-dashed border-surface-200">
              <td className="py-1.5 pr-2">{item.item_name}</td>
              <td className="text-center py-1.5">{item.quantity}</td>
              <td className="text-right py-1.5">{formatCurrency(item.unit_price, sym)}</td>
              <td className="text-right py-1.5 font-medium">{formatCurrency(item.line_total, sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-surface-300 my-3 space-y-1.5 text-[12px]">
        <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(bill.subtotal, sym)}</span></div>
        {parseFloat(bill.tax_amount) > 0 && <div className="flex justify-between"><span className="text-surface-500">Tax</span><span>{formatCurrency(bill.tax_amount, sym)}</span></div>}
        {bill.order_type !== 'guest_house' && parseFloat(bill.commission_amount) > 0 && (
          <div className="flex justify-between"><span className="text-surface-500">Commission</span><span>{formatCurrency(bill.commission_amount, sym)}</span></div>
        )}
        {parseFloat(bill.discount_amount) > 0 && <div className="flex justify-between"><span className="text-surface-500">Discount</span><span>-{formatCurrency(bill.discount_amount, sym)}</span></div>}
        <div className="flex justify-between font-black text-lg border-t border-surface-300 pt-2 mt-1">
          <span>GRAND TOTAL</span><span>{formatCurrency(bill.grand_total, sym)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-surface-300 my-3 text-center text-[11px] text-surface-400">
        <p>{settings?.bill_footer_text || 'Thank you for dining with us!'}</p>
      </div>
    </div>
  )
}

export default function BillDetail() {
  const { billNumber } = useParams()
  const navigate = useNavigate()
  const printRef = useRef()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [settleMode, setSettleMode] = useState('cash')
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    billingAPI.show(billNumber).then(r => { setData(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [billNumber])

  const handlePrint = () => window.print()
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

  return (
    <div>
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bills')} className="btn-ghost btn">← Bills</button>
          <h1 className="page-title">Bill #{bill.bill_number}</h1>
          <StatusBadge status={bill.payment_status} />
        </div>
        <div className="flex gap-3">
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
          <button onClick={handlePrint} className="btn-primary btn">🖨 Print Bill</button>
          <button onClick={() => navigate(`/orders/${bill.order_id}`)} className="btn-secondary btn">View Order</button>
        </div>
      </div>

      <div className="max-w-md mx-auto" ref={printRef}>
        <div className="card shadow-card-lg overflow-hidden rounded-2xl">
          <PrintableBill bill={bill} settings={settings} />
        </div>
      </div>

      <style>{`@media print { .no-print { display: none; } body { background: white; } }`}</style>
    </div>
  )
}

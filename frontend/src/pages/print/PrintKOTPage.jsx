import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { orderAPI } from '../../services/api'
import { directPrint, isAndroidDevice, runPrintDiagnostics } from '../../utils/thermalPrint'

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f5f5f5; color: #000; }
  .wrap { max-width: 320px; margin: 0 auto; padding: 16px; background: #fff; min-height: 100vh; }
  .center { text-align: center; }
  .title { font-size: 14px; font-weight: 700; letter-spacing: 2px; }
  .meta { font-size: 12px; margin: 3px 0; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 6px 0; }
  th, td { padding: 4px 2px; }
  th { border-bottom: 1px solid #000; text-align: left; }
  td.qty, th.qty { text-align: right; width: 40px; }
  .bold { font-weight: 700; }
  .print-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: #111; padding: 12px; text-align: center; z-index: 99;
  }
  .print-btn {
    background: #f97316; color: #fff; border: none;
    font-size: 18px; font-weight: 700; padding: 14px 48px;
    border-radius: 8px; cursor: pointer; width: 100%; max-width: 320px;
    margin-bottom: 8px;
  }
  .print-btn-direct {
    background: #16a34a; color: #fff; border: none;
    font-size: 16px; font-weight: 700; padding: 12px 32px;
    border-radius: 8px; cursor: pointer; width: 100%; max-width: 320px;
  }
  .print-btn:disabled, .print-btn-direct:disabled { opacity: 0.6; cursor: wait; }
  .pos-hint {
    color: #aaa; font-size: 11px; margin-top: 8px; padding: 0 12px; line-height: 1.4;
  }
  @media print {
    body { background: #fff; }
    .wrap { max-width: 100%; padding: 0; min-height: auto; }
    .print-bar, .no-print { display: none !important; }
    @page { margin: 8mm; size: auto; }
  }
`

export default function PrintKOTPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)
  const [posReady, setPosReady] = useState(false)

  useEffect(() => {
    document.title = 'Kitchen Order'
    orderAPI.show(parseInt(orderId))
      .then(r => setOrder(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Order not found.'))
  }, [orderId])

  useEffect(() => {
    if (!isAndroidDevice()) return
    runPrintDiagnostics().then(d => {
      setPosReady(d.cleanter?.ok || !!d.bridge)
    })
  }, [])

  const handleDirectPrint = async () => {
    if (!order) return
    setPrinting(true)
    try {
      const result = await directPrint({ type: 'kot', order })
      if (result.ok) {
        toast.success(result.message || 'KOT printed!')
      } else {
        toast.error(result.message || 'Direct print failed.')
      }
    } catch (e) {
      toast.error(e.message || 'Print failed.')
    } finally {
      setPrinting(false)
    }
  }

  if (error) {
    return <div style={{ padding: 24, textAlign: 'center' }}><p style={{ color: 'red' }}>{error}</p></div>
  }
  if (!order) {
    return <div style={{ padding: 24, textAlign: 'center' }}><p>Loading…</p></div>
  }

  const when = new Date().toLocaleString('en-IN')
  const place = order.order_type === 'dine_in' ? 'RESTAURANT (DINE IN)' : (order.guest_address || 'GUEST HOUSE')
  const location = order.order_type === 'dine_in'
    ? `TABLE: ${order.table_number || order.table_label || '-'}`
    : `ROOM: ${order.guest_room || '-'}`

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="wrap">
        <div className="center title">KITCHEN ORDER</div>
        <div className="line" />
        <div className="center meta bold">ORDER: {order.order_number || order.id}</div>
        <div className="meta">DATE: {when}</div>
        <div className="meta">PLACE: {place}</div>
        <div className="meta">{location}</div>
        <div className="line" />
        <table>
          <thead><tr><th>ITEM</th><th className="qty">QTY</th></tr></thead>
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i}>
                <td>{String(item.item_name || '').toUpperCase()}</td>
                <td className="qty">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="line" />
        <div className="center bold">TOTAL ITEMS: {order.items?.length || 0}</div>
        <div style={{ height: 120 }} className="no-print" />
      </div>
      <div className="print-bar no-print">
        {isAndroidDevice() && (
          <>
            <button
              className="print-btn-direct"
              onClick={handleDirectPrint}
              disabled={printing}
            >
              {printing ? 'Printing…' : posReady ? '🖨 DIRECT PRINT (POS)' : '🖨 TRY DIRECT PRINT'}
            </button>
            <p className="pos-hint">
              {posReady
                ? 'Built-in printer ready — DIRECT PRINT dabao'
                : 'Cleanter app chahiye — Settings → Printer Test dekho'}
            </p>
          </>
        )}
        <button className="print-btn" onClick={() => window.print()} disabled={printing}>
          🖨 BROWSER PRINT
        </button>
      </div>
    </>
  )
}

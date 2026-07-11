import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { billingAPI } from '../../services/api'
import BillReceipt, { BILL_RECEIPT_CSS } from '../../components/billing/BillReceipt'
import { directPrint, isAndroidDevice, runPrintDiagnostics } from '../../utils/thermalPrint'

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f5f5f5; color: #000; }
  .wrap { max-width: 340px; margin: 0 auto; padding: 16px; background: #fff; min-height: 100vh; }
  ${BILL_RECEIPT_CSS}
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

export default function PrintBillPage() {
  const { billNumber } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)
  const [posReady, setPosReady] = useState(false)

  useEffect(() => {
    document.title = `Bill ${billNumber}`
    billingAPI.show(billNumber)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Bill not found.'))
  }, [billNumber])

  useEffect(() => {
    if (!isAndroidDevice()) return
    runPrintDiagnostics().then(d => {
      setPosReady(d.cleanter?.ok || !!d.bridge)
    })
  }, [])

  const handleDirectPrint = async () => {
    if (!data) return
    setPrinting(true)
    try {
      const result = await directPrint({
        type: 'bill',
        bill: data,
        settings: data.settings || {},
      })
      if (result.ok) {
        toast.success(result.message || 'Printed!')
      } else {
        toast.error(result.message || 'Direct print failed — browser print try karo.')
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
  if (!data) {
    return <div style={{ padding: 24, textAlign: 'center' }}><p>Loading bill…</p></div>
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="wrap">
        <BillReceipt bill={data} settings={data.settings || {}} />
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

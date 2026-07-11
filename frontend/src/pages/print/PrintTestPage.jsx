import { Link } from 'react-router-dom'

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f5f5f5; color: #000; }
  .wrap { max-width: 320px; margin: 0 auto; padding: 16px; background: #fff; min-height: 100vh; }
  .center { text-align: center; }
  .biz { font-size: 16px; font-weight: 700; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  .bill-no { font-size: 28px; font-weight: 700; margin: 4px 0; }
  .print-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #111; padding: 12px; text-align: center; }
  .print-btn { background: #f97316; color: #fff; border: none; font-size: 18px; font-weight: 700; padding: 14px 48px; border-radius: 8px; cursor: pointer; width: 100%; max-width: 320px; }
  @media print { .print-bar { display: none !important; } @page { margin: 8mm; } }
`

export default function PrintTestPage({ type = 'bill' }) {
  const isKot = type === 'kot'
  const handlePrint = () => window.print()

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="wrap">
        {isKot ? (
          <>
            <div className="center" style={{ fontWeight: 700, letterSpacing: 2 }}>KITCHEN ORDER</div>
            <div className="line" />
            <div className="center">ORDER: TEST-001</div>
            <div className="line" />
            <div>MASALA DOSA — 2</div>
            <div>PRINT TEST OK — 1</div>
            <div className="line" />
            <div className="center" style={{ fontWeight: 700 }}>TOTAL ITEMS: 2</div>
          </>
        ) : (
          <>
            <div className="center biz">Restaurant Manager</div>
            <div className="line" />
            <div className="center" style={{ fontWeight: 700, letterSpacing: 2 }}>TAX INVOICE</div>
            <div className="line" />
            <div className="center bill-no">TEST</div>
            <div className="center" style={{ fontSize: 11 }}>{new Date().toLocaleString('en-IN')}</div>
            <div className="line" />
            <div>Print Test Item x1 — ₹70.00</div>
            <div className="line" />
            <div className="center" style={{ fontSize: 22, fontWeight: 700 }}>₹70.00</div>
            <div className="line" />
            <div className="center" style={{ fontWeight: 700 }}>**** PRINTER TEST OK ****</div>
          </>
        )}
        <div style={{ height: 80 }} />
      </div>
      <div className="print-bar">
        <button className="print-btn" onClick={handlePrint}>
          🖨 PRINT {isKot ? 'KOT' : 'BILL'} (TEST)
        </button>
        <p style={{ color: '#aaa', fontSize: 11, marginTop: 8 }}>
          <Link to="/settings/print-test" style={{ color: '#f97316' }}>← Back to Printer Test</Link>
        </p>
      </div>
    </>
  )
}

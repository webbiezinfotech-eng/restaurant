import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  checkPopupAllowed,
  isAndroidDevice,
  runPrintDiagnostics,
  testDirectPrint,
} from '../../utils/thermalPrint'
import Spinner from '../../components/ui/Spinner'

function StatusRow({ label, status, detail }) {
  const colors = {
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    fail: 'bg-red-50 border-red-200 text-red-800',
    pending: 'bg-surface-50 border-surface-200 text-surface-600',
  }
  const icons = { ok: '✓', warn: '!', fail: '✗', pending: '…' }
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${colors[status]}`}>
      <span className="text-lg font-bold w-6 text-center shrink-0">{icons[status]}</span>
      <div className="min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        {detail && <p className="text-xs mt-1 opacity-90">{detail}</p>}
      </div>
    </div>
  )
}

export default function PrintTest() {
  const [loading, setLoading] = useState(true)
  const [popupOk, setPopupOk] = useState(null)
  const [diag, setDiag] = useState(null)
  const [testing, setTesting] = useState(false)

  const runDiagnostics = useCallback(async () => {
    setPopupOk(checkPopupAllowed())
    const d = await runPrintDiagnostics()
    setDiag(d)
  }, [])

  useEffect(() => {
    runDiagnostics().finally(() => setLoading(false))
  }, [runDiagnostics])

  const openTest = type => {
    window.open(`/print/test/${type}`, '_blank', 'width=450,height=750')
  }

  const handleDirectTest = async type => {
    setTesting(true)
    try {
      const result = await testDirectPrint(type)
      if (result.ok) {
        toast.success(result.message || 'Print sent!')
      } else {
        toast.error(result.message || 'Direct print failed.')
      }
    } catch (e) {
      toast.error(e.message || 'Failed.')
    } finally {
      setTesting(false)
    }
  }

  const posReady = diag?.cleanter?.ok || !!diag?.bridge
  const isAndroid = diag?.android

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <div>
          <Link to="/settings" className="text-sm text-brand-600 hover:underline mb-1 inline-block">← Settings</Link>
          <h1 className="page-title">Printer Test</h1>
          <p className="text-sm text-surface-500 mt-1">
            Normal printer (A4/thermal) aur HM POS built-in printer dono ke liye.
          </p>
        </div>
        <button onClick={runDiagnostics} className="btn-secondary btn btn-sm">Re-check</button>
      </div>

      <div className="card p-6 mb-5">
        <h2 className="font-display font-bold text-surface-900 text-lg mb-4">System Check</h2>
        <div className="space-y-3">
          <StatusRow
            label="Device type"
            status={isAndroid ? 'warn' : 'ok'}
            detail={isAndroid
              ? 'Android POS detected (SGT-116 / HM Technosys) — built-in printer ke liye Cleanter chahiye'
              : 'Desktop/Laptop — browser print kaafi hai'}
          />
          <StatusRow
            label="Cleanter bridge (HM POS ke liye)"
            status={!isAndroid ? 'ok' : diag?.cleanter?.ok ? 'ok' : 'fail'}
            detail={!isAndroid
              ? 'Sirf Android POS par chahiye'
              : diag?.cleanter?.ok
                ? 'Cleanter running ✓ — direct print kaam karega'
                : 'Cleanter app install karo aur Start dabao (neeche steps)'}
          />
          <StatusRow
            label="Native POS bridge"
            status={diag?.bridge ? 'ok' : isAndroid ? 'warn' : 'ok'}
            detail={diag?.bridge
              ? `${diag.bridge.name} detected ✓`
              : isAndroid ? 'Koi vendor bridge nahi mila — Cleanter use karo' : 'N/A on desktop'}
          />
          <StatusRow
            label="Browser popups"
            status={popupOk === null ? 'pending' : popupOk ? 'ok' : 'fail'}
            detail={popupOk ? 'Popups allowed ✓' : 'Popups blocked — site settings mein Allow karo'}
          />
        </div>
      </div>

      {isAndroid && !posReady && (
        <div className="card p-6 mb-5 border-amber-300 bg-amber-50">
          <h2 className="font-display font-bold text-amber-900 text-lg mb-3">
            ⚠️ HM POS (SGT-116) — Setup zaroori hai
          </h2>
          <p className="text-sm text-amber-800 mb-4">
            Aapki machine ka built-in printer (H.M TECHNOSYS BT2.0) browser se direct nahi chalta.
            Ek baar ye setup karo, phir har baar automatic print hoga:
          </p>
          <ol className="text-sm text-amber-900 space-y-2 list-decimal list-inside">
            <li>Play Store se <strong>Cleanter: Thermal Printer BT</strong> install karo</li>
            <li>Cleanter kholo → apna printer select karo (<strong>H.M TECHNOSYS</strong>)</li>
            <li><strong>Start</strong> button dabao (notification dikhega "Server running")</li>
            <li>Wapas yahan aao → <strong>Re-check</strong> dabao → Cleanter ✓ dikhega</li>
            <li><strong>Direct Test Print</strong> dabao — paper nikalna chahiye</li>
          </ol>
          <p className="text-xs text-amber-700 mt-4">
            Device: SGT-116 · Android 11 · Built-in 80mm thermal · BT2.0: DC:0D:30:17:5E:FA
          </p>
        </div>
      )}

      {isAndroid && (
        <div className="card p-6 mb-5">
          <h2 className="font-display font-bold text-surface-900 text-lg mb-2">Direct Print (HM POS)</h2>
          <p className="text-sm text-surface-500 mb-4">
            Built-in thermal printer ke liye — Cleanter setup ke baad ye buttons use karo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleDirectTest('kot')}
              disabled={testing}
              className="btn-primary btn btn-lg justify-center bg-emerald-600 hover:bg-emerald-700"
            >
              {testing ? '…' : '🖨 Direct Test KOT'}
            </button>
            <button
              onClick={() => handleDirectTest('bill')}
              disabled={testing}
              className="btn-primary btn btn-lg justify-center bg-emerald-600 hover:bg-emerald-700"
            >
              {testing ? '…' : '🖨 Direct Test Bill'}
            </button>
          </div>
        </div>
      )}

      <div className="card p-6 mb-5">
        <h2 className="font-display font-bold text-surface-900 text-lg mb-2">Browser Print (A4 / normal printer)</h2>
        <p className="text-sm text-surface-500 mb-4">
          Desktop ya external printer ke liye — print page khulegi, PRINT button dabao.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => openTest('kot')} className="btn-primary btn btn-lg justify-center">
            🖨 Test KOT Print
          </button>
          <button onClick={() => openTest('bill')} className="btn-primary btn btn-lg justify-center">
            🖨 Test Bill Print
          </button>
        </div>
      </div>

      <div className="card p-6 bg-surface-50">
        <h2 className="font-display font-bold text-surface-900 text-lg mb-3">Print kaise karein</h2>
        {isAndroid ? (
          <ol className="text-sm text-surface-700 space-y-2 list-decimal list-inside">
            <li>Pehle Cleanter setup karo (upar wale steps)</li>
            <li>Order page se <strong>KOT Print</strong> ya <strong>Generate Bill</strong> dabao</li>
            <li>Print page par <strong>DIRECT PRINT (POS)</strong> button dabao</li>
            <li>Paper automatically nikal jayega — koi printer select nahi karna</li>
          </ol>
        ) : (
          <ol className="text-sm text-surface-700 space-y-2 list-decimal list-inside">
            <li>KOT Print / Generate Bill dabao</li>
            <li>Nayi window khulegi bill/KOT ke saath</li>
            <li>Neeche orange <strong>PRINT BILL</strong> ya <strong>PRINT KOT</strong> button dabao</li>
            <li>Printer list se apna printer choose karo</li>
            <li>Print dabao — paper nikal jayega</li>
          </ol>
        )}
      </div>
    </div>
  )
}

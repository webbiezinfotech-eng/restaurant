/** Open browser print page — works with ANY printer (A4, thermal, wired, wireless). */
import {
  isAndroidDevice,
  directPrint,
  testDirectPrint,
  runPrintDiagnostics,
  checkCleanter,
  detectPrintBridge,
} from './androidPosPrint'

export {
  isAndroidDevice,
  directPrint,
  testDirectPrint,
  runPrintDiagnostics,
  checkCleanter,
  detectPrintBridge,
}

export function openBillPrint(billNumber) {
  if (!billNumber) return false
  const url = `/print/bill/${encodeURIComponent(billNumber)}`
  const w = window.open(url, '_blank', 'width=450,height=750')
  return !!w
}

export function openKOTPrint(orderId) {
  if (!orderId) return false
  const url = `/print/kot/${orderId}`
  const w = window.open(url, '_blank', 'width=450,height=750')
  return !!w
}

export async function printCustomerBill(bill) {
  if (isAndroidDevice()) {
    const result = await directPrint({ type: 'bill', bill, settings: bill.settings })
    if (result.ok) return result
  }
  const ok = openBillPrint(bill.bill_number)
  return ok
    ? { ok: true, method: 'browser', message: 'Print page opened — PRINT button dabao.' }
    : { ok: false, method: 'blocked', message: 'Popup blocked. Allow popups for this site.' }
}

export async function printKOT(order) {
  if (isAndroidDevice()) {
    const result = await directPrint({ type: 'kot', order })
    if (result.ok) return result
  }
  const ok = openKOTPrint(order.id)
  return ok
    ? { ok: true, method: 'browser', message: 'Print page opened — PRINT button dabao.' }
    : { ok: false, method: 'blocked', message: 'Popup blocked. Allow popups for this site.' }
}

export async function testDirectPrintLegacy(type = 'bill') {
  if (isAndroidDevice()) {
    return testDirectPrint(type)
  }
  const url = type === 'kot' ? '/print/test/kot' : '/print/test/bill'
  const w = window.open(url, '_blank', 'width=450,height=750')
  return w
    ? { ok: true, method: 'browser', message: 'Test print page opened.' }
    : { ok: false, method: 'blocked', message: 'Popup blocked.' }
}

export async function checkPrinterConfig() {
  if (isAndroidDevice()) {
    const diag = await runPrintDiagnostics()
    if (diag.cleanter?.ok) {
      return { ok: true, message: 'Cleanter bridge ready — direct print kaam karega ✓' }
    }
    if (diag.bridge) {
      return { ok: true, message: `${diag.bridge.name} bridge detected ✓` }
    }
    return {
      ok: false,
      message: 'Android POS detected — Cleanter app install karo (Settings → Printer Test).',
    }
  }
  return { ok: true, message: 'Browser print — koi bhi printer (A4 ya thermal) select kar sakte ho.' }
}

export function checkPopupAllowed() {
  const w = window.open('', '_blank', 'width=1,height=1')
  if (!w) return false
  try { w.close() } catch { /* ignore */ }
  return true
}

export async function checkPrintServer() {
  return checkPrinterConfig()
}

export const THERMAL_WIDTH_MM = 72

export function sampleKOTOrder() {
  return { id: 0, order_number: 'TEST-001', items: [] }
}

export function sampleBill() {
  return { bill_number: 'TEST', items: [] }
}

export function sampleBillSettings() {
  return {}
}

export function openPrintWindow() {
  return null
}

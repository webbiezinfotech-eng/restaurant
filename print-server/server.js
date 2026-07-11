const express = require("express");
const cors = require("cors");
const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");

const app = express();
app.use(cors());
app.use(express.json());

/** Network thermal printer — override via PRINTER_INTERFACE env (e.g. tcp://192.168.0.101:9100). */
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || "tcp://192.168.0.101:9100";
const LINE_WIDTH = 48; // Font A — matches printer self-test (48 chars/line)

function sym(settings) {
  return (settings && settings.currency_symbol) || "₹";
}

function money(amount, settings) {
  return sym(settings) + Number(amount || 0).toFixed(2);
}

function createPrinter() {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: PRINTER_INTERFACE,
    width: LINE_WIDTH,
    options: { timeout: 5000 },
  });
}

function printKOT(printer, order) {
  const when = new Date().toLocaleString("en-IN");
  const place = order.order_type === "dine_in"
    ? "RESTAURANT (DINE IN)"
    : (order.guest_address || "GUEST HOUSE");
  const location = order.order_type === "dine_in"
    ? `TABLE: ${order.table_number || order.table_label || "-"}`
    : `ROOM: ${order.guest_room || "-"}`;

  printer.alignCenter();
  printer.bold(true);
  printer.println("KITCHEN ORDER");
  printer.bold(false);
  printer.drawLine();
  printer.println(`ORDER: ${order.order_number || order.id || "-"}`);
  printer.alignLeft();
  printer.println(`DATE: ${when}`);
  printer.println(`PLACE: ${place}`);
  printer.println(location);
  printer.drawLine();

  (order.items || []).forEach((item) => {
    const name = String(item.item_name || "").toUpperCase();
    const qty = String(item.quantity || 0);
    const spaces = Math.max(1, LINE_WIDTH - name.length - qty.length);
    printer.println(name + " ".repeat(spaces) + qty);
  });

  printer.drawLine();
  printer.alignCenter();
  printer.println(`TOTAL ITEMS: ${(order.items || []).length}`);
  printer.newLine();
}

function printBillReceipt(printer, bill, settings = {}) {
  const s = settings || {};
  printer.alignCenter();
  printer.bold(true);
  printer.println(s.business_name || "Restaurant");
  printer.bold(false);
  if (s.business_address) printer.println(s.business_address);
  if (s.business_phone) printer.println(s.business_phone);
  printer.drawLine();
  printer.bold(true);
  printer.println("TAX INVOICE");
  printer.bold(false);
  printer.drawLine();
  printer.alignLeft();
  printer.println(`Bill #: ${bill.bill_number || "-"}`);
  printer.println(`Order #: ${bill.order_number || "-"}`);
  printer.println(`Date: ${bill.paid_at || bill.created_at || "-"}`);
  printer.println(`Payment: ${bill.payment_mode || "-"}`);
  printer.drawLine();

  (bill.items || []).forEach((item) => {
    printer.println(`${item.item_name} x${item.quantity}`);
    const lineTotal = money(item.line_total, s);
    printer.alignRight();
    printer.println(lineTotal);
    printer.alignLeft();
  });

  printer.drawLine();
  printer.println(`Subtotal:${" ".repeat(Math.max(1, LINE_WIDTH - 9 - money(bill.subtotal, s).length))}${money(bill.subtotal, s)}`);
  if (parseFloat(bill.tax_amount) > 0) {
    printer.println(`Tax:${" ".repeat(Math.max(1, LINE_WIDTH - 4 - money(bill.tax_amount, s).length))}${money(bill.tax_amount, s)}`);
  }
  if (parseFloat(bill.discount_amount) > 0) {
    printer.println(`Discount:${" ".repeat(Math.max(1, LINE_WIDTH - 9 - money(bill.discount_amount, s).length))}-${money(bill.discount_amount, s)}`);
  }
  printer.bold(true);
  printer.println(`TOTAL:${" ".repeat(Math.max(1, LINE_WIDTH - 6 - money(bill.grand_total, s).length))}${money(bill.grand_total, s)}`);
  printer.bold(false);
  printer.drawLine();
  printer.alignCenter();
  printer.println(s.bill_footer_text || "Thank you!");
  printer.newLine();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, interface: PRINTER_INTERFACE });
});

app.post("/print", async (req, res) => {
  try {
    const { type, order, bill, settings, items, total } = req.body;
    const printer = createPrinter();

    if (type === "kot") {
      const kotOrder = order || { items, total };
      printKOT(printer, kotOrder);
    } else {
      const billData = bill || { items, grand_total: total, subtotal: total, tax_amount: 0, discount_amount: 0 };
      printBillReceipt(printer, billData, settings || {});
    }

    printer.cut();
    await printer.execute();
    res.json({ ok: true, message: "Printed" });
  } catch (err) {
    console.error("Print error:", err);
    res.status(500).json({ ok: false, message: err.message || "Print failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Print server on :${PORT} → ${PRINTER_INTERFACE}`);
});

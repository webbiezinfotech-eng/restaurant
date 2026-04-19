export const formatCurrency = (amount, symbol = "₹") => symbol + Number(amount || 0).toFixed(2)
export const formatDate = (dateStr) => { if (!dateStr) return "-"; return new Date(dateStr).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) }
export const formatDateTime = (dateStr) => { if (!dateStr) return "-"; return new Date(dateStr).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) }
export const orderTypeLabel = (t) => t === "dine_in" ? "Dine In" : "Guest House"
export const paymentModeLabel = (m) => ({ cash: "Cash", upi: "Online (UPI)", card: "Card", credit: "Credit (Due)" })[m] || m

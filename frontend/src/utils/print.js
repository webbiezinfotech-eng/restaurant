// export async function printBill(order) {
//   await fetch("http://localhost:3001/print", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({
//       items: order.items,
//       total: order.total_amount || order.total || 0
//     })
//   });
// }
export async function printBill(order, type = "bill") {
  await fetch("http://localhost:3001/print", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items: order.items,
      total: order.total_amount || order.total || 0,
      type: type
    })
  });
}
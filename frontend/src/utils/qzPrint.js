export async function qzPrint(order, type = "bill") {
  try {
    await window.qz.websocket.connect();

    const printer = await window.qz.printers.find(); // default printer
    const config = window.qz.configs.create(printer);

    let content = "";

    if (type === "kot") {
      content += "KITCHEN ORDER\n";
    } else {
      content += "CUSTOMER BILL\n";
    }

    content += "------------------------\n";

    order.items.forEach(item => {
      content += `${item.name} - ${item.price}\n`;
    });

    content += "------------------------\n";
    content += `TOTAL: ${order.total_amount || order.total}\n\n`;

    const data = [{
      type: "raw",
      format: "plain",
      data: content
    }];

    await window.qz.print(config, data);

  } catch (err) {
    console.error("QZ Print Error:", err);
  }
}
const express = require("express");
const cors = require("cors");
const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");

const app = express();
app.use(cors());
app.use(express.json());

// app.post("/print", async (req, res) => {
//     try {
//         let printer = new ThermalPrinter({
//             type: PrinterTypes.EPSON,
//             interface: "usb"
//         });

//         printer.println("TEST PRINT");
//         printer.cut();

//         await printer.execute();

//         res.send("Printed");
//     } catch (err) {
//         console.log(err);
//         res.status(500).send("Error");
//     }
// });


app.post("/print", async (req, res) => {
    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: "usb"
        });

        const { items, total, type } = req.body;

        if (type === "kot") {
            printer.println("KITCHEN ORDER");
        } else {
            printer.println("CUSTOMER BILL");
        }

        printer.drawLine();

        items.forEach(item => {
            printer.println(`${item.name} - ${item.price}`);
        });

        printer.drawLine();
        printer.println("TOTAL: " + total);
        printer.cut();

        await printer.execute();

        res.send("Printed");

    } catch (err) {
        console.log(err);
        res.status(500).send("Error");
    }
});

app.listen(3001, () => console.log("Print server running on 3001"));
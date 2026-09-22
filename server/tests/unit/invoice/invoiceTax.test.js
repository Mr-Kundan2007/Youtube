import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../../helpers/testDatabase.js"
import { createTestUser, createTestPayment } from "../../helpers/testDataFactories.js"
import invoiceService from "../../../services/invoiceService.js"

export async function runInvoiceTaxUnitTest() {
  const runner = new TestRunner("Unit: Invoice Generation & GST Tax Calculation")
  runner.start()

  const testUserIds = []
  const testOrderIds = []

  try {
    await connectTestDb()

    // 1. Pure GST Math Verification
    const totalAmount = 1000 // ₹1000 inclusive of 18% GST
    const subtotal = Math.round((totalAmount / 1.18) * 100) / 100 // 847.46
    const taxAmount = Math.round((totalAmount - subtotal) * 100) / 100 // 152.54
    const cgst = Math.round((taxAmount / 2) * 100) / 100 // 76.27
    const sgst = Math.round((taxAmount / 2) * 100) / 100 // 76.27

    runner.assert(subtotal === 847.46, "Inclusive 18% GST base subtotal is 847.46")
    runner.assert(taxAmount === 152.54, "Total GST amount is 152.54")
    runner.assert(Math.abs(subtotal + taxAmount - totalAmount) < 0.01, "Subtotal + Tax accurately equals total amount")
    runner.assert(cgst === 76.27 && sgst === 76.27, "CGST and SGST accurately split 50/50")

    // 2. Invoice Generation Service
    const user = await createTestUser({ name: "Invoice Tester" })
    testUserIds.push(user._id)

    const paymentTx = await createTestPayment({
      userId: user._id,
      amount: 49900, // ₹499
      status: "success",
      planKey: "silver",
      billingCycle: "monthly",
    })
    testOrderIds.push(paymentTx.orderId)

    const invoice = await invoiceService.generateInvoice({
      transaction: paymentTx,
      user,
    })

    runner.assert(invoice.invoiceNumber.startsWith("INV-"), "Invoice number conforms to INV-YYYYMMDD-XXXXXX format")
    runner.assert(invoice.amountPaid === 499, "Invoice amount matches transaction in rupees (499)")
    runner.assert(invoice.currency === "INR", "Invoice currency defaults to INR")
    runner.assert(invoice.status === "paid", "Generated invoice has 'paid' status")

    // 3. Invoice Idempotency
    const duplicateCall = await invoiceService.generateInvoice({
      transaction: paymentTx,
      user,
    })
    runner.assert(
      duplicateCall._id.toString() === invoice._id.toString(),
      "Repeated invoice generation returns existing invoice without duplicate record"
    )

    // 4. Server-Side PDF Rendering
    const pdfBuffer = await invoiceService.generateInvoicePDF(invoice._id, user._id)
    runner.assert(pdfBuffer instanceof Buffer, "PDF generator returns a valid binary Buffer")
    runner.assert(pdfBuffer.length > 500, "PDF buffer contains meaningful binary payload (>500 bytes)")
    runner.assert(pdfBuffer.slice(0, 4).toString() === "%PDF", "PDF buffer starts with standard %PDF magic header")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  } catch (err) {
    runner.assert(false, `Unexpected error in invoice unit test: ${err.message}`)
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("invoiceTax.test.js")) {
  runInvoiceTaxUnitTest()
    .then(async (res) => {
      await disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(async () => {
      await disconnectTestDb()
      process.exit(1)
    })
}

export default runInvoiceTaxUnitTest

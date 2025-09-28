import express from 'express'
import { handleWithdrawalSuccess, handleWithdrawalFailure, processOrderPayment, processWalletFunding} from '../controllers/webhookHandler.js'
import Order from '../models/orderModel.js'

const router = express.Router();

router.post("/paystack-webhook", async (req, res) => {
  const event = req.body.event;
  console.log(event)

  try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = req.headers["x-paystack-signature"];
        const payload = JSON.stringify(req.body);

        const expectedHash = crypto.createHmac("sha512", secret).update(payload).digest("hex");
        if (hash !== expectedHash) {
            return res.status(400).json({ message: "Invalid signature" });
        }

        const event = req.body.event;
        const data = req.body.data;
        const reference = data.reference;
        const amount = data.amount / 100;

      switch (event) {
        case "charge.success":
          const order = await Order.findById(reference);
            if (order) {
             await processOrderPayment(order, reference, amount, res);
            }
             await processWalletFunding(data, reference, amount, res);
          break;

        case "transfer.success":
          await handleWithdrawalSuccess(req.body);
          break;

        case "transfer.failed":
          await handleWithdrawalFailure(req.body);
          break;

        default:
          console.log(`Unhandled event: ${event}`);
      }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook handling error:", error);
    res.sendStatus(500);
  }
});

export default router

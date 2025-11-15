// routes/webhook.js
import express from "express";
import crypto from "crypto";
import {
  handleWithdrawalSuccess,
  handleWithdrawalFailure,
  processOrderPaymentFromMetadata,
  processWalletFunding,
} from "../controllers/webhookHandler.js";

const router = express.Router();

router.post("/paystack-webhook", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = req.headers["x-paystack-signature"];
    const payload = JSON.stringify(req.body || {});

    const expectedHash = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    if (hash !== expectedHash) {
      console.warn("❌ Invalid Paystack signature");
      return res.sendStatus(400);
    }

    const event = req.body.event;
    const data = req.body.data;

    console.log("🔔 Paystack webhook:", event);

    switch (event) {
      case "charge.success": {
        const reference = data?.reference;
        const amount = (data?.amount || 0) / 100;
        const metadata = data?.metadata || {};

        if (metadata.isFunding) {
          await processWalletFunding(data, reference, amount);
        } else if (metadata.isOrder) {
          await processOrderPaymentFromMetadata(metadata, reference, amount);
        } else {
          console.log("⚠️ Unknown charge.success type - metadata missing or unrecognized");
        }

        break;
      }

      case "transfer.success":
        await handleWithdrawalSuccess(req.body);
        break;

      case "transfer.failed":
        await handleWithdrawalFailure(req.body);
        break;

      default:
        console.log(`⚠️ Unhandled event: ${event}`);
    }

    // Always respond 200 to Paystack
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.sendStatus(500);
  }
});

export default router;

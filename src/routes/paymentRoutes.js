import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { getOrder, getSummary, listOrders } from "../controllers/paymentController.js";

// Admin only. The Razorpay webhook is mounted separately in app.js, because it
// needs the raw request body for its signature check.
const router = Router();

router.use(requireAdmin);
router.get("/summary", getSummary);
router.get("/orders", listOrders);
router.get("/orders/:number", getOrder);

export default router;

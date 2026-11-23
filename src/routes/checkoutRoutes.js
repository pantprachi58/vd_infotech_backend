import { Router } from "express";
import { createCheckout, getCheckoutOrder, verifyCheckout } from "../controllers/checkoutController.js";

// Public: the website's Pay now flow (through its /api/checkout proxy).
const router = Router();

router.post("/", createCheckout);
router.post("/verify", verifyCheckout);
router.get("/orders/:number", getCheckoutOrder);

export default router;

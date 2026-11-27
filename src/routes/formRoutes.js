import express, { Router } from "express";
import { submitForm } from "../controllers/formController.js";
import { requireAdmin } from "../middleware/auth.js";
import { verifyMailboxes } from "../utils/mailer.js";

// Large enough for a 5MB attachment sent as base64 (~6.7MB) plus the fields.
export const formBodyParser = express.json({ limit: "8mb" });

const router = Router();

// Admin: checks the SMTP login of every mailbox — GET /api/forms/_health (x-api-key)
router.get("/_health", requireAdmin, async (_req, res) => {
  res.json({ data: await verifyMailboxes() });
});

router.post("/:form", submitForm);

export default router;

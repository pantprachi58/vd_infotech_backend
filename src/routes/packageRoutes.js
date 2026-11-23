import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  createPackage,
  deletePackage,
  duplicatePackage,
  getCatalog,
  getPackage,
  getQuote,
  getSettings,
  listPackages,
  reorderPackages,
  updatePackage,
  updateSettings,
} from "../controllers/packageController.js";

const router = Router();

// Fixed paths first, so they are never read as a :slug.
router.get("/catalog", getCatalog);
router.route("/settings").get(getSettings).put(requireAdmin, updateSettings);
router.put("/reorder", requireAdmin, reorderPackages);

router.route("/").get(listPackages).post(requireAdmin, createPackage);
router.get("/:slug/quote", getQuote);
router.post("/:slug/duplicate", requireAdmin, duplicatePackage);
router
  .route("/:slug")
  .get(getPackage)
  .put(requireAdmin, updatePackage)
  .patch(requireAdmin, updatePackage)
  .delete(requireAdmin, deletePackage);

export default router;

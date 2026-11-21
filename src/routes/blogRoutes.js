import express, { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../controllers/categoryController.js";
import { createPost, deletePost, getPost, listPosts, updatePost } from "../controllers/postController.js";
import { getStats } from "../controllers/statsController.js";
import { MAX_UPLOAD_BYTES, deleteUpload, listUploads, uploadImage } from "../controllers/uploadController.js";

const router = Router();

// Admin dashboard + media library (x-api-key)
router.get("/stats", requireAdmin, getStats);
router.get("/uploads", requireAdmin, listUploads);
router.post("/uploads", requireAdmin, express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), uploadImage);
router.delete("/uploads/:file", requireAdmin, deleteUpload);

// Public reads
router.get("/categories", listCategories);
router.get("/categories/:slug", getCategory);
router.get("/posts", listPosts);
router.get("/posts/:slug", getPost);

// Admin writes (x-api-key)
router.post("/categories", requireAdmin, createCategory);
router.route("/categories/:slug").put(requireAdmin, updateCategory).patch(requireAdmin, updateCategory).delete(requireAdmin, deleteCategory);

router.post("/posts", requireAdmin, createPost);
router.route("/posts/:slug").put(requireAdmin, updatePost).patch(requireAdmin, updatePost).delete(requireAdmin, deletePost);

export default router;

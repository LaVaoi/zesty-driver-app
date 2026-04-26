import express from "express";

import { createDeal, deleteDeal, getDealDetail, getDeals, updateDeal } from "../controllers/dealController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

//////////// 🔓 PUBLIC
router.get("/", getDeals);
router.get("/:id", getDealDetail);

//////////// 🔐 PROTECTED
router.post("/", verifyToken, createDeal);
router.put("/:id", verifyToken, updateDeal);
router.delete("/:id", verifyToken, deleteDeal);

export default router;

import express from "express";
import { getAllRestaurants, getPopularRestaurants, getRestaurantById } from "../controllers/restaurantController.js";
import { identifyClient } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", identifyClient, getAllRestaurants);
router.get("/popular", getPopularRestaurants);


router.get('/:id', identifyClient, getRestaurantById);

export default router;
import express from "express";
import {
  getDeliveryManProfile,
  updateDeliveryManProfile,
  updateDeliveryManLocation,
  getDashboardMetrics,
  getPendingOrders,
  getMyOrders,
  acceptOrder,
  updateOrderStatus,
  getDeliveredOrders,
  getDeliveryStats,
  markDeliveryManNotificationAsRead,
  markAllDeliveryManNotificationsAsRead,
  getDeliveryManNotifications,
  getDeliveryManUnreadCount,
  createDeliveryManNotification,
} from "../controllers/deliveryManController.js";
import { verifyDeliveryManToken } from "../middleware/deliveryManAuth.js";
import { uploadDeliveryManImageWithSharp } from "../controllers/adminController.js";

const router = express.Router();

// All routes require authentication
router.use(verifyDeliveryManToken);

// Profile routes
router.get("/profile", getDeliveryManProfile);
router.put("/update-profile", uploadDeliveryManImageWithSharp, updateDeliveryManProfile);

// Location routes
router.put("/update-location", updateDeliveryManLocation);

// Dashboard routes
router.get("/dashboard/metrics", getDashboardMetrics);

// Order routes
router.get("/orders/pending", getPendingOrders);
router.get("/my-orders", getMyOrders);
router.get("/delivered-orders", getDeliveredOrders);
router.post("/accept-order", acceptOrder);
router.put("/update-order-status", updateOrderStatus);

// Stats route
router.get("/stats", getDeliveryStats);


// notification routes for delivery man

// Get notifications for deliveryman
router.get('/notifications', getDeliveryManNotifications);

// Mark single notification as read
router.put('/notifications/mark-read', markDeliveryManNotificationAsRead);

// Mark all notifications as read
router.put('/notifications/mark-all-read', markAllDeliveryManNotificationsAsRead);

// Get unread count
router.get('/notifications/unread-count', getDeliveryManUnreadCount);

// Create notification (for testing/admin use)
router.post('/notifications', createDeliveryManNotification);


export default router;


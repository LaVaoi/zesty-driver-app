import express from "express";
import {
  adminLogin,
  getAdminProfile,
  getDashboardStats,
  getTopProducts,
  getTopClients,
  getActiveDeliveries,
  getAllOrdersForMap,
  getDeliveredOrders,
  getHourlyPerformance,
  getRevenueTrends,
  getRevenueReport,
  exportRevenueReport,
  getOrdersReport,
  exportOrdersReport,
  getAllOrders,
  getOrderDetails,
  exportOrders,
  getOrderHistory,
  bulkUpdateOrderStatus,
  updateOrderPaymentStatus,
  cancelOrder,
  updateOrderStatus,
  assignDeliveryMan,
  updateOrder,
  getAllClients,
  getClientDetails,
  updateClient,
  getClientActivity,
  getClientFavorites,
  deleteClientFavorite,
  toggleClientStatus,
  toggleClientVerification,
  resetClientPassword,
  exportClients,
  getAllDeliveryMen,
  getDeliveryManDetails,
  createDeliveryMan,
  updateDeliveryMan,
  getDeliveryManPerformance,
  getDeliveryManEarnings,
  getDeliveryManLocationHistory,
  updateDeliveryManImage,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllProducts,
  getProductDetails,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  getAllPromoCodes,
  getPromoCodeDetails,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  bulkUpdatePromoCodes,
  recalculatePromoUsage,
  getRestaurantSettings,
  updateRestaurantSettings,
  uploadRestaurantLogoHandler,
  uploadRestaurantIconHandler,
  testEmailConfiguration,
  getActiveOffers,
  getOfferDetails,
  getAllOffers,
  updateOffer,
  deleteOffer,
  getOrderRatings,
  exportOrderRatings,
  createOffer,
  getPromotionsAnalytics,
  uploadDeliveryManImageWithSharp,
  uploadProductImageWithSharp,
  uploadCategoryImageWithSharp,
  uploadOfferImageWithSharp,
  uploadRestaurantLogoWithSharp,
  uploadRestaurantIconWithSharp,
  sendToAllClients,
  sendToAllDeliveryMen,
  toggleProductAvailability,
  getOperatingHours,
  updateOperatingHours,
  bulkUpdateOperatingHours,
  getOpenStatus,
  toggleRestaurantOpen,
  getRestaurantReviews,
  getOrdersHistory,
} from "../controllers/adminController.js";
import { verifyAdminToken } from "../middleware/adminAuth.js";

const router = express.Router();

// Authentication routes (no auth required)
router.post("/login", adminLogin);

// All routes below require admin authentication
router.use(verifyAdminToken);

// Profile
router.get("/profile", getAdminProfile);

// Dashboard
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/revenue-trends", getRevenueTrends);
router.get("/dashboard/top-products", getTopProducts);
router.get("/dashboard/top-clients", getTopClients);
router.get("/dashboard/hourly-performance", getHourlyPerformance);

router.get("/dashboard/active-deliveries", getActiveDeliveries);
router.get("/dashboard/all-orders-map", getAllOrdersForMap);
router.get("/dashboard/delivered-orders", getDeliveredOrders);

// Reports
router.get("/reports/revenue", getRevenueReport);
router.get("/reports/revenue/export", exportRevenueReport);
router.get("/reports/orders", getOrdersReport);
router.get("/reports/orders/export", exportOrdersReport);

// Orders
router.get("/orders", getAllOrders);
router.get("/orders/:id", getOrderDetails);
router.get("/orders/:id/history", getOrderHistory);
router.get("/orders/export", exportOrders);
router.post("/orders/bulk-update-status", bulkUpdateOrderStatus);
router.put("/orders/:id/payment-status", updateOrderPaymentStatus);
router.post("/orders/:id/cancel", cancelOrder);
router.put("/orders/:id/status", updateOrderStatus);
router.put("/orders/:id", updateOrder);
router.post("/orders/assign-delivery-man", assignDeliveryMan);

router.get("/orders-history", getOrdersHistory);

// Clients
router.get("/clients", getAllClients);
router.get("/clients/export", exportClients);
router.get("/clients/:id", getClientDetails);
router.put("/clients/:id", updateClient);
router.put("/clients/:id/toggle-status", toggleClientStatus);
router.put("/clients/:id/toggle-verification", toggleClientVerification);
router.post("/clients/:id/reset-password", resetClientPassword);
router.get("/clients/:id/activity", getClientActivity);
router.get("/clients/:id/favorites", getClientFavorites);
router.delete("/clients/:id/favorites/:favorite_id", deleteClientFavorite);

// Delivery Men
router.get("/delivery-men", getAllDeliveryMen);
router.get("/delivery-men/:id", getDeliveryManDetails);
router.post("/delivery-men", createDeliveryMan);
router.put("/delivery-men/:id", updateDeliveryMan);
router.post("/delivery-men/:id/image", uploadDeliveryManImageWithSharp, updateDeliveryManImage);
router.get("/delivery-men/:id/performance", getDeliveryManPerformance);
router.get("/delivery-men/:id/earnings", getDeliveryManEarnings);
router.get("/delivery-men/:id/location-history", getDeliveryManLocationHistory);

// Categories
router.get("/categories", getAllCategories);
router.post("/categories", uploadCategoryImageWithSharp, createCategory);

router.put('/categories/:id', uploadCategoryImageWithSharp, updateCategory);

router.put("/categories/:id/image", uploadCategoryImageWithSharp, updateCategory);
router.delete("/categories/:id", deleteCategory);

// Products
router.get("/products", getAllProducts);
router.get("/products/:id", getProductDetails);
router.post("/products", uploadProductImageWithSharp, createProduct);
router.put("/products/:id",uploadProductImageWithSharp, updateProduct);
router.post("/products/:id/image", uploadProductImageWithSharp, updateProduct);
router.delete("/products/:id", deleteProduct);
router.post("/products/bulk-update", bulkUpdateProducts);
router.put('/:id/toggle-availability', toggleProductAvailability);
// Promo Codes
router.get("/promo-codes", getAllPromoCodes);
router.get("/promo-codes/:id", getPromoCodeDetails);
router.post("/create-promo-code", createPromoCode);
router.put("/update-promo-code", updatePromoCode);
router.delete("/promo-codes/:id", deletePromoCode);
router.post("/promo-codes/bulk-update", bulkUpdatePromoCodes);
router.post("/promo-codes/recalculate-usage", recalculatePromoUsage);

// offers
router.get("/offers", getAllOffers);
router.get("/offers/active", getActiveOffers);
router.get("/offers/:id", getOfferDetails);
router.post("/create-offer", uploadOfferImageWithSharp, createOffer);
router.put("/offers/:id", uploadOfferImageWithSharp, updateOffer);
router.delete("/offers/:id", deleteOffer);
router.get("/promotions/analytics", getPromotionsAnalytics);

// Order ratings
router.get("/order-ratings", getOrderRatings);
router.get("/order-ratings/export", exportOrderRatings);

// Restaurant Settings
router.get("/restaurant-settings", getRestaurantSettings);
router.put("/restaurant-settings", updateRestaurantSettings);
router.post("/restaurant-settings/logo", uploadRestaurantLogoWithSharp, uploadRestaurantLogoHandler);
router.post("/restaurant-settings/icon", uploadRestaurantIconWithSharp, uploadRestaurantIconHandler);
router.post("/test-email", testEmailConfiguration);

// Operating Hours
router.get("/operating-hours", getOperatingHours);
router.put("/operating-hours", updateOperatingHours);
router.put("/operating-hours/bulk", bulkUpdateOperatingHours);
router.get("/open-status", getOpenStatus);
router.post("/toggle-open", toggleRestaurantOpen);

// send to all clients
router.post("/notifications/send-to-all-clients", sendToAllClients);
router.post('/notifications/send-to-all-delivery-men', sendToAllDeliveryMen);

// admin notifications handeling

router.post('/orders/status-check', verifyAdminToken, async (req, res) => {
  try {
    const { order_ids } = req.body;
    
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ message: 'Order IDs array required' });
    }
    
    const placeholders = order_ids.map(() => '?').join(',');
    const [orders] = await db.execute(
      `SELECT id, order_number, status FROM orders WHERE id IN (${placeholders})`,
      order_ids
    );
    
    res.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('Error checking order statuses:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Update order status
 */
router.put('/orders/:id/status', verifyAdminToken, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    await connection.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    
    // Broadcast status update to all connected clients
    const [orderRows] = await connection.execute(
      'SELECT order_number FROM orders WHERE id = ?',
      [id]
    );
    
    if (orderRows.length > 0) {
      // Broadcast to admin WebSocket clients
      if (typeof broadcastToUserType === 'function') {
        broadcastToUserType('admin', {
          type: 'order_status_update',
          data: {
            order_id: parseInt(id),
            new_status: status,
            order_number: orderRows[0].order_number,
            updated_at: new Date().toISOString()
          }
        });
      }
      
      // Also notify delivery men if status is relevant
      if (status === 'Ready' || status === 'Out for Delivery') {
        // Add delivery notification logic here
      }
    }
    
    res.json({
      success: true,
      message: `Order status updated to ${status}`
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Operating Hours Routes
router.get('/operating-hours', getOperatingHours);
router.put('/operating-hours', updateOperatingHours);
router.put('/operating-hours/bulk', bulkUpdateOperatingHours);
router.get('/open-status', getOpenStatus);
router.post('/toggle-open', toggleRestaurantOpen);


// restaurant ratings
router.get('/restaurant-reviews', getRestaurantReviews);



export default router;


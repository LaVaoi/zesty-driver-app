import express from "express";
import { register, verifyEmail, login, forgotPassword, resetPassword, getCategories, getProducts, deliveryManLogin, loginWithPhone, sendVerificationCode, verifyPhoneCode, getAllProductsWithOffers, getRestaurantSettingsPublic, getHomePageData, loginWithGoogle, getRestaurantOpenStatus, setClientLanguage, getInCartProducts, checkLiveStatus, addAddress, getClientAddresses, updateAddress, deleteAddress, setDefaultAddress } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { redirectIfAuthenticated } from "../middleware/redirectIfAuthenticated.js";
import { createOrder, getOrders, getDeliveryManLocation, checkOrderExists, getLoyaltyRewards, submitOrderRating, estimateDeliveryFee, getOrderById, updateOrderRating, cancelOrderByClient, getMoneySavingStats } from "../controllers/orderController.js";
import { addFavorite, addFavoriteRestaurant, getFavoriteRestaurants, getFavorites, removeFavorite, removeFavoriteRestaurant } from "../controllers/favoriteController.js";
import { updateProfile, uploadProfileImage } from "../controllers/updateProfileController.js";
import { applyOfferToAllProducts, getAllOffers, getPromoCodes, validatePromoCode } from "../controllers/promoController.js";
const router = express.Router();

// Signup route

router.post("/signup", register);
router.post("/verify-email", verifyEmail);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.put("/update-profile",uploadProfileImage, updateProfile);

router.get("/get-categories", getCategories);

router.get("/get-products", getProducts);
router.get("/home-page-data", getHomePageData);
router.get("/get-products-with-offers", getAllProductsWithOffers);
router.post("/estimate-delivery-fee", verifyToken, estimateDeliveryFee);

router.post("/place-order",verifyToken, createOrder);

router.get("/get-orders",verifyToken, getOrders);

router.get('/orders/:id', verifyToken, getOrderById);
router.get("/get-delivery-man-location", getDeliveryManLocation);


router.post('/add-favorite',verifyToken, addFavorite);

router.get("/get-favorite",verifyToken, getFavorites);

router.delete('/remove-favorite',verifyToken, removeFavorite);

// restaurants favorite routes
router.post('/restaurant-add-favorite',verifyToken, addFavoriteRestaurant);
router.get("/restaurant-get-favorite",verifyToken, getFavoriteRestaurants);
router.delete('/restaurant-remove-favorite',verifyToken, removeFavoriteRestaurant);


router.post("/login", redirectIfAuthenticated, login);
router.post("/google-login", loginWithGoogle);
router.post("/login-with-phone", redirectIfAuthenticated, loginWithPhone);


router.post("/login-deliver-man", deliveryManLogin);


router.post("/send-verification-code", sendVerificationCode);

router.post("/verify-my-phone", verifyPhoneCode);

router.post('/check-order-exists', checkOrderExists);

router.get("/get-loyalty-rewards", getLoyaltyRewards);

router.post("/submit-rating",verifyToken, submitOrderRating);
router.put("/update-rating", verifyToken, updateOrderRating);
// Promo code routes
router.get("/get-promo-codes", getPromoCodes);
router.post("/validate-promo-code", validatePromoCode);



// get all offers

router.get("/offers", getAllOffers);

// Public restaurant settings
router.get("/restaurant-settings", getRestaurantSettingsPublic);

// Public restaurant open status and operating hours
router.get("/open-status", getRestaurantOpenStatus);

router.post('/offers/apply-offer', applyOfferToAllProducts);

router.post('/set-language', setClientLanguage);

router.get("/in-cart-products", getInCartProducts);
router.post('/products/check-live-status', checkLiveStatus);

router.put('/orders/cancel/:orderId', verifyToken, cancelOrderByClient);

router.get("/money-saving-stats", verifyToken, getMoneySavingStats);

// addresses
// Address routes
router.post('/addresses', verifyToken, addAddress);
router.get('/clients/:clientId/addresses', getClientAddresses);
router.put('/clients/:clientId/addresses/:addressId', verifyToken, updateAddress);
router.delete('/clients/:clientId/addresses/:addressId', verifyToken, deleteAddress);
router.patch('/clients/:clientId/addresses/:addressId/default', verifyToken, setDefaultAddress);
export default router;



import express from "express";
import { register, verifyEmail, login, forgotPassword, resetPassword, getCategories, getProducts, deliveryManLogin, loginWithPhone, sendVerificationCode, verifyPhoneCode, getAllProductsWithOffers, getRestaurantSettingsPublic, getHomePageData, loginWithGoogle, getRestaurantOpenStatus, setClientLanguage, getInCartProducts, checkLiveStatus } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { redirectIfAuthenticated } from "../middleware/redirectIfAuthenticated.js";
import { createOrder, getOrders, getDeliveryManLocation, checkOrderExists, getLoyaltyRewards, submitOrderRating, estimateDeliveryFee } from "../controllers/orderController.js";
import { addFavorite, getFavorites, removeFavorite } from "../controllers/favoriteController.js";
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
router.get("/estimate-delivery-fee", estimateDeliveryFee);

router.post("/place-order", createOrder);

router.get("/get-orders", getOrders);
router.get("/get-delivery-man-location", getDeliveryManLocation);


router.post('/add-favorite', addFavorite);

router.get("/get-favorite", getFavorites);

router.delete('/remove-favorite', removeFavorite);

router.post("/login", redirectIfAuthenticated, login);
router.post("/google-login", loginWithGoogle);
router.post("/login-with-phone", redirectIfAuthenticated, loginWithPhone);


router.post("/login-deliver-man", deliveryManLogin);


router.post("/send-verification-code", sendVerificationCode);

router.post("/verify-my-phone", verifyPhoneCode);

router.post('/check-order-exists', checkOrderExists);

router.get("/get-loyalty-rewards", getLoyaltyRewards);

router.post("/submit-rating", submitOrderRating);

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
export default router;

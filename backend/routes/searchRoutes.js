// routes/searchRoutes.js
import express from 'express';
import { 
  search, 
  getSuggestions, 
  getPopularSearches,
  saveSearchHistory,
  getRecentSearches,
  clearSearchHistory 
} from '../controllers/searchController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', search);
router.get('/suggestions', getSuggestions);
router.get('/popular', getPopularSearches);

// Protected routes (require authentication)
router.post('/history', verifyToken, saveSearchHistory);
router.get('/history/:userId', verifyToken, getRecentSearches);
router.delete('/history/:userId', verifyToken, clearSearchHistory);

export default router;
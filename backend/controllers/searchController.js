// controllers/searchController.js
import pool from '../config/db.js';

export const search = async (req, res) => {
  let connection;
  try {
    const { q, type = 'all', limit = 20, offset = 0 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    connection = await pool.getConnection();
    const searchTerm = `%${q}%`;
    const results = {
      restaurants: [],
      dishes: [],
      categories: [],
      total: { restaurants: 0, dishes: 0, categories: 0 }
    };

    // Search restaurants
    if (type === 'all' || type === 'restaurants') {
      const [restaurants] = await connection.query(`
        SELECT 
          id,
          name,
          description,
          specialities,
          logo,
          image,
          address,
          rating,
          estimated_time,
          delivery_fees,
          min_order,
          is_open,
          is_popular
        FROM restaurants 
        WHERE name LIKE ? 
           OR description LIKE ? 
           OR specialities LIKE ?
        ORDER BY 
          CASE 
            WHEN name LIKE ? THEN 1
            WHEN name LIKE ? THEN 2
            ELSE 3
          END,
          rating DESC
        LIMIT ? OFFSET ?`,
        [searchTerm, searchTerm, searchTerm, 
         `${q}%`, `%${q}%`, 
         parseInt(limit), parseInt(offset)]
      );
      
      results.restaurants = restaurants.map(r => ({
        ...r,
        type: 'restaurant',
        image: r.image ? `https://ubua.cloud/${r.image}` : null,
        logo: r.logo ? `https://ubua.cloud/${r.logo}` : null
      }));

      // Get total count for pagination
      const [countResult] = await connection.query(`
        SELECT COUNT(*) as total 
        FROM restaurants 
        WHERE name LIKE ? OR description LIKE ? OR specialities LIKE ?`,
        [searchTerm, searchTerm, searchTerm]
      );
      results.total.restaurants = countResult[0].total;
    }

    // Search dishes/products
    if (type === 'all' || type === 'dishes') {
      const [dishes] = await connection.query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.price,
          p.rating,
          p.image,
          p.promo,
          p.promoValue,
          p.badge,
          c.name as category_name,
          r.id as restaurant_id,
          r.name as restaurant_name,
          r.image as restaurant_image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN restaurants r ON p.restaurant_id = r.id
        WHERE p.name LIKE ? 
           OR p.description LIKE ?
           OR c.name LIKE ?
        ORDER BY 
          CASE 
            WHEN p.name LIKE ? THEN 1
            WHEN p.name LIKE ? THEN 2
            ELSE 3
          END,
          p.rating DESC
        LIMIT ? OFFSET ?`,
        [searchTerm, searchTerm, searchTerm,
         `${q}%`, `%${q}%`,
         parseInt(limit), parseInt(offset)]
      );
      
      results.dishes = dishes.map(d => ({
        ...d,
        type: 'dish',
        image: d.image ? `https://ubua.cloud/${d.image}` : null,
        finalPrice: d.promo ? d.price - (d.price * d.promoValue / 100) : d.price
      }));

      const [countResult] = await connection.query(`
        SELECT COUNT(*) as total 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?`,
        [searchTerm, searchTerm, searchTerm]
      );
      results.total.dishes = countResult[0].total;
    }

    // Search categories
    if (type === 'all' || type === 'categories') {
      const [categories] = await connection.query(`
        SELECT 
          id,
          name,
          image,
          description,
          active
        FROM categories 
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY name ASC
        LIMIT ? OFFSET ?`,
        [searchTerm, searchTerm, parseInt(limit), parseInt(offset)]
      );
      
      results.categories = categories.map(c => ({
        ...c,
        type: 'category',
        image: c.image ? `https://ubua.cloud/${c.image}` : null
      }));

      const [countResult] = await connection.query(`
        SELECT COUNT(*) as total 
        FROM categories 
        WHERE name LIKE ? OR description LIKE ?`,
        [searchTerm, searchTerm]
      );
      results.total.categories = countResult[0].total;
    }

    connection.release();

    res.json({
      success: true,
      data: results,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (
          (type === 'all' || type === 'restaurants') && results.restaurants.length < results.total.restaurants ||
          (type === 'all' || type === 'dishes') && results.dishes.length < results.total.dishes ||
          (type === 'all' || type === 'categories') && results.categories.length < results.total.categories
        )
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to perform search'
    });
  }
};

// Get popular searches (based on actual user search history)
export const getPopularSearches = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Get popular searches from the last 7 days
    const [popularSearches] = await connection.query(`
      SELECT 
        query,
        COUNT(*) as search_count,
        MAX(created_at) as last_searched
      FROM search_history
      WHERE created_at >= NOW() - INTERVAL 7 DAY
      GROUP BY query
      ORDER BY search_count DESC, last_searched DESC
      LIMIT 10
    `);

    connection.release();

    // Format the response
    const formattedSearches = popularSearches.map(item => ({
      query: item.query,
      count: item.search_count
    }));

    res.json({
      success: true,
      data: formattedSearches
    });

  } catch (error) {
    console.error('Error fetching popular searches:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular searches'
    });
  }
};

// Get search suggestions (autocomplete)
export const getSuggestions = async (req, res) => {
  let connection;
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    connection = await pool.getConnection();
    const searchTerm = `%${q}%`;
    const suggestions = [];

    // Get restaurant suggestions (limit 3)
    const [restaurants] = await connection.query(`
      SELECT 
        id,
        name,
        'restaurant' as type,
        image
      FROM restaurants 
      WHERE name LIKE ? 
      LIMIT 3`,
      [`${q}%`]
    );
    suggestions.push(...restaurants.map(r => ({
      id: r.id,
      text: r.name,
      type: r.type,
      image: r.image ? `https://ubua.cloud/${r.image}` : null
    })));

    // Get dish suggestions (limit 3)
    const [dishes] = await connection.query(`
      SELECT 
        p.id,
        p.name,
        'dish' as type,
        p.image,
        r.name as restaurant_name
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      WHERE p.name LIKE ? 
      LIMIT 3`,
      [`${q}%`]
    );
    suggestions.push(...dishes.map(d => ({
      id: d.id,
      text: d.name,
      type: d.type,
      subtitle: d.restaurant_name,
      image: d.image ? `https://ubua.cloud/${d.image}` : null
    })));

    // Get category suggestions (limit 2)
    const [categories] = await connection.query(`
      SELECT 
        id,
        name,
        'category' as type,
        image
      FROM categories 
      WHERE name LIKE ? 
      LIMIT 2`,
      [`${q}%`]
    );
    suggestions.push(...categories.map(c => ({
      id: c.id,
      text: c.name,
      type: c.type,
      image: c.image ? `https://ubua.cloud/${c.image}` : null
    })));

    connection.release();

    // Sort by relevance (exact matches first)
    suggestions.sort((a, b) => {
      const aExact = a.text.toLowerCase().startsWith(q.toLowerCase());
      const bExact = b.text.toLowerCase().startsWith(q.toLowerCase());
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    res.json({
      success: true,
      data: suggestions.slice(0, 8) // Limit to 8 total suggestions
    });

  } catch (error) {
    console.error('Error getting suggestions:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions'
    });
  }
};

// Save search to history (called when user performs a search)
export const saveSearchHistory = async (req, res) => {
  let connection;
  try {
    const { query, userId, resultsCount = 0 } = req.body;
    
    if (!query || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Query and userId are required'
      });
    }

    connection = await pool.getConnection();
    
    // Insert the search into history
    await connection.query(`
      INSERT INTO search_history (user_id, query, results_count, created_at)
      VALUES (?, ?, ?, NOW())
    `, [userId, query.trim(), resultsCount]);

    // Optional: Keep only the last 50 searches per user to prevent the table from growing too large
    await connection.query(`
      DELETE FROM search_history 
      WHERE user_id = ? 
      AND id NOT IN (
        SELECT id FROM (
          SELECT id FROM search_history 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 50
        ) AS tmp
      )
    `, [userId, userId]);

    connection.release();

    res.json({
      success: true,
      message: 'Search saved successfully'
    });

  } catch (error) {
    console.error('Error saving search:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to save search'
    });
  }
};

// Get user's recent searches
export const getRecentSearches = async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId is required'
      });
    }

    connection = await pool.getConnection();
    
    // Get user's recent searches (last 20)
    const [recentSearches] = await connection.query(`
      SELECT 
        id,
        query,
        results_count,
        created_at
      FROM search_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);

    connection.release();

    // Format the response
    const formattedSearches = recentSearches.map(item => ({
      id: item.id,
      query: item.query,
      resultsCount: item.results_count,
      timestamp: item.created_at,
      // Format relative time (e.g., "2 hours ago", "yesterday")
      relativeTime: getRelativeTime(item.created_at)
    }));

    res.json({
      success: true,
      data: formattedSearches
    });

  } catch (error) {
    console.error('Error fetching recent searches:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent searches'
    });
  }
};

// Clear user's search history
export const clearSearchHistory = async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId is required'
      });
    }

    connection = await pool.getConnection();
    
    await connection.query(`
      DELETE FROM search_history 
      WHERE user_id = ?
    `, [userId]);

    connection.release();

    res.json({
      success: true,
      message: 'Search history cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing search history:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to clear search history'
    });
  }
};

// Helper function to format relative time
function getRelativeTime(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now - past) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 7) {
    return past.toLocaleDateString();
  } else if (diffInDays > 0) {
    return diffInDays === 1 ? 'yesterday' : `${diffInDays} days ago`;
  } else if (diffInHours > 0) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  } else if (diffInMinutes > 0) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  } else {
    return 'Just now';
  }
}
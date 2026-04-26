import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Enhanced connection pool configuration for remote MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  typeCast: (field, next) => {
    // Convert TINYINT(1) to boolean
    if (field.type === "TINY" && field.length === 1) {
      const val = field.string();
      return val === "1" ? true : false;
    }
    return next();
  },
  // Critical settings for remote MySQL connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
  // Connection timeout settings
  connectTimeout: 30000, // 30 seconds
  // Handle connection errors
  maxIdle: 10,
  idleTimeout: 60000, // 60 seconds - keep connections alive
  // Reconnect settings
  acquireTimeout: 30000,
  timezone: 'Z'  // Morocco timezone
});

// Test connection on startup
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL pool connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL pool connection failed:', err.message);
  });

// Handle pool errors
pool.on('connection', (connection) => {
  console.log('🔄 New MySQL connection established');
  
  // Set session timeout to prevent premature disconnection
  connection.query('SET SESSION wait_timeout = 28800'); // 8 hours
  connection.query('SET SESSION interactive_timeout = 28800'); // 8 hours
});

pool.on('error', (err) => {
  console.error('❌ MySQL Pool Error:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Connection lost, pool will reconnect automatically');
  }
});

export const initDB = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 🧍 Clients table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        gender ENUM('Male','Female','Other'),
        bio VARCHAR(500),
        verification_code VARCHAR(10),
        is_verified TINYINT DEFAULT 0,
        resetPasswordCode VARCHAR(10),
        resetPasswordExpire DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

     // Fix phone column to allow Google login (no phone required)
    try {
      await connection.query(`
        ALTER TABLE clients
        MODIFY phone VARCHAR(20) NULL;
      `);
      console.log('✅ phone column updated to NULL');
    } catch (error) {
      console.log('Note: phone column may already allow NULL');
    }
     // Fix email column to allow Google login (no phone required)
    try {
      await connection.query(`
        ALTER TABLE clients
        MODIFY email VARCHAR(100) UNIQUE NULL;
      `);
      console.log('✅ phone column updated to NULL');
    } catch (error) {
      console.log('Note: phone column may already allow NULL');
    }

    try {
      // Separate statements
      await connection.query(`ALTER TABLE clients ADD COLUMN google_id VARCHAR(255) NULL`);
      await connection.query(`CREATE INDEX idx_google_id ON clients(google_id)`);
      console.log('✅ Google Sign-In columns added successfully');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ google_id column already exists');
      } else if (error.message.includes('Duplicate key name')) {
        console.log('ℹ️ google_id index already exists');
      } else {
        console.error('❌ Error adding Google columns:', error.message);
      }
    }

    try {
      // Separate statements
      await connection.query(`ALTER TABLE clients ADD COLUMN current_language VARCHAR(255) NULL`);
      console.log('✅ Current Language column added successfully');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ Current Language column already exists');
      } else if (error.message.includes('Duplicate key name')) {
        console.log('ℹ️ Current Language index already exists');
      } else {
        console.error('❌ Error adding Current Language column:', error.message);
      }
    }


    // Add columns to clients table
    const clientColumns = [
      { name: 'isPhoneVerified', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'phoneVerificationCode', type: 'VARCHAR(10)' },
      { name: 'phoneVerificationCodeExpire', type: 'DATETIME' },
      { name: 'is_active', type: 'TINYINT DEFAULT 1' },
      { name: 'image', type: 'VARCHAR(255)' },
    ];

    for (const col of clientColumns) {
      try {
        await connection.query(`ALTER TABLE clients ADD COLUMN ${col.name} ${col.type};`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.log(`Note: ${col.name} column may already exist`);
        }
      }
    }

    // 🍽️ Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        image VARCHAR(255),
        description TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    try {
      await connection.query(`
        ALTER TABLE categories
        ADD COLUMN restaurant_id INT,
        ADD CONSTRAINT fk_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
      `);
      console.log("restaurant_id column added successfully.");
    } catch (error) {
      console.error("Error adding restaurant_id column:", error);
    }

    // 🧆 Products table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        rating DECIMAL(2,1) DEFAULT 0,
        image VARCHAR(255),
        category_id INT NOT NULL,
        delivery VARCHAR(100),
        promo BOOLEAN DEFAULT FALSE,
        promoValue INT DEFAULT 0,
        badge VARCHAR(255),
        is_popular BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
    `);

    try {
      await connection.query(`ALTER TABLE products ADD COLUMN is_popular BOOLEAN DEFAULT FALSE;`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: is_popular column may already exist');
      }
    }

    try {
      await connection.query(`ALTER TABLE products ADD COLUMN best_for varchar(100)`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: best for column may already exist');
      }
    }

    // Add active field to products if it doesn't exist
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE;`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: active column may already exist');
      }
    }

  // 🍽️ Restaurants table
  try {
    console.log("🔥 Creating restaurants table...");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        specialities TEXT,
        logo VARCHAR(255),
        image VARCHAR(255),
        address VARCHAR(255),
        lat DECIMAL(10,7),
        lon DECIMAL(10,7),
        phone VARCHAR(30),
        email VARCHAR(255),
        rating DECIMAL(2,1) DEFAULT 0,
        estimated_time VARCHAR(50) DEFAULT NULL,
        delivery_fees DECIMAL(10,2) DEFAULT 0,
        min_order DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Restaurants table created or already exists");

  } catch (error) {
    console.error("❌ Error creating restaurants table:", error.message);
  }


  ///

  try {
  await connection.query(`
    ALTER TABLE restaurants 
    ADD COLUMN manual_override_expires_at DATETIME NULL;
  `);
  console.log("✅ Column 'manual_override_expires_at' added successfully.");
} catch (error) {
  if (error.message.includes('Duplicate column name')) {
    console.log("ℹ️ Column 'manual_override_expires_at' already exists.");
  } else {
    console.error("❌ Error adding column:", error.message);
  }
}
  ///

  // add column is_open to table restaurants
    try {
    await connection.query(`
      ALTER TABLE restaurants
      ADD COLUMN is_open TINYINT(1) DEFAULT 1
    `);

    console.log("✅ is_open column added to restaurants table");
  } catch (error) {
    console.error("❌ Error adding is_open column to restaurants:", error);
  }

  // add column is_popular to table restaurants
    try {
    await connection.query(`
      ALTER TABLE restaurants
      ADD COLUMN is_popular BOOLEAN DEFAULT FALSE
    `);

    console.log("✅ is_popular column added to restaurants table");
  } catch (error) {
    console.error("❌ Error adding is_popular column to restaurants:", error);
  }


  try {
  console.log("🛠️  Updating restaurants table with delivery settings...");

  // Define the columns we want to add
  const columnsToAdd = [
    "ADD COLUMN base_delivery_fee DECIMAL(10,2) DEFAULT 0.00",
    "ADD COLUMN per_km_fee DECIMAL(10,2) DEFAULT 1.50",
    "ADD COLUMN max_delivery_distance_km DECIMAL(10,2) DEFAULT 20.00",
    "ADD COLUMN min_delivery_fee DECIMAL(10,2) DEFAULT 5.00",
    "ADD COLUMN max_delivery_fee DECIMAL(10,2) DEFAULT 50.00"
  ];

  for (const columnSql of columnsToAdd) {
    try {
      // We run each column individually so if one exists, the loop continues
      await connection.query(`ALTER TABLE restaurants ${columnSql}`);
      console.log(`✅ Column added/verified: ${columnSql.split(' ')[2]}`);
    } catch (err) {
      // Error code 1060 = "Duplicate column name", which is fine!
      if (err.errno === 1060) {
        // Just skip if it already exists
      } else {
        console.error(`❌ Error adding column:`, err.message);
      }
    }
  }

  console.log("✅ Restaurant delivery settings columns ready");
} catch (error) {
  console.error("❌ Error in restaurant table migration:", error);
}


try {
  await connection.query(`
    ALTER TABLE restaurants 
    ADD COLUMN manual_override BOOLEAN DEFAULT FALSE;
  `);

  console.log("Column 'manual_override' added successfully.");
} catch (error) {
  console.error("Error adding 'manual_override' column:", error.message);
}


// 📊 Search history table for tracking user searches
try {
  console.log("🔍 Creating search_history table...");

  await connection.query(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      query VARCHAR(255) NOT NULL,
      results_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE,
      INDEX idx_user_searches (user_id, created_at),
      INDEX idx_popular_searches (query, created_at)
    );
  `);

  console.log("✅ search_history table created or already exists");

} catch (error) {
  console.error("❌ Error creating search_history table:", error.message);
}

// Optional: Add cleanup for old searches (keep last 30 days)
try {
  console.log("🧹 Setting up search_history cleanup event...");
  
  // Create an event to automatically delete searches older than 30 days
  await connection.query(`
    CREATE EVENT IF NOT EXISTS cleanup_old_searches
    ON SCHEDULE EVERY 1 DAY
    DO
      DELETE FROM search_history 
      WHERE created_at < NOW() - INTERVAL 30 DAY;
  `);
  
  console.log("✅ Search history cleanup event created");
} catch (error) {
  // Events might not be enabled in MySQL, so just log and continue
  if (!error.message.includes('Event scheduler is disabled')) {
    console.error("❌ Error creating cleanup event:", error.message);
  } else {
    console.log("ℹ️ Event scheduler disabled - skipping automatic cleanup");
  }
}

// Optional: Add a stored procedure for getting popular searches
try {
  console.log("📊 Creating popular searches procedure...");
  
  await connection.query(`
    CREATE PROCEDURE IF NOT EXISTS GetPopularSearches(IN limit_count INT)
    BEGIN
      SELECT 
        query,
        COUNT(*) as search_count,
        MAX(created_at) as last_searched
      FROM search_history
      WHERE created_at >= NOW() - INTERVAL 7 DAY
      GROUP BY query
      ORDER BY search_count DESC, last_searched DESC
      LIMIT limit_count;
    END;
  `);
  
  console.log("✅ Popular searches procedure created");
} catch (error) {
  console.error("❌ Error creating procedure:", error.message);
}


  try {
  console.log("🔥 Creating restaurant_operating_hours table...");

  await connection.query(`
    CREATE TABLE IF NOT EXISTS restaurant_operating_hours (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      day_of_week TINYINT NOT NULL COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
      is_closed TINYINT(1) DEFAULT 0,
      open_time TIME DEFAULT '09:00:00',
      close_time TIME DEFAULT '22:00:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

      UNIQUE KEY unique_restaurant_day (restaurant_id, day_of_week),
      INDEX idx_restaurant (restaurant_id),
      INDEX idx_day_of_week (day_of_week),
      INDEX idx_is_closed (is_closed)
    );
  `);

  console.log("✅ restaurant_operating_hours table ready");
} catch (error) {
  console.error("❌ Error creating restaurant_operating_hours table:", error);
}

try {
  // We use connection.query for structural changes
  await connection.query(`
    ALTER TABLE restaurant_operating_hours 
    ADD UNIQUE KEY unique_rest_day (restaurant_id, day_of_week);
  `);
  console.log('Unique constraint added successfully.');
} catch (error) {
  // MySQL error code for 'Duplicate key name' is 'ER_DUP_KEYNAME'
  // Or check the message for 'Duplicate key name'
  if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
    console.log('Note: unique_rest_day constraint already exists. Skipping.');
  } else {
    // If it's a different error (like a missing column), we want to know!
    console.error('Failed to update table structure:', error.message);
    throw error; 
  }
}

  // Just add restaurant_id column with foreign key constraint - simple try catch
  try {
    console.log("🔄 Adding restaurant_id column to products table...");
    
    // First add the column
    await connection.query(`
      ALTER TABLE products 
      ADD COLUMN restaurant_id INT
    `);
    
    console.log("✅ Added restaurant_id column to products table");
    
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log("📝 restaurant_id column already exists");
    } else {
      console.error("❌ Error adding restaurant_id column:", error.message);
    }
  }

  // Add foreign key constraint
  try {
    console.log("🔄 Adding foreign key constraint to restaurant_id...");
    
    await connection.query(`
      ALTER TABLE products 
      ADD CONSTRAINT fk_products_restaurant_id 
      FOREIGN KEY (restaurant_id) 
      REFERENCES restaurants(id) 
      ON DELETE SET NULL
    `);
    
    console.log("✅ Added foreign key constraint to restaurant_id");
    
  } catch (error) {
    if (error.message.includes('Duplicate foreign key constraint name') || 
        error.message.includes('foreign key constraint fails') ||
        error.message.includes('errno: 121')) {
      console.log("📝 Foreign key constraint may already exist");
    } else {
      console.error("❌ Error adding foreign key constraint:", error.message);
    }
  }

  // 🏠 Addresses table
try {
  console.log("🔥 Creating addresses table...");

  await connection.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      full_address TEXT NOT NULL,
      is_default BOOLEAN DEFAULT FALSE,
      lat DECIMAL(10,7),
      lon DECIMAL(10,7),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  console.log("✅ Addresses table created or already exists");

} catch (error) {
  console.error("❌ Error creating addresses table:", error.message);
}


    // 🧾 Orders table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        status ENUM('Pending', 'Preparing', 'OutForDelivery', 'Delivered', 'Cancelled') DEFAULT 'Pending',
        payment_status ENUM('Paid', 'Unpaid', 'Refunded') DEFAULT 'Unpaid',
        delivery_address TEXT,
        total_price DECIMAL(10,2) DEFAULT 0,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        final_price DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE
      );
    `);

    // Add last_login column if it doesn't exist
    try {
      await connection.query(`ALTER TABLE orders modify COLUMN status ENUM('Pending','Accepted', 'Preparing', 'OutForDelivery', 'Delivered', 'Cancelled') DEFAULT 'Pending';`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: status column may already exist');
      }
    }

   // Add zesty_discount column if it doesn't exist
try {
  await connection.query(`
    ALTER TABLE orders 
    ADD COLUMN zesty_discount DECIMAL(10,2) DEFAULT 0 AFTER discount;
  `);
} catch (error) {
  if (!error.message.includes('Duplicate column name')) {
    console.log('Note: zesty_discount column may already exist');
  }
}

   // Add final_price_before_zesty column if it doesn't exist
try {
  await connection.query(`
    ALTER TABLE orders 
    ADD COLUMN final_price_before_zesty DECIMAL(10,2) DEFAULT 0 AFTER zesty_discount;
  `);
} catch (error) {
  if (!error.message.includes('Duplicate column name')) {
    console.log('Note: final_price_before_zesty column may already exist');
  }
}


    // Add last_login column if it doesn't exist
    try {
      await connection.query(`ALTER TABLE orders ADD COLUMN set_prepared_at DATETIME NULL;`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: set_prepared_at column may already exist');
      }
    }

    // Add special_instructions column if it doesn't exist
    try {
      await connection.query(`ALTER TABLE orders ADD COLUMN special_instructions TEXT NULL;`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: special_instructions column may already exist');
      }
    }

    // Add restaurant_id column if it doesn't exist
try {
  await connection.query(`ALTER TABLE orders ADD COLUMN restaurant_id INT NULL;`);
} catch (error) {
  if (!error.message.includes('Duplicate column name')) {
    console.log('Note: restaurant_id column may already exist');
  }
}

  // Add foreign key constraint if it doesn't exist
  try {
    await connection.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT fk_orders_restaurant_id
      FOREIGN KEY (restaurant_id) 
      REFERENCES restaurants(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
    `);
  } catch (error) {
    if (!error.message.includes('Duplicate key') && !error.message.includes('already exists')) {
      console.log('Note: Foreign key constraint may already exist');
    }
  }


    // 🍱 Order_Items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price_per_unit DECIMAL(10,2) NOT NULL,
        special_instructions TEXT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // 💖 Favorites table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        product_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_favorite (client_id, product_id)
      );
    `);

    // 💖 Restaurant Favorites table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurant_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        restaurant_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_restaurant_favorite (client_id, restaurant_id)
      );
    `);

    // 🚚 Delivery Men table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_men (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        vehicle_type ENUM('Bicycle', 'Motorcycle', 'Car', 'Van') DEFAULT 'Motorcycle',
        license_number VARCHAR(50),
        image VARCHAR(255),
        is_active TINYINT DEFAULT 1,
        current_latitude DECIMAL(10, 8),
        current_longitude DECIMAL(11, 8),
        last_location_update DATETIME,
        last_login DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Add last_login column if it doesn't exist
    try {
      await connection.query(`ALTER TABLE delivery_men ADD COLUMN last_login DATETIME NULL;`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: last_login column may already exist');
      }
    }

    try {
      await connection.query(`ALTER TABLE delivery_men ADD COLUMN image VARCHAR(255);`);
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: image column may already exist');
      }
    }

    // Add columns to orders table
    const orderColumns = [
      { name: 'delivery_man_id', type: 'INT' },
      { name: 'lat', type: 'DECIMAL(10, 8)' },
      { name: 'lon', type: 'DECIMAL(11, 8)' },
      { name: 'out_for_delivery_at', type: 'DATETIME' },
      { name: 'delivered_at', type: 'DATETIME' },
      { name: 'estimated_preparing_time', type: 'INT' }
    ];

    for (const col of orderColumns) {
      try {
        await connection.query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type};`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.log(`Note: ${col.name} column may already exist`);
        }
      }
    }

    try {
      await connection.query(`
        ALTER TABLE orders
        ADD CONSTRAINT fk_delivery_man 
        FOREIGN KEY (delivery_man_id) REFERENCES delivery_men(id) ON DELETE SET NULL;
      `);
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) {
        console.log('Note: Foreign key may already exist');
      }
    }

    // 👨‍💼 Admins table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_active TINYINT DEFAULT 1,
        last_login DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );
    `);

    // ➕ Add fcm_token column to admins table if not exists
    try {
      await connection.query(`
        ALTER TABLE admins
        ADD COLUMN fcm_token VARCHAR(255) NULL;
      `);
      console.log("fcm_token column added successfully");
    } catch (error) {
      console.log("Note: fcm_token column may already exist or alteration failed");
    }

    // 🔔 Notifications table - NO foreign keys (polymorphic relationship)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_type ENUM('client', 'delivery_man') NOT NULL,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_lookup (user_type, user_id, created_at)
      );
    `);

    await connection.query(`
  CREATE TABLE IF NOT EXISTS notification_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    user_id INT NOT NULL,
    user_type ENUM('client', 'delivery_man') NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pending (processed, created_at),
    INDEX idx_user (user_type, user_id),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
  );
    `);
  // Add attempts column if it doesn't exist
  try {
    await connection.query(`ALTER TABLE notification_queue ADD COLUMN attempts INT DEFAULT 0;`);
    console.log('✅ Added attempts column to notification_queue');
  } catch (error) {
    if (!error.message.includes('Duplicate column name')) {
      console.log('Note: attempts column may already exist');
    }
}
// ==================== ALTERNATIVE: RECREATE TABLES IF NEEDED ====================
const fixTablesIfNeeded = async () => {
  try {
    console.log('🔧 Checking and fixing tables if needed...');
    
    // 1. Fix notifications table ENUM
    try {
      await connection.query(`
        ALTER TABLE notifications 
        MODIFY COLUMN user_type ENUM('client', 'delivery_man', 'admin') NOT NULL
      `);
      console.log('✅ Fixed notifications.user_type ENUM');
    } catch (error) {
      console.log('ℹ️ notifications.user_type already has admin or error:', error.message);
    }
    
    // 2. Add missing columns to notifications
    const notificationColumns = [
      { name: 'data', type: 'JSON DEFAULT NULL' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ];
    
    for (const col of notificationColumns) {
      try {
        await connection.query(
          `ALTER TABLE notifications ADD COLUMN ${col.name} ${col.type}`
        );
        console.log(`✅ Added ${col.name} to notifications`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.log(`ℹ️ ${col.name} may already exist in notifications`);
        }
      }
    }
    
    // 3. Fix notification_queue table ENUM
    try {
      await connection.query(`
        ALTER TABLE notification_queue 
        MODIFY COLUMN user_type ENUM('client', 'delivery_man', 'admin') NOT NULL
      `);
      console.log('✅ Fixed notification_queue.user_type ENUM');
    } catch (error) {
      console.log('ℹ️ notification_queue.user_type already has admin or error:', error.message);
    }
    
    // 4. Add missing columns to notification_queue
    const queueColumns = [
      { name: 'data', type: 'JSON DEFAULT NULL' },
      { name: 'attempts', type: 'INT DEFAULT 0' }
    ];
    
    for (const col of queueColumns) {
      try {
        await connection.query(
          `ALTER TABLE notification_queue ADD COLUMN ${col.name} ${col.type}`
        );
        console.log(`✅ Added ${col.name} to notification_queue`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.log(`ℹ️ ${col.name} may already exist in notification_queue`);
        }
      }
    }
    
    // 5. Recreate trigger if needed
    try {
      await connection.query(`DROP TRIGGER IF EXISTS after_notification_insert`);
      
      await connection.query(`
        CREATE TRIGGER after_notification_insert
        AFTER INSERT ON notifications
        FOR EACH ROW
        BEGIN
          INSERT INTO notification_queue (notification_id, user_id, user_type, data)
          VALUES (NEW.id, NEW.user_id, NEW.user_type, NEW.data);
        END;
      `);
      console.log('✅ Recreated trigger');
    } catch (error) {
      console.log('ℹ️ Trigger may already exist or error:', error.message);
    }
    
    console.log('✅ Table fixes completed');
    
  } catch (error) {
    console.error('❌ Error fixing tables:', error);
  }
};

// Call this instead of recreateTablesIfNeeded
await fixTablesIfNeeded();

  try {
    await connection.query(`ALTER TABLE notifications ADD COLUMN data JSON DEFAULT NULL;`);
    console.log('✅ Added data column to notifications table');
  } catch (error) {
    if (!error.message.includes('Duplicate column name')) {
      console.log('Note: data column may already exist in notifications table');
    }
  }

  try {
    await connection.query(`ALTER TABLE notifications ADD COLUMN updated_at date DEFAULT NULL;`);
    console.log('✅ Added data column to notifications table');
  } catch (error) {
    if (!error.message.includes('Duplicate column name')) {
      console.log('Note: data column may already exist in notifications table');
    }
  }
    // Create a trigger to auto-populate the queue
    await connection.query(`
      CREATE TRIGGER IF NOT EXISTS after_notification_insert
      AFTER INSERT ON notifications
      FOR EACH ROW
      BEGIN
        INSERT INTO notification_queue (notification_id, user_id, user_type)
        VALUES (NEW.id, NEW.user_id, NEW.user_type);
      END;
    `);

    // 📱 Device tokens table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_type ENUM('client','delivery_man','admin') NOT NULL,
        user_id INT NOT NULL,
        fcm_token VARCHAR(255) NOT NULL,
        platform ENUM('android','ios','expo','web') DEFAULT 'android',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_device (user_type, user_id, fcm_token),
        INDEX idx_user_tokens (user_type, user_id)
      );
    `);

    // Remove problematic foreign key constraints
    try {
      await connection.query(`ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_client;`);
      console.log('✅ Removed fk_notifications_client constraint');
    } catch (err) {
      if (!err.message.includes("check that column/key exists")) {
        console.log('Note: fk_notifications_client constraint may not exist');
      }
    }

    try {
      await connection.query(`ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_delivery_man;`);
      console.log('✅ Removed fk_notifications_delivery_man constraint');
    } catch (err) {
      if (!err.message.includes("check that column/key exists")) {
        console.log('Note: fk_notifications_delivery_man constraint may not exist');
      }
    }

    // Add admin columns
    const adminColumns = [
      { name: 'api_token', type: 'VARCHAR(255)' },
      { name: 'token_expires_at', type: 'DATETIME' }
    ];

    for (const col of adminColumns) {
      try {
        await connection.query(`ALTER TABLE admins ADD COLUMN ${col.name} ${col.type};`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.log(`Note: ${col.name} column may already exist`);
        }
      }
    }

    // ⭐ Order Ratings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        food_quality INT NOT NULL CHECK (food_quality >= 1 AND food_quality <= 5),
        delivery_service INT NOT NULL CHECK (delivery_service >= 1 AND delivery_service <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE,
        UNIQUE KEY unique_order_rating (order_id)
      );
    `);

    // 📊 Delivery Performance table for tracking delivery man statistics
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_performance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        delivery_man_id INT NOT NULL,
        order_id INT NOT NULL,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        delivery_time_minutes INT NULL,
        rating DECIMAL(2,1) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_man_id) REFERENCES delivery_men(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        UNIQUE KEY unique_delivery_performance (delivery_man_id, order_id),
        INDEX idx_delivery_man (delivery_man_id),
        INDEX idx_order (order_id),
        INDEX idx_created_at (created_at)
      );
    `);

    // 🏪 Restaurant Settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurant_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_name VARCHAR(255) DEFAULT 'Restaurant',
        restaurant_address TEXT,
        restaurant_email TEXT,
        phone VARCHAR(20),
        restaurant_latitude DECIMAL(10, 8) NOT NULL,
        restaurant_longitude DECIMAL(11, 8) NOT NULL,
        base_delivery_fee DECIMAL(10,2) DEFAULT 10.00,
        per_km_fee DECIMAL(10,2) DEFAULT 2.00,
        max_delivery_distance_km DECIMAL(10,2) DEFAULT 20.00,
        min_delivery_fee DECIMAL(10,2) DEFAULT 5.00,
        max_delivery_fee DECIMAL(10,2) DEFAULT 50.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_open BOOLEAN DEFAULT TRUE,
        restaurant_logo VARCHAR(255),
        restaurant_home_screen_icon VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_restaurant_settings (id)
      );
    `);

    // Insert default restaurant settings if not exists
    const [existingSettings] = await connection.execute(
      `SELECT id FROM restaurant_settings LIMIT 1`
    );
    if (existingSettings.length === 0) {
      await connection.execute(
        `INSERT INTO restaurant_settings 
         (restaurant_name, restaurant_address, restaurant_latitude, restaurant_longitude, 
          base_delivery_fee, per_km_fee, max_delivery_distance_km, min_delivery_fee, max_delivery_fee, is_open, restaurant_logo, restaurant_home_screen_icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Restaurant',
          'Default Address',
          33.5731, // Default Casablanca coordinates
          -7.5898,
          10.00, // Base fee
          2.00,  // Per km
          20.00, // Max distance
          5.00,  // Min fee
          50.00,  // Max fee
          true,   // is_open
          '',     // restaurant_logo
          ''      // restaurant_home_screen_icon
        ]
      );
    }

    // 🎟️ Promo Codes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type ENUM('percentage', 'fixed', 'free_delivery') NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        max_discount DECIMAL(10,2) NULL,
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NOT NULL,
        usage_limit INT NULL,
        used_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        badge VARCHAR(50) NULL,
        color VARCHAR(20) DEFAULT '#FF6B35',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_active (is_active),
        INDEX idx_valid_dates (valid_from, valid_until)
      );
    `);

    // Add restaurant_id column if it doesn't exist
    try {
      await connection.query(`ALTER TABLE promo_codes ADD COLUMN restaurant_id INT NULL;`);
      console.log('✅ Added restaurant_id column to promo_codes table');
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log('Note: restaurant_id column may already exist in promo_codes table');
      }
    }

    // Add foreign key constraint
    try {
      await connection.query(`
        ALTER TABLE promo_codes 
        ADD CONSTRAINT fk_promo_codes_restaurant 
        FOREIGN KEY (restaurant_id) 
        REFERENCES restaurants(id) 
        ON DELETE CASCADE;
      `);
      console.log('✅ Added foreign key constraint to promo_codes table');
    } catch (error) {
      if (!error.message.includes('Duplicate foreign key')) {
        console.log('Note: Foreign key constraint may already exist');
      }
    }


    // ========= deals system start =========
try {
  console.log("🔥 Creating deals table...");

  await connection.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NULL,
      name VARCHAR(255) NOT NULL,
      discount_type ENUM('percentage', 'fixed') NOT NULL,
      discount DECIMAL(10,2) NOT NULL,
      image VARCHAR(500),
      description TEXT,
      start_at TIMESTAMP NOT NULL,
      end_at TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_deals_restaurant (restaurant_id),
      INDEX idx_deals_dates (start_at, end_at),
      INDEX idx_deals_active (is_active),
      INDEX idx_deals_discount_type (discount_type),

      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );
  `);

  console.log("✅ Deals table created successfully");
} catch (error) {
  console.error("❌ Error creating deals table:", error.message);
}

try {
  console.log("🔥 Creating deals_products table...");

  await connection.query(`
    CREATE TABLE IF NOT EXISTS deals_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deal_id INT NOT NULL,
      product_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,

      UNIQUE KEY unique_deal_product (deal_id, product_id),
      INDEX idx_deal_products (deal_id, product_id)
    );
  `);

  console.log("✅ deals_products table created successfully");
} catch (error) {
  console.error("❌ Error creating deals_products table:", error.message);
}



try {
  console.log("🔥 Adding times_used column to deals table...");

  await connection.query(`
    ALTER TABLE deals
    ADD COLUMN times_used INT DEFAULT 0 AFTER discount;
  `);

  console.log("✅ times_used column added to deals table");
} catch (error) {
  console.error("❌ Error adding times_used column:", error.message);
}

// ========= deals system end =========



    // 📝 Order Promo Codes tracking table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_promo_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        promo_code_id INT NOT NULL,
        discount_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
        INDEX idx_order (order_id),
        INDEX idx_promo_code (promo_code_id)
      );
    `);

    // start the offers process

    await connection.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount DECIMAL(10,2) NOT NULL,
        image VARCHAR(500),
        description TEXT,
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_offers_dates (start_at, end_at),
        INDEX idx_offers_active (is_active),
        INDEX idx_discount_type (discount_type)
      );
    `);

    // ===================== OFFER_PRODUCTS =====================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offer_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id INT NOT NULL,
        product_id INT NOT NULL,
        limited_use INT DEFAULT NULL,
        times_used INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_offer_product (offer_id, product_id),
        INDEX idx_offer_products (offer_id, product_id)
      );
    `);

    // ===================== OFFER USAGES =====================
    await connection.query(`
        CREATE TABLE IF NOT EXISTS offer_usages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        offer_id INT NOT NULL,
        product_id INT NOT NULL,
        usage_count INT DEFAULT 0,  -- Each record = 1 unit purchased with offer
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_offer_usages_user FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE,
        CONSTRAINT fk_offer_usages_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
        CONSTRAINT fk_offer_usages_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_user (user_id),
        INDEX idx_offer (offer_id),
        INDEX idx_product (product_id),
        INDEX idx_user_product (user_id, product_id)  -- For counting orders per product
      );
    `);

    try {
      await connection.query(`ALTER TABLE offer_usages ADD UNIQUE KEY uk_user_offer_product (user_id, offer_id, product_id);`);
    } catch {}

    // ===================== ORDER ITEMS DISCOUNT TRACKING SAFE UPDATES =====================

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN original_unit_price DECIMAL(10,2) NOT NULL AFTER quantity;`);
    } catch {}

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN applied_offer_id INT NULL;`);
    } catch {}

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN applied_offer_product_id INT NULL;`);
    } catch {}

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN discount_type ENUM('percentage','fixed') NULL;`);
    } catch {}

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN discount_value DECIMAL(10,2) NULL;`);
    } catch {}

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0;`);
    } catch {}

    try {
      await connection.query(`ALTER TABLE order_items ADD COLUMN final_unit_price DECIMAL(10,2) NOT NULL;`);
    } catch {}

    // ===================== SAFE FOREIGN KEY =====================

    try {
      await connection.query(`
        ALTER TABLE order_items
        ADD CONSTRAINT fk_order_items_offer_product
        FOREIGN KEY (applied_offer_product_id)
        REFERENCES offer_products(id)
        ON DELETE SET NULL;
      `);
    } catch {
      console.log("Note: fk_order_items_offer_product already exists");
    }

    console.log("✅ Database initialized successfully");

  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};



    // end the offers process
// Enhanced executeQuery with better retry logic
export const executeQuery = async (sql, params = []) => {
  const MAX_RETRIES = 3;
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let connection;
    try {
      connection = await pool.getConnection();
      const result = await connection.execute(sql, params);
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error that we can retry
      const isRetryable = 
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET' ||
        error.message?.includes('closed state') ||
        error.message?.includes('Connection lost');

      if (attempt < MAX_RETRIES - 1 && isRetryable) {
        console.warn(`⚠️ DB query failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`);
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      // If not retryable or max retries reached, throw error
      throw error;
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error releasing connection:', releaseError.message);
        }
      }
    }
  }
  
  throw lastError;
};

export default pool;
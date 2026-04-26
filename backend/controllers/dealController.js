import pool from "../config/db.js";

//////////////////////////////
// 🔓 GET ALL DEALS
//////////////////////////////
export const getDeals = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, r.name AS restaurant_name, r.logo AS restaurant_logo
      FROM deals d
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
      WHERE d.is_active = TRUE
      AND NOW() BETWEEN d.start_at AND d.end_at
      ORDER BY d.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("getDeals error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// 🔓 DEAL DETAIL
//////////////////////////////
export const getDealDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [deal] = await pool.query(`
      SELECT d.*, r.name AS restaurant_name, r.logo AS restaurant_logo
      FROM deals d
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
      WHERE d.id = ?
    `, [id]);

    if (deal.length === 0)
      return res.status(404).json({ message: "Deal not found" });

    const [products] = await pool.query(`
      SELECT p.*
      FROM deals_products dp
      JOIN products p ON dp.product_id = p.id
      WHERE dp.deal_id = ?
    `, [id]);

    res.json({
      ...deal[0],
      products
    });

  } catch (err) {
    console.error("getDealDetail error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// 🔐 CREATE DEAL
//////////////////////////////
export const createDeal = async (req, res) => {
  try {
    const {
      restaurant_id,
      name,
      discount_type,
      discount,
      image,
      description,
      start_at,
      end_at,
      products
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO deals 
      (restaurant_id, name, discount_type, discount, image, description, start_at, end_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      restaurant_id,
      name,
      discount_type,
      discount,
      image || null,
      description || null,
      start_at,
      end_at
    ]);

    const dealId = result.insertId;

    if (products && products.length > 0) {
      const values = products.map(pid => [dealId, pid]);
      await pool.query(`
        INSERT INTO deals_products (deal_id, product_id)
        VALUES ?
      `, [values]);
    }

    res.json({ message: "Deal created", deal_id: dealId });

  } catch (err) {
    console.error("createDeal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// 🔐 UPDATE DEAL
//////////////////////////////
export const updateDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      discount_type,
      discount,
      image,
      description,
      start_at,
      end_at,
      is_active,
      products
    } = req.body;

    await pool.query(`
      UPDATE deals SET
        name=?,
        discount_type=?,
        discount=?,
        image=?,
        description=?,
        start_at=?,
        end_at=?,
        is_active=?
      WHERE id=?
    `, [
      name,
      discount_type,
      discount,
      image || null,
      description || null,
      start_at,
      end_at,
      is_active,
      id
    ]);

    if (products) {
      await pool.query("DELETE FROM deals_products WHERE deal_id=?", [id]);

      if (products.length > 0) {
        const values = products.map(pid => [id, pid]);
        await pool.query(`
          INSERT INTO deals_products (deal_id, product_id)
          VALUES ?
        `, [values]);
      }
    }

    res.json({ message: "Deal updated" });

  } catch (err) {
    console.error("updateDeal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// 🔐 DELETE DEAL
//////////////////////////////
export const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM deals WHERE id=?", [id]);

    res.json({ message: "Deal deleted" });

  } catch (err) {
    console.error("deleteDeal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

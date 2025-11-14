const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../auth');

// ✅ Protect all routes
router.use(verifyToken);
router.use(verifyAdmin);

// ✅ Get all users
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, fullname, role FROM usercredentials'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// ✅ Create new user
router.post('/', async (req, res) => {
  const { email, fullname, role, password } = req.body;

  if (!email || !fullname || !role || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'INSERT INTO usercredentials (email, password_hash, fullname, role) VALUES ($1, $2, $3, $4)',
      [email, hashedPassword, fullname, role]
    );

    res.status(201).json({ message: 'User created successfully!' });
  } catch (err) {
    // PostgreSQL unique violation error code
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Email already registered' });
    }
    console.error('❌ Error creating user:', err);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// ✅ Update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, fullname, role, password } = req.body;

  if (!email || !fullname || !role) {
    return res.status(400).json({ message: 'Email, fullname, and role are required' });
  }

  try {
    const fields = [email, fullname, role];
    let query = 'UPDATE usercredentials SET email = $1, fullname = $2, role = $3';
    let paramCount = 4;

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password_hash = $${paramCount}`;
      fields.push(hashedPassword);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount}`;
    fields.push(id);

    const result = await db.query(query, fields);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('❌ Error updating user:', err);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// ✅ Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM usercredentials WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

module.exports = router;
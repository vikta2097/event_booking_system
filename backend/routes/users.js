const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db'); // ✅ unified db
const { verifyToken, verifyAdmin } = require('../auth');

// ✅ Protect all routes
router.use(verifyToken);
router.use(verifyAdmin);

// ✅ Get all users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.promise.query(
      'SELECT id, email, fullname, role FROM usercredentials'
    );
    res.json(rows);
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

    await db.promise.query(
      'INSERT INTO usercredentials (email, password_hash, fullname, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, fullname, role]
    );

    res.status(201).json({ message: 'User created successfully!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
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
    let query = 'UPDATE usercredentials SET email = ?, fullname = ?, role = ?';

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      fields.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    fields.push(id);

    const [result] = await db.promise.query(query, fields);

    if (result.affectedRows === 0) {
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
    const [result] = await db.promise.query(
      'DELETE FROM usercredentials WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

module.exports = router;

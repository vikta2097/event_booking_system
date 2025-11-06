const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../auth');

// Protect all routes: first verify token, then verify admin role
router.use(verifyToken);
router.use(verifyAdmin);

// Get all users
router.get('/', (req, res) => {
  db.query('SELECT id, email, fullname, role FROM usercredentials', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching users' });
    res.json(results);
  });
});

// Create new user
router.post('/', async (req, res) => {
  const { email, fullname, role, password } = req.body;

  if (!email || !fullname || !role || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO usercredentials (email, password_hash, fullname, role) VALUES (?, ?, ?, ?)', 
      [email, hashedPassword, fullname, role],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already registered' });
          console.error('DB error!', err);
          return res.status(500).json({ message: 'Error creating user' });
        }
        res.status(201).json({ message: 'User created!', id: result.insertId });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error during user creation' });
  }
});

// Update user
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

    db.query(query, fields, (err, result) => {
      if (err) return res.status(500).json({ message: 'Error updating user' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'User updated' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during user update' });
  }
});

// Delete user
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM usercredentials WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting user' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  });
});

module.exports = router;

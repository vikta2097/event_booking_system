const express = require('express');
const router = express.Router();
const db = require("../db"); // Adjust path to your db connection

// GET all bookings with event and user details
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        bookings.id,
        bookings.booking_date,
        bookings.seats,
        bookings.total_amount,
        bookings.status AS booking_status,
        events.id AS event_id,
        events.title AS event_title,
        events.event_date,
        events.start_time,
        events.location,
        events.price AS event_price,
        usercredentials.id AS user_id,
        usercredentials.name AS user_name,
        usercredentials.email AS user_email,
        usercredentials.phone AS user_phone
      FROM bookings
      INNER JOIN events ON bookings.event_id = events.id
      INNER JOIN usercredentials ON bookings.user_id = usercredentials.id
      ORDER BY bookings.booking_date DESC
    `;
    
    const [bookings] = await db.query(query);
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET single booking by ID
router.get('/:id', async (req, res) => {
  try {
    const query = `
      SELECT 
        bookings.*,
        events.title AS event_title,
        events.event_date,
        events.location,
        usercredentials.name AS user_name,
        usercredentials.email AS user_email,
        usercredentials.phone AS user_phone
      FROM bookings
      INNER JOIN events ON bookings.event_id = events.id
      INNER JOIN usercredentials ON bookings.user_id = usercredentials.id
      WHERE bookings.id = ?
    `;
    
    const [bookings] = await db.query(query, [req.params.id]);
    
    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(bookings[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST create new booking
router.post('/', async (req, res) => {
  try {
    const { user_id, event_id, seats, total_amount, status } = req.body;
    
    // Validate required fields
    if (!user_id || !event_id || !seats) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check event capacity
    const [events] = await db.query(
      'SELECT capacity FROM events WHERE id = ?',
      [event_id]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get current bookings for this event
    const [currentBookings] = await db.query(
      'SELECT SUM(seats) as total_seats FROM bookings WHERE event_id = ? AND status != "cancelled"',
      [event_id]
    );
    
    const bookedSeats = currentBookings[0].total_seats || 0;
    const availableSeats = events[0].capacity - bookedSeats;
    
    if (seats > availableSeats) {
      return res.status(400).json({ 
        error: `Only ${availableSeats} seats available` 
      });
    }
    
    // Insert booking
    const query = `
      INSERT INTO bookings (user_id, event_id, seats, total_amount, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.query(query, [
      user_id,
      event_id,
      seats,
      total_amount || 0,
      status || 'pending'
    ]);
    
    res.status(201).json({
      message: 'Booking created successfully',
      booking_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT update booking status
router.put('/:id', async (req, res) => {
  try {
    const { status, seats, total_amount } = req.body;
    const bookingId = req.params.id;
    
    // Check if booking exists
    const [existing] = await db.query(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Build update query dynamically
    let updateFields = [];
    let values = [];
    
    if (status) {
      updateFields.push('status = ?');
      values.push(status);
    }
    if (seats) {
      updateFields.push('seats = ?');
      values.push(seats);
    }
    if (total_amount !== undefined) {
      updateFields.push('total_amount = ?');
      values.push(total_amount);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(bookingId);
    
    const query = `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.query(query, values);
    
    res.json({ message: 'Booking updated successfully' });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE booking
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM bookings WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// GET bookings by event
router.get('/event/:eventId', async (req, res) => {
  try {
    const query = `
      SELECT 
        bookings.*,
        usercredentials.name AS user_name,
        usercredentials.email AS user_email,
        usercredentials.phone AS user_phone
      FROM bookings
      INNER JOIN usercredentials ON bookings.user_id = usercredentials.id
      WHERE bookings.event_id = ?
      ORDER BY bookings.booking_date DESC
    `;
    
    const [bookings] = await db.query(query, [req.params.eventId]);
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching event bookings:', error);
    res.status(500).json({ error: 'Failed to fetch event bookings' });
  }
});

// GET bookings by user
router.get('/user/:userId', async (req, res) => {
  try {
    const query = `
      SELECT 
        bookings.*,
        events.title AS event_title,
        events.event_date,
        events.location
      FROM bookings
      INNER JOIN events ON bookings.event_id = events.id
      WHERE bookings.user_id = ?
      ORDER BY bookings.booking_date DESC
    `;
    
    const [bookings] = await db.query(query, [req.params.userId]);
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Failed to fetch user bookings' });
  }
});

module.exports = router;
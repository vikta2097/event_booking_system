import React, { useEffect, useState } from "react";
import api from "../api";
import "../styles/UserBookings.css";

const UserBookings = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings");
        setBookings(res.data);
      } catch (err) {
        console.error("Error fetching bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  if (loading) return <p className="loading-text">Loading your bookings...</p>;
  if (!bookings.length)
    return <p className="no-bookings">You have no bookings yet.</p>;

  return (
    <div className="user-bookings">
      <h2>My Bookings</h2>
      <div className="bookings-list">
        {bookings.map((b) => (
          <div key={b.id} className="booking-card">
            <h3>{b.event_title}</h3>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(b.event_date).toLocaleDateString()}
            </p>
            <p>
              <strong>Tickets:</strong> {b.seats}
            </p>
            <p>
              <strong>Total Amount:</strong> KES {b.total_amount}
            </p>
            <p>
              <strong>Status:</strong> {b.booking_status}
            </p>
            {b.booking_status === "pending" && (
              <p className="payment-note">Payment pending</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserBookings;

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "../api";
import "../styles/UserBookings.css";

const UserBookings = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings");
        const bookingsData = res.data;

        // Fetch payments for each booking to determine status
        const bookingsWithPayment = await Promise.all(
          bookingsData.map(async (b) => {
            try {
              const paymentRes = await api.get(`/payments/by-booking/${b.id}`);
              return { ...b, paymentStatus: paymentRes.data?.status || null };
            } catch {
              return { ...b, paymentStatus: null };
            }
          })
        );

        setBookings(bookingsWithPayment);
      } catch (err) {
        console.error("Error fetching bookings:", err);
        setError("Failed to load bookings. Try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  if (loading) return <p className="loading-text">Loading your bookings...</p>;

  if (error)
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-retry">
          Retry
        </button>
      </div>
    );

  if (!bookings.length) return <p className="no-bookings">You have no bookings yet.</p>;

  return (
    <div className="user-bookings">
      <h2>My Bookings</h2>
      <div className="bookings-list">
        {bookings.map((b) => (
          <div key={b.id} className="booking-card">
            <h3>{b.event_title}</h3>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(b.event_date).toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p>
              <strong>Tickets:</strong> {b.seats}
            </p>
            <p>
              <strong>Total Amount:</strong> KES {parseFloat(b.total_amount).toLocaleString()}
            </p>
            <p>
              <strong>Status:</strong> {b.booking_status}
            </p>

            {/* Action buttons */}
            {b.booking_status === "pending" && b.paymentStatus !== "success" && (
              <button
                className="btn-action"
                onClick={() => navigate(`/dashboard/payment/${b.id}`)}
              >
                💳 Complete Payment
              </button>
            )}

            {(b.booking_status === "confirmed" || b.paymentStatus === "success") && (
              <>
                <button
                  className="btn-action"
                  onClick={() => navigate(`/dashboard/booking-success/${b.id}`)}
                >
                  🎟️ View Tickets
                </button>

                {b.tickets?.length > 0 && (
                  <div className="tickets-preview">
                    {b.tickets.map((ticket) => (
                      <QRCodeSVG key={ticket.id} value={ticket.qr_code} size={60} level="H" />
                    ))}
                  </div>
                )}
              </>
            )}

            {b.booking_status === "cancelled" && (
              <p className="cancelled-note">Booking cancelled</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserBookings;

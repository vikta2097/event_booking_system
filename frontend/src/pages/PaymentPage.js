import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/PaymentPage.css";

const PaymentPage = ({ user }) => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load booking details
  useEffect(() => {
    const loadBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        setBooking(res.data);
      } catch (err) {
        setError("Failed to load booking details");
      }
    };
    loadBooking();
  }, [bookingId]);

  // Resume existing pending payment
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await api.get(`/payments/by-booking/${bookingId}`);
        if (res.data && res.data.status === "pending") {
          setPaymentId(res.data.id);
        }
      } catch {}
    };
    checkExisting();
  }, [bookingId]);

  // Poll payment status
  useEffect(() => {
    if (!paymentId) return;

    const poll = setInterval(async () => {
      try {
        const res = await api.get(`/payments/${paymentId}`);
        const p = res.data;

        if (p.status === "success") {
          setSuccess(true);
          clearInterval(poll);

          // Redirect after slight delay
          setTimeout(() => {
            navigate(`/booking-success/${bookingId}`);
          }, 1500);
        }

        if (p.status === "failed") {
          setError("Payment failed. Please try again.");
          clearInterval(poll);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [paymentId, bookingId, navigate]);

  const handlePayment = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/payments/mpesa", {
        booking_id: bookingId,
        phone: user.phone
      });

      setPaymentId(res.data.payment_id);

      alert("STK Push sent to your phone. Follow the prompt to complete payment.");
    } catch (err) {
      setError(err.response?.data?.error || "Payment initiation failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return <p>Loading booking...</p>;

  return (
    <div className="payment-page">
      <h2>Payment for {booking.event_title}</h2>

      <p><strong>Total:</strong> KES {booking.total_amount}</p>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">Payment successful! Redirecting…</p>}

      {!success && (
        <button onClick={handlePayment} disabled={loading || paymentId}>
          {paymentId ? "Waiting for payment…" : loading ? "Processing…" : "Pay Now"}
        </button>
      )}
    </div>
  );
};

export default PaymentPage;

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import "../styles/PaymentPage.css";

const PaymentPage = ({ user }) => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState(null);

  // Fetch booking details
  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        setBooking(res.data);
      } catch (err) {
        console.error("Error fetching booking:", err);
        setError("Failed to load booking details.");
      }
    };

    fetchBooking();
  }, [bookingId]);

  // Poll for payment status every 3 seconds
  useEffect(() => {
    if (!paymentId) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/payments/${paymentId}`);
        const payment = res.data;

        if (payment.status === "success") {
          setSuccess(true);
          clearInterval(interval);
        } else if (payment.status === "failed") {
          setError("Payment failed. Please try again.");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error checking payment status:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentId]);

  // Trigger M-Pesa STK Push
  const handlePayment = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/payments/mpesa", {
        booking_id: bookingId,
        phone: user.phone, // user's phone for M-Pesa
      });

      const { payment_id } = res.data;
      setPaymentId(payment_id);

      alert(
        "STK Push sent to your phone. Follow the prompt to complete payment."
      );
    } catch (err) {
      console.error("Payment error:", err);
      setError(
        err.response?.data?.error || "Failed to initiate payment. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return <p>Loading booking...</p>;

  return (
    <div className="payment-page">
      <h2>Payment for {booking.event_title}</h2>
      <p>
        <strong>Total Amount:</strong> KES {booking.total_amount}
      </p>
      {error && <p className="error">{error}</p>}
      {success ? (
        <p>✅ Payment successful! Check your email for the entry code.</p>
      ) : (
        <button onClick={handlePayment} disabled={loading || paymentId}>
          {loading ? "Processing..." : "Pay Now via M-Pesa"}
        </button>
      )}
    </div>
  );
};

export default PaymentPage;

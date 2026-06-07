/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/PaymentPage.css";

const PaymentPage = ({ user }) => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null); // eslint-disable-line no-unused-vars
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  const pollIntervalRef = useRef(null);
  const pollCountRef = useRef(0);
  const checkoutRequestIdRef = useRef(null); // store checkout_request_id across renders
  const MAX_POLL_ATTEMPTS = 60; // 5 minutes (60 * 5s)

  // Load booking details
  useEffect(() => {
    const loadBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        const bookingData = res.data;
        setBooking(bookingData);

        if (bookingData.booking_status === "confirmed") {
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
        }
      } catch (err) {
        console.error("Error loading booking:", err);
        setError("Failed to load booking details.");
      }
    };
    loadBooking();
  }, [bookingId, navigate]);

  // Check for existing payment (page reload recovery)
  useEffect(() => {
    if (!booking) return;

    const checkExistingPayment = async () => {
      try {
        const res = await api.get(`/payments/by-booking/${bookingId}`);
        const paymentData = res.data;

        if (!paymentData) return;

        if (paymentData.status === "success") {
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
        } else if (paymentData.status === "pending") {
          // Resume polling with the saved checkout_request_id
          setPayment(paymentData);
          checkoutRequestIdRef.current = paymentData.checkout_request_id;
          pollCountRef.current = 0;
          setIsPolling(true);
        }
      } catch (err) {
        console.error("Error checking payment:", err);
      }
    };

    checkExistingPayment();
  }, [booking, bookingId, navigate]);

  // Set user's phone number
  useEffect(() => {
    if (user?.phone) setPhoneNumber(user.phone);
  }, [user]);

  // ── Polling: checks DB every 5s, queries Safaricom directly every 15s ──
  useEffect(() => {
    if (!isPolling) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        pollCountRef.current += 1;

        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          setError("Payment verification timeout. Please check your M-Pesa messages or contact support.");
          return;
        }

        // Step 1: Check your own DB (fast, cheap)
        const bookingRes = await api.get(`/bookings/${bookingId}`);
        if (bookingRes.data.booking_status === "confirmed") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
          return;
        }

        const paymentRes = await api.get(`/payments/by-booking/${bookingId}`);
        const updatedPayment = paymentRes.data;

        if (updatedPayment?.status === "success") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
          return;
        }

        if (updatedPayment?.status === "failed") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          setError("Payment failed or was cancelled. Please try again.");
          setPayment(null);
          return;
        }

        // Step 2: Every 3rd poll (~15s), ask Safaricom directly
        // This catches payments where the callback was missed (server was sleeping)
        if (pollCountRef.current % 3 === 0 && checkoutRequestIdRef.current) {
          try {
            console.log(`📡 Querying Safaricom directly (poll #${pollCountRef.current})...`);
            const queryRes = await api.post("/payments/mpesa/query", {
              checkout_request_id: checkoutRequestIdRef.current,
            });

            if (queryRes.data.paid) {
              clearInterval(pollIntervalRef.current);
              setIsPolling(false);
              navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
              return;
            }

            console.log(`📡 Safaricom query result: not paid yet (${queryRes.data.result_desc || "pending"})`);
          } catch (queryErr) {
            // Non-fatal — just keep polling via DB
            console.warn("Direct Safaricom query failed, continuing DB poll:", queryErr.message);
          }
        }

      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000); // every 5 seconds

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isPolling, bookingId, navigate]);

  // Handle payment initiation
  const handlePayment = async () => {
    if (!phoneNumber.trim()) {
      setError("Phone number is required");
      return;
    }

    // eslint-disable-next-line no-useless-escape
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    // eslint-disable-next-line no-useless-escape
    const phoneRegex = /^(\+?254|0)(7\d{8}|1\d{8})$/;

    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Safaricom phone number (07 or 01)");
      return;
    }

    setLoading(true);
    setError("");
    pollCountRef.current = 0;

    try {
      const res = await api.post("/payments/mpesa", {
        booking_id: bookingId,
        phone: cleanPhone,
      });

      // Save checkout_request_id so the poller can query Safaricom directly
      checkoutRequestIdRef.current = res.data.checkout_request_id;

      setPayment(res.data);
      setIsPolling(true);

      alert("STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.");
    } catch (err) {
      console.error("Payment error:", err);
      setError(err.response?.data?.error || "Payment initiation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsPolling(false);
    setPayment(null);
    setError("");
    pollCountRef.current = 0;
    checkoutRequestIdRef.current = null;
  };

  if (!booking) {
    return (
      <div className="payment-page">
        <p className="loading-text">Loading booking details...</p>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-container">
        <h2>Complete Your Payment</h2>

        <div className="booking-details">
          <h3>{booking.event_title}</h3>
          <p className="event-date">
            {new Date(booking.event_date).toLocaleDateString("en-GB", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="event-location">{booking.location}</p>

          {booking.tickets?.length > 0 && (
            <div className="ticket-details">
              <h4>Tickets</h4>
              {booking.tickets.map((ticket, index) => (
                <div key={index} className="ticket-item">
                  <span>
                    {ticket.ticket_name} x {ticket.quantity}
                  </span>
                  <span>KES {(ticket.price * ticket.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="total-amount">
            <strong>Total Amount:</strong>
            <strong className="amount">
              KES {parseFloat(booking.total_amount).toLocaleString()}
            </strong>
          </div>

          {payment && !isPolling && (
            <div className="payment-info">
              <p>Payment status: {payment.status}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {!isPolling && (
          <div className="payment-form">
            <div className="form-group">
              <label htmlFor="phone">M-Pesa Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="0712345678 or 0112345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
              />
              <small className="form-help">
                You will receive an M-Pesa prompt on this number
              </small>
            </div>

            <button onClick={handlePayment} disabled={loading} className="btn-pay">
              {loading ? "Sending Request..." : "Pay with M-Pesa"}
            </button>
          </div>
        )}

        {isPolling && (
          <div className="payment-pending">
            <div className="spinner"></div>
            <h4>Waiting for Payment Confirmation</h4>
            <p>Please check your phone for the M-Pesa prompt</p>
            <p>Enter your M-Pesa PIN to complete the payment</p>
            <small>
              Checking payment status... ({pollCountRef.current}/{MAX_POLL_ATTEMPTS})
            </small>
            <button onClick={handleCancelPolling} className="btn-cancel">
              Cancel & Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
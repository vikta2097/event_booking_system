import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/PaymentPage.css";

const PaymentPage = ({ user }) => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [loadRetries, setLoadRetries] = useState(0);

  const pollIntervalRef = useRef(null);
  const MAX_POLL_ATTEMPTS = 60; // 3 minutes (60 * 3 seconds)
  const MAX_LOAD_RETRIES = 3;

  // Load booking details with retry
  useEffect(() => {
    const loadBooking = async () => {
      try {
        console.log('📥 Fetching booking:', bookingId);
        setError("Loading booking details... (server may be waking up, please wait)");
        
        const res = await api.get(`/bookings/${bookingId}`, {
          headers: { 
            "Cache-Control": "no-cache", 
            "Pragma": "no-cache" 
          }
        });
        
        console.log('✅ Booking loaded:', res.data);
        const bookingData = res.data;
        setBooking(bookingData);
        setError(""); // Clear loading message

        if (bookingData.booking_status === "confirmed") {
          console.log('🎉 Booking already confirmed, redirecting...');
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
        }
      } catch (err) {
        console.error("❌ Error loading booking:", err);
        
        if (err.code === 'ERR_NETWORK') {
          if (loadRetries < MAX_LOAD_RETRIES) {
            setError(
              `Cannot connect to server (attempt ${loadRetries + 1}/${MAX_LOAD_RETRIES}). ` +
              `The server is sleeping. Retrying in 5 seconds...`
            );
            setTimeout(() => {
              setLoadRetries(prev => prev + 1);
            }, 5000);
          } else {
            setError(
              "Cannot connect to server after multiple attempts. " +
              "Please click 'Retry Loading' button below or wait 30 seconds and refresh."
            );
          }
        } else if (err.response?.status === 404) {
          setError("Booking not found. It may have been deleted or never created.");
        } else if (err.response?.status === 403) {
          setError("Access denied. This booking doesn't belong to you.");
        } else {
          setError(`Failed to load booking: ${err.response?.data?.error || err.message}`);
        }
      }
    };

    loadBooking();
  }, [bookingId, navigate, loadRetries]);

  // Check for existing payment
  useEffect(() => {
    if (!booking) return;

    const checkExistingPayment = async () => {
      try {
        const res = await api.get(`/payments/by-booking/${bookingId}`, {
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        });
        const paymentData = res.data;

        if (!paymentData) return;

        if (paymentData.status === "success") {
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
        } else if (paymentData.status === "pending") {
          setPayment(paymentData);
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

  // Poll payment status
  useEffect(() => {
    if (!isPolling) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        setPollCount((prev) => prev + 1);

        if (pollCount >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          setError(
            "Payment verification timeout. Please check your M-Pesa messages or contact support."
          );
          return;
        }

        // Always fetch fresh booking
        const bookingRes = await api.get(`/bookings/${bookingId}`, {
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        });
        const updatedBooking = bookingRes.data;

        if (updatedBooking.booking_status === "confirmed") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          navigate(`/dashboard/booking-success/${bookingId}`, { replace: true });
          return;
        }

        // Always fetch fresh payment
        const paymentRes = await api.get(`/payments/by-booking/${bookingId}`, {
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        });
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

      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isPolling, pollCount, bookingId, navigate]);

  const handlePayment = async () => {
    if (!phoneNumber.trim()) {
      setError("Phone number is required");
      return;
    }
    // eslint-disable-next-line no-useless-escape
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    // eslint-disable-next-line no-useless-escape
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Kenyan phone number (e.g., 0712345678)");
      return;
    }

    setLoading(true);
    setError("");
    setPollCount(0);

    try {
      const res = await api.post("/payments/mpesa", {
        booking_id: bookingId,
        phone: cleanPhone,
      });

      const paymentData = res.data;
      setPayment(paymentData);
      setIsPolling(true);

      alert(
        "STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment."
      );
    } catch (err) {
      console.error("Payment error:", err);
      
      if (err.code === 'ERR_NETWORK') {
        setError(
          "Cannot connect to server. The server may be sleeping. " +
          "Please wait 30 seconds and try again."
        );
      } else {
        setError(
          err.response?.data?.error || "Payment initiation failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsPolling(false);
    setPayment(null);
    setError("");
    setPollCount(0);
  };

  const handleRetryLoading = () => {
    setLoadRetries(0);
    window.location.reload();
  };

  if (!booking && !error) {
    return (
      <div className="payment-page">
        <p className="loading-text">Loading booking details...</p>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="payment-page">
        <div className="error-message">
          <span>⚠️ {error}</span>
        </div>
        {error.includes('Cannot connect') && (
          <button onClick={handleRetryLoading} className="btn-retry">
            🔄 Retry Loading
          </button>
        )}
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">
          ← Back to Dashboard
        </button>
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
                placeholder="0712345678"
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
              Checking payment status... ({pollCount}/{MAX_POLL_ATTEMPTS})
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
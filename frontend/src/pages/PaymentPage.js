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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pollCount, setPollCount] = useState(0);

  const pollIntervalRef = useRef(null);
  const MAX_POLL_ATTEMPTS = 40; // 2 minutes (40 * 3 seconds)

  // Load booking details
  useEffect(() => {
    const loadBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        setBooking(res.data);
        
        // Check if already confirmed
        if (res.data.booking_status === 'confirmed') {
          setSuccess(true);
          setTimeout(() => {
            navigate(`/dashboard/booking-success/${bookingId}`);
          }, 1500);
        }
      } catch (err) {
        console.error("Error loading booking:", err);
        setError("Failed to load booking details");
      }
    };
    loadBooking();
  }, [bookingId, navigate]);

  // Check for existing pending payment
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await api.get(`/payments/by-booking/${bookingId}`);
        if (res.data && res.data.status === "pending") {
          setPayment(res.data);
        }
      } catch (err) {
        console.error("Error checking payment:", err);
      }
    };
    checkExisting();
  }, [bookingId]);

  // Set user's phone number
  useEffect(() => {
    if (user && user.phone) {
      setPhoneNumber(user.phone);
    }
  }, [user]);

  // Poll payment status
  useEffect(() => {
    if (!payment || payment.status !== 'pending') {
      return;
    }

    const startPolling = () => {
      pollIntervalRef.current = setInterval(async () => {
        try {
          setPollCount(prev => {
            const newCount = prev + 1;
            
            // Stop polling after max attempts
            if (newCount >= MAX_POLL_ATTEMPTS) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                setError("Payment verification timeout. Please check your M-Pesa messages or try again.");
                setPayment(null); // Allow retry
              }
              return newCount;
            }
            
            return newCount;
          });

          const res = await api.get(`/payments/${payment.id}`);
          const updatedPayment = res.data;

          if (updatedPayment.status === "success") {
            setSuccess(true);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            // Redirect after slight delay
            setTimeout(() => {
              navigate(`/dashboard/booking-success/${bookingId}`);
            }, 2000);
          }

          if (updatedPayment.status === "failed") {
            setError("Payment failed or was cancelled. Please try again.");
            setPayment(null); // Allow retry
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000); // Poll every 3 seconds
    };

    startPolling();

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [payment, bookingId, navigate]);

  const handlePayment = async () => {
    if (!phoneNumber || phoneNumber.trim() === "") {
      setError("Phone number is required");
      return;
    }

    // Validate phone number
    // eslint-disable-next-line no-useless-escape
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    // eslint-disable-next-line no-useless-escape
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
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
        phone: phoneNumber
      });

      setPayment(res.data);
      
      // Show success message
      alert("STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.");
    } catch (err) {
      console.error("Payment error:", err);
      setError(err.response?.data?.error || "Payment initiation failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
              day: "numeric"
            })}
          </p>
          <p className="event-location">{booking.location}</p>
          
          {booking.tickets && booking.tickets.length > 0 && (
            <div className="ticket-details">
              <h4>Tickets</h4>
              {booking.tickets.map((ticket, index) => (
                <div key={index} className="ticket-item">
                  <span>{ticket.ticket_name} x {ticket.quantity}</span>
                  <span>KES {(ticket.price * ticket.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="total-amount">
            <strong>Total Amount:</strong>
            <strong className="amount">KES {parseFloat(booking.total_amount).toLocaleString()}</strong>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {success && (
          <div className="success-message">
            <span>✓ Payment successful! Redirecting...</span>
          </div>
        )}

        {!success && !payment && (
          <div className="payment-form">
            <div className="form-group">
              <label htmlFor="phone">
                M-Pesa Phone Number
              </label>
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

            <button 
              onClick={handlePayment} 
              disabled={loading}
              className="btn-pay"
            >
              {loading ? "Sending Request..." : "Pay with M-Pesa"}
            </button>
          </div>
        )}

        {payment && payment.status === 'pending' && (
          <div className="payment-pending">
            <div className="spinner"></div>
            <h4>Waiting for Payment Confirmation</h4>
            <p>Please check your phone for the M-Pesa prompt</p>
            <p>Enter your M-Pesa PIN to complete the payment</p>
            <small>
              Checking payment status... ({pollCount}/{MAX_POLL_ATTEMPTS})
            </small>
            <button 
              onClick={() => {
                setPayment(null);
                setError("");
                setPollCount(0);
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                }
              }}
              className="btn-cancel"
            >
              Cancel & Try Again
            </button>
          </div>
        )}

        <div className="payment-info">
          <h4>How M-Pesa Payment Works</h4>
          <ol>
            <li>Click "Pay with M-Pesa" button above</li>
            <li>You'll receive a prompt on your phone</li>
            <li>Enter your M-Pesa PIN</li>
            <li>You'll receive a confirmation SMS</li>
            <li>Your booking will be confirmed automatically</li>
          </ol>
          <p className="note">
            <strong>Note:</strong> Make sure your phone is on and you have sufficient M-Pesa balance
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
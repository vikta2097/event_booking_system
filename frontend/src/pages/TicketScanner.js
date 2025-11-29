/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import api from "../api";
import "../styles/TicketScanner.css";

const TicketScanner = () => {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scannerActive, setScannerActive] = useState(true);
  const scannerRef = useRef(null);
  const isProcessing = useRef(false);

  const validateTicket = async (code, isManual = false) => {
  // Prevent duplicate processing
  if (isProcessing.current) return;
  
  isProcessing.current = true;
  setLoading(true);
  setError("");
  setScanResult(null);

  try {
    // Determine if it's a QR code or manual code
    const payload = isManual || code.includes('-') && code.length < 20
      ? { manual_code: code }
      : { qr_code: code };

    const response = await api.post("/tickets/validate", payload);
    
    setScanResult({
      success: response.data.valid,
      message: response.data.message,
      ticket: response.data.ticket,
    });
    
    playSound(response.data.valid ? "success" : "error");
  } catch (err) {
    const errorData = err.response?.data;
    setScanResult({
      success: false,
      message: errorData?.message || "Validation failed",
      ticket: errorData?.ticket || null,
    });
    playSound("error");
  } finally {
    setLoading(false);
    isProcessing.current = false;
  }
};


  const playSound = (type) => {
    const audio = new Audio(
      type === "success" ? "/sounds/success.mp3" : "/sounds/error.mp3"
    );
    audio.play().catch(() => {
      // Silently fail if sounds aren't available
    });
  };

  useEffect(() => {
    if (!scannerActive) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
      },
      false
    );

    const onScanSuccess = async (decodedText) => {
      // Prevent multiple scans while processing
      if (isProcessing.current) return;
      
      if (scannerRef.current) {
        try {
          await scannerRef.current.pause(true);
        } catch (e) {
          console.error("Error pausing scanner:", e);
        }
      }
      
      await validateTicket(decodedText);
    };

    const onScanFailure = () => {
      // Ignore scan failures - they're normal
    };

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [scannerActive]);

  const handleManualSubmit = (e) => {
  e.preventDefault();
  if (manualCode.trim() && !loading) {
    // Remove spaces and hyphens, convert to uppercase
    const cleanedCode = manualCode.trim().replace(/[\s\-]/g, '').toUpperCase();
    validateTicket(cleanedCode, true);
  }
};

  const handleScanAnother = () => {
    setScanResult(null);
    setError("");
    setManualCode("");
    isProcessing.current = false;
    
    if (scannerRef.current && scannerActive) {
      try {
        scannerRef.current.resume();
      } catch (e) {
        // If resume fails, restart scanner
        setScannerActive(false);
        setTimeout(() => setScannerActive(true), 100);
      }
    }
  };

  const toggleScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    
    setScannerActive(!scannerActive);
    setScanResult(null);
    setError("");
    setManualCode("");
    isProcessing.current = false;
  };

  return (
  <div className="ticket-scanner">
    <div className="scanner-header">
      <h2>🎫 Ticket Validation</h2>
      <button onClick={toggleScanner} className="btn-toggle">
        {scannerActive ? "📝 Use Manual Entry" : "📷 Use Camera Scanner"}
      </button>
    </div>

    {scannerActive && !scanResult && (
      <div className="scanner-container">
        <div id="qr-reader"></div>
        <p className="scanner-hint">📱 Point camera at QR code to scan</p>
      </div>
    )}

    {!scannerActive && !scanResult && (
      <form onSubmit={handleManualSubmit} className="manual-entry">
        <div className="form-group">
          <label htmlFor="qr-code">Enter Ticket Code</label>
          <input
            id="qr-code"
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX or TKT-..."
            autoFocus
            disabled={loading}
            maxLength={50}
          />
          <p className="input-hint">
            Enter either the manual code (e.g., AB3C-5D7E-9FGH) or QR code
          </p>
        </div>
        <button
          type="submit"
          disabled={loading || !manualCode.trim()}
          className="btn-validate"
        >
          {loading ? "⏳ Validating..." : "✓ Validate Ticket"}
        </button>
      </form>
    )}

    {loading && (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Validating ticket...</p>
      </div>
    )}

    {scanResult && (
      <div className={`scan-result ${scanResult.success ? "success" : "error"}`}>
        <div className="result-icon">{scanResult.success ? "✅" : "❌"}</div>

        <h3>{scanResult.message}</h3>

        {scanResult.ticket && (
          <div className="ticket-details">
            {scanResult.ticket.attendee_name && (
              <div className="detail-row">
                <span className="label">👤 Attendee:</span>
                <span className="value">{scanResult.ticket.attendee_name}</span>
              </div>
            )}
            {scanResult.ticket.ticket_type && (
              <div className="detail-row">
                <span className="label">🎟️ Ticket Type:</span>
                <span className="value">{scanResult.ticket.ticket_type}</span>
              </div>
            )}
            {scanResult.ticket.event_title && (
              <div className="detail-row">
                <span className="label">🎉 Event:</span>
                <span className="value">{scanResult.ticket.event_title}</span>
              </div>
            )}
            {scanResult.ticket.booking_reference && (
              <div className="detail-row">
                <span className="label">📋 Booking Ref:</span>
                <span className="value">#{scanResult.ticket.booking_reference}</span>
              </div>
            )}
            {scanResult.ticket.venue && (
              <div className="detail-row">
                <span className="label">📍 Venue:</span>
                <span className="value">{scanResult.ticket.venue}</span>
              </div>
            )}
            {scanResult.ticket.event_date && (
              <div className="detail-row">
                <span className="label">📅 Event Date:</span>
                <span className="value">
                  {new Date(scanResult.ticket.event_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
            {scanResult.ticket.start_time && (
              <div className="detail-row">
                <span className="label">⏰ Time:</span>
                <span className="value">{scanResult.ticket.start_time}</span>
              </div>
            )}
            {scanResult.ticket.manual_code && (
              <div className="detail-row highlight">
                <span className="label">🔑 Manual Code:</span>
                <span className="value code-display">{scanResult.ticket.manual_code}</span>
              </div>
            )}
            {scanResult.ticket.used_at && (
              <div className="detail-row warning">
                <span className="label">⚠️ Previously Used At:</span>
                <span className="value">
                  {new Date(scanResult.ticket.used_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {scanResult.ticket.validated_at && scanResult.success && (
              <div className="detail-row success-info">
                <span className="label">✓ Validated At:</span>
                <span className="value">
                  {new Date(scanResult.ticket.validated_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        <button onClick={handleScanAnother} className="btn-scan-another">
          {scannerActive ? "📷 Scan Another Ticket" : "📝 Validate Another"}
        </button>
      </div>
    )}

    {error && (
      <div className="error-message">
        <span>⚠️ {error}</span>
      </div>
    )}
  </div>
);
};


export default TicketScanner;
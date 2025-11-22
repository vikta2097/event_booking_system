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

  useEffect(() => {
    if (!scannerActive) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [scannerActive]);

  const onScanSuccess = async (decodedText) => {
    // Pause scanner while processing
    if (scannerRef.current) {
      await scannerRef.current.pause();
    }
    await validateTicket(decodedText);
  };

  const onScanFailure = (error) => {
    // Ignore scan failures (no QR in frame)
  };

  const validateTicket = async (qrCode) => {
    setLoading(true);
    setError("");
    setScanResult(null);

    try {
      const response = await api.post("/tickets/validate", { qr_code: qrCode });
      setScanResult({
        success: true,
        message: response.data.message,
        ticket: response.data.ticket,
      });

      // Play success sound
      playSound("success");
    } catch (err) {
      const errorData = err.response?.data;
      setScanResult({
        success: false,
        message: errorData?.message || "Validation failed",
        ticket: errorData?.ticket || null,
      });

      // Play error sound
      playSound("error");
    } finally {
      setLoading(false);
    }
  };

  const playSound = (type) => {
    const audio = new Audio(
      type === "success"
        ? "/sounds/success.mp3"
        : "/sounds/error.mp3"
    );
    audio.play().catch(() => {}); // Ignore if sound fails
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      validateTicket(manualCode.trim());
    }
  };

  const handleScanAnother = () => {
    setScanResult(null);
    setError("");
    setManualCode("");
    
    // Resume scanner
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  const toggleScanner = () => {
    setScannerActive(!scannerActive);
    setScanResult(null);
  };

  return (
    <div className="ticket-scanner">
      <div className="scanner-header">
        <h2>🎫 Ticket Validation</h2>
        <button onClick={toggleScanner} className="btn-toggle">
          {scannerActive ? "Use Manual Entry" : "Use Camera Scanner"}
        </button>
      </div>

      {/* QR Scanner */}
      {scannerActive && !scanResult && (
        <div className="scanner-container">
          <div id="qr-reader"></div>
          <p className="scanner-hint">Point camera at QR code</p>
        </div>
      )}

      {/* Manual Entry */}
      {!scannerActive && !scanResult && (
        <form onSubmit={handleManualSubmit} className="manual-entry">
          <div className="form-group">
            <label htmlFor="qr-code">Enter QR Code</label>
            <input
              id="qr-code"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter or paste QR code..."
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading || !manualCode.trim()}>
            {loading ? "Validating..." : "Validate Ticket"}
          </button>
        </form>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Validating ticket...</p>
        </div>
      )}

      {/* Scan Result */}
      {scanResult && (
        <div className={`scan-result ${scanResult.success ? "success" : "error"}`}>
          <div className="result-icon">
            {scanResult.success ? "✅" : "❌"}
          </div>
          
          <h3>{scanResult.message}</h3>

          {scanResult.ticket && (
            <div className="ticket-details">
              {scanResult.ticket.attendee_name && (
                <div className="detail-row">
                  <span className="label">Attendee:</span>
                  <span className="value">{scanResult.ticket.attendee_name}</span>
                </div>
              )}
              {scanResult.ticket.ticket_type && (
                <div className="detail-row">
                  <span className="label">Ticket Type:</span>
                  <span className="value">{scanResult.ticket.ticket_type}</span>
                </div>
              )}
              {scanResult.ticket.event_title && (
                <div className="detail-row">
                  <span className="label">Event:</span>
                  <span className="value">{scanResult.ticket.event_title}</span>
                </div>
              )}
              {scanResult.ticket.booking_reference && (
                <div className="detail-row">
                  <span className="label">Booking Ref:</span>
                  <span className="value">#{scanResult.ticket.booking_reference}</span>
                </div>
              )}
              {scanResult.ticket.venue && (
                <div className="detail-row">
                  <span className="label">Venue:</span>
                  <span className="value">{scanResult.ticket.venue}</span>
                </div>
              )}
              {scanResult.ticket.used_at && (
                <div className="detail-row warning">
                  <span className="label">Used At:</span>
                  <span className="value">
                    {new Date(scanResult.ticket.used_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <button onClick={handleScanAnother} className="btn-scan-another">
            Scan Another Ticket
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketScanner;
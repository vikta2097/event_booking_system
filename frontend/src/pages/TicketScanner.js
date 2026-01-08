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
  const [bulkScanMode, setBulkScanMode] = useState(false);
  const [scannedTickets, setScannedTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [events, setEvents] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  
  const scannerRef = useRef(null);
  const isProcessing = useRef(false);
  const audioSuccess = useRef(null);
  const audioError = useRef(null);

  // Initialize audio
  useEffect(() => {
    audioSuccess.current = new Audio("/sounds/success.mp3");
    audioError.current = new Audio("/sounds/error.mp3");
  }, []);

  // Fetch events for stats
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events/organizer/my-events", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setEvents(res.data || []);
      } catch (err) {
        console.error("Failed to fetch events", err);
      }
    };
    fetchEvents();
  }, []);

  // Fetch event stats
  const fetchEventStats = async (eventId) => {
    try {
      const res = await api.get(`/tickets/event/${eventId}/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  useEffect(() => {
    if (selectedEvent) {
      fetchEventStats(selectedEvent);
      // Auto-refresh stats every 30 seconds
      const interval = setInterval(() => {
        fetchEventStats(selectedEvent);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedEvent]);

  const validateTicket = async (code, isManual = false) => {
    if (isProcessing.current) return;
    
    isProcessing.current = true;
    setLoading(true);
    setError("");
    setScanResult(null);

    try {
      const payload = (isManual || (code.includes('-') && code.length < 20))
        ? { manual_code: code }
        : { qr_code: code };

      const response = await api.post("/tickets/validate", payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      const result = {
        success: response.data.valid,
        message: response.data.message,
        ticket: response.data.ticket,
        timestamp: new Date().toLocaleTimeString()
      };

      setScanResult(result);
      
      // Add to scan history
      setScanHistory(prev => [result, ...prev.slice(0, 9)]);
      
      // In bulk mode, add to scanned tickets list
      if (bulkScanMode && result.success) {
        setScannedTickets(prev => [...prev, result.ticket]);
      }
      
      // Play sound
      playSound(result.success ? "success" : "error");

      // Refresh stats if event selected
      if (selectedEvent) {
        fetchEventStats(selectedEvent);
      }
    } catch (err) {
      const errorData = err.response?.data;
      const result = {
        success: false,
        message: errorData?.message || "Validation failed",
        ticket: errorData?.ticket || null,
        timestamp: new Date().toLocaleTimeString()
      };
      setScanResult(result);
      setScanHistory(prev => [result, ...prev.slice(0, 9)]);
      playSound("error");
    } finally {
      setLoading(false);
      isProcessing.current = false;

      // Auto-clear in bulk mode
      if (bulkScanMode) {
        setTimeout(() => {
          setScanResult(null);
          if (scannerRef.current && scannerActive) {
            try {
              scannerRef.current.resume();
            } catch (e) {
              console.log("Resume error:", e);
            }
          }
        }, 2000);
      }
    }
  };

  const playSound = (type) => {
    try {
      if (type === "success" && audioSuccess.current) {
        audioSuccess.current.play();
      } else if (type === "error" && audioError.current) {
        audioError.current.play();
      }
    } catch (err) {
      console.log("Audio play failed:", err);
    }
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
      if (isProcessing.current) return;
      
      if (scannerRef.current && !bulkScanMode) {
        try {
          await scannerRef.current.pause(true);
        } catch (e) {
          console.error("Error pausing scanner:", e);
        }
      }
      
      await validateTicket(decodedText);
    };

    const onScanFailure = () => {
      // Ignore scan failures
    };

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [scannerActive, bulkScanMode]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim() && !loading) {
      const cleanedCode = manualCode.trim().replace(/[\s-]/g, '').toUpperCase();
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

  const toggleBulkMode = () => {
    setBulkScanMode(!bulkScanMode);
    setScannedTickets([]);
    setScanResult(null);
  };

  const exportScannedTickets = () => {
    const csv = [
      ["Ticket ID", "Attendee", "Ticket Type", "Event", "Scanned At"],
      ...scannedTickets.map(t => [
        t.id,
        t.attendee_name,
        t.ticket_type,
        t.event_title,
        t.validated_at
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanned-tickets-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (ticket) => {
    if (!ticket) return "";
    if (ticket.ticket_type?.toLowerCase().includes("vip")) return "vip";
    return "valid";
  };

  return (
    <div className="ticket-scanner">
      {/* Header */}
      <div className="scanner-header">
        <div>
          <h2>🎫 Ticket Validation</h2>
          <p className="subtitle">Scan QR codes or enter manual codes</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={toggleBulkMode} 
            className={`btn-toggle ${bulkScanMode ? 'active' : ''}`}
          >
            {bulkScanMode ? "⚡ Bulk Mode ON" : "⚡ Bulk Mode OFF"}
          </button>
          <button onClick={toggleScanner} className="btn-toggle">
            {scannerActive ? "📝 Manual Entry" : "📷 Camera Scanner"}
          </button>
          <button 
            onClick={() => setShowStats(!showStats)} 
            className="btn-toggle"
          >
            📊 {showStats ? "Hide" : "Show"} Stats
          </button>
        </div>
      </div>

      {/* Event Stats Dashboard */}
      {showStats && (
        <div className="stats-dashboard">
          <div className="stats-header">
            <h3>Event Check-in Statistics</h3>
            <select 
              value={selectedEvent} 
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="event-selector"
            >
              <option value="">Select Event</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>

          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎫</div>
                <div className="stat-content">
                  <p className="stat-label">Total Tickets</p>
                  <h3 className="stat-value">{stats.total_tickets}</h3>
                </div>
              </div>
              <div className="stat-card success">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <p className="stat-label">Checked In</p>
                  <h3 className="stat-value">{stats.checked_in}</h3>
                </div>
              </div>
              <div className="stat-card pending">
                <div className="stat-icon">⏳</div>
                <div className="stat-content">
                  <p className="stat-label">Pending</p>
                  <h3 className="stat-value">{stats.pending}</h3>
                </div>
              </div>
              <div className="stat-card error">
                <div className="stat-icon">❌</div>
                <div className="stat-content">
                  <p className="stat-label">Cancelled</p>
                  <h3 className="stat-value">{stats.cancelled}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <p className="stat-label">Check-in Rate</p>
                  <h3 className="stat-value">{stats.check_in_rate}</h3>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Mode Info */}
      {bulkScanMode && (
        <div className="bulk-mode-banner">
          <span>⚡ Bulk Scan Mode: Tickets auto-clear after 2s</span>
          <span>Scanned: {scannedTickets.length}</span>
          {scannedTickets.length > 0 && (
            <button onClick={exportScannedTickets} className="btn-export-small">
              Export
            </button>
          )}
        </div>
      )}

      {/* Scanner Container */}
      <div className="scanner-content">
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
          <div className={`scan-result ${scanResult.success ? "success" : "error"} ${getStatusColor(scanResult.ticket)}`}>
            <div className="result-icon">
              {scanResult.success ? "✅" : "❌"}
            </div>

            <h3>{scanResult.message}</h3>

            {scanResult.ticket && (
              <div className="ticket-details">
                {scanResult.ticket.ticket_type?.toLowerCase().includes("vip") && (
                  <div className="vip-badge">⭐ VIP TICKET ⭐</div>
                )}

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
                {scanResult.ticket.used_at && !scanResult.success && (
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

            {!bulkScanMode && (
              <button onClick={handleScanAnother} className="btn-scan-another">
                {scannerActive ? "📷 Scan Another Ticket" : "📝 Validate Another"}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="scan-history">
          <h3>Recent Scans</h3>
          <div className="history-list">
            {scanHistory.map((scan, idx) => (
              <div key={idx} className={`history-item ${scan.success ? 'success' : 'error'}`}>
                <span className="history-icon">{scan.success ? '✅' : '❌'}</span>
                <div className="history-details">
                  <strong>{scan.ticket?.attendee_name || 'Unknown'}</strong>
                  <span className="history-time">{scan.timestamp}</span>
                </div>
                <span className="history-message">{scan.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Scanned Tickets List */}
      {bulkScanMode && scannedTickets.length > 0 && (
        <div className="bulk-scanned-list">
          <div className="bulk-header">
            <h3>Scanned Tickets ({scannedTickets.length})</h3>
            <button onClick={exportScannedTickets} className="btn-export">
              📥 Export CSV
            </button>
          </div>
          <table className="scanned-tickets-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Attendee</th>
                <th>Ticket Type</th>
                <th>Event</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {scannedTickets.map((ticket, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{ticket.attendee_name}</td>
                  <td>{ticket.ticket_type}</td>
                  <td>{ticket.event_title}</td>
                  <td>{new Date(ticket.validated_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TicketScanner;
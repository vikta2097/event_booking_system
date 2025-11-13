import React, { useEffect, useState } from "react";
import api from "../api"; // Use your Axios instance with Authorization header
import "../styles/Payments.css";


const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
    fetchPayments();
  }, [filter]);

  // Fetch payments from backend
const fetchPayments = async () => {
  try {
    setLoading(true);
    const res = await api.get("/payments"); // ✅ use api instead of axios
    let data = res.data || [];
    if (filter !== "all") {
      data = data.filter((p) => p.status === filter);
    }
    setPayments(data);
  } catch (err) {
    console.error("Error fetching payments:", err);
    setError("Failed to load payments");
  } finally {
    setLoading(false);
  }
};

// Fetch stats summary
const fetchStats = async () => {
  try {
    const res = await api.get("/payments/stats"); // ✅ use api instead of axios
    setStats(res.data);
  } catch (err) {
    console.error("Error fetching stats:", err);
  }
};

// Mark a payment as refunded
const handleRefund = async (id) => {
  if (!window.confirm("Are you sure you want to mark this as refunded?")) return;
  try {
    await api.put(`/payments/refund/${id}`); // ✅ use api instead of axios
    fetchPayments();
    fetchStats();
  } catch (err) {
    console.error("Error refunding payment:", err);
    alert("Failed to process refund");
  }
};


  // ========================
  // Download CSV based on current filter
  // ========================
  const downloadCSV = () => {
    if (!payments.length) return;

    const headers = ["ID","User","Event","Amount","Method","Status","Date"];
    const rows = payments.map(p => [
      p.id,
      p.user_name || "N/A",
      p.event_title || "N/A",
      p.amount,
      p.method,
      p.status,
      new Date(p.created_at).toLocaleString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(item => `"${item}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `payments_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="payments-container">
      <h2>Payments Dashboard</h2>

      {/* Summary Section */}
      <div className="payment-stats">
        <div className="stat-card">
          <h4>Total Revenue</h4>
          <p>KES {stats.total?.toLocaleString() || 0}</p>
        </div>
        <div className="stat-card">
          <h4>Pending</h4>
          <p>{stats.pending || 0}</p>
        </div>
        <div className="stat-card">
          <h4>Failed / Refunded</h4>
          <p>{stats.failed || 0}</p>
        </div>
      </div>

      {/* Filters & Download */}
      <div className="filters">
        <label>Filter by Status:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <button onClick={downloadCSV} className="download-btn">
          Download CSV
        </button>
      </div>

      {/* Payments Table */}
      <div className="payments-table">
        {loading ? (
          <p className="loading">Loading payments...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : payments.length === 0 ? (
          <p className="no-data">No payments found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Event</th>
                <th>Amount (KES)</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.user_name || "N/A"}</td>
                  <td>{p.event_title || "N/A"}</td>
                  <td>{p.amount}</td>
                  <td>{p.method}</td>
                  <td className={`status ${p.status}`}>{p.status}</td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>
                    {p.status === "success" && (
                      <button
                        className="refund-btn"
                        onClick={() => handleRefund(p.id)}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Payments;

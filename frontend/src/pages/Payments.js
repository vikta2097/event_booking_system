import React, { useEffect, useMemo, useState } from "react";
import api from "../api"; // Axios instance with Authorization header
import "../styles/Payments.css";

const Payments = () => {
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [processingRefunds, setProcessingRefunds] = useState({});

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/payments");
      setAllPayments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Derived stats — always computed from full dataset, regardless of filter
  const stats = useMemo(() => {
    const toNum = (v) => {
      const n = typeof v === "number" ? v : parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    let total = 0;
    let pending = 0;
    let failed = 0;
    for (const p of allPayments) {
      if (p.status === "success") total += toNum(p.amount);
      else if (p.status === "pending") pending += 1;
      else if (p.status === "failed" || p.status === "refunded") failed += 1;
    }
    return { total, pending, failed };
  }, [allPayments]);

  // Filtered view for the table
  const payments = useMemo(() => {
    if (filter === "all") return allPayments;
    return allPayments.filter((p) => p.status === filter);
  }, [allPayments, filter]);

  const handleRefund = async (id) => {
    if (!window.confirm("Are you sure you want to mark this as refunded?")) return;

    setProcessingRefunds((prev) => ({ ...prev, [id]: true }));

    try {
      const paymentRes = await api.get(`/payments/${id}`);
      if (!paymentRes.data) {
        alert("Payment no longer exists");
        fetchPayments();
        return;
      }

      if (paymentRes.data.status !== "success") {
        alert("Only successful payments can be refunded");
        fetchPayments();
        return;
      }

      await api.put(`/payments/refund/${id}`);
      fetchPayments();
    } catch (err) {
      console.error("Error refunding payment:", err);
      alert(err.response?.data?.error || "Failed to process refund");
    } finally {
      setProcessingRefunds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const downloadCSV = () => {
    if (!payments.length) return;

    const headers = ["ID", "User", "Event", "Amount", "Method", "Status", "Date"];
    const rows = payments.map((p) => [
      p.id,
      p.user_name || "N/A",
      p.event_title || "N/A",
      p.amount,
      p.method,
      p.status,
      new Date(p.created_at).toLocaleString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((i) => `"${i}"`).join(","))].join("\n");
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

      {/* Summary */}
      <div className="payment-stats">
        <div className="stat-card">
          <h4>Total Revenue</h4>
          <p>KES {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="stat-card">
          <h4>Pending</h4>
          <p>{stats.pending}</p>
        </div>
        <div className="stat-card">
          <h4>Failed / Refunded</h4>
          <p>{stats.failed}</p>
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
        <button onClick={downloadCSV} className="download-btn">Download CSV</button>
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
                    {p.status === "success" ? (
                      <button
                        className="refund-btn"
                        disabled={processingRefunds[p.id]}
                        onClick={() => handleRefund(p.id)}
                      >
                        {processingRefunds[p.id] ? "Processing..." : "Refund"}
                      </button>
                    ) : (
                      "-"
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

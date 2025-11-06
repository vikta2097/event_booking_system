// src/EMSDemo.js
import React, { useEffect, useState } from "react";

/*
  EMSDemo.js
  - Single-file EMS demo (React)
  - All inline styles, localStorage persistence
  - Role-aware: admin / employee
  - Modules: Dashboard, Employees (admin), Attendance, Leave, Payroll
  - Notifications + Chatbot (menu-driven)
*/
/* eslint-disable no-unused-vars */

const STORAGE_KEY = "ems_demo_app_v2";

const initialState = {
  users: [
    { id: "u_admin", email: "admin@test.com", password: "1234", role: "admin", name: "Admin User" },
    { id: "u_user", email: "user@test.com", password: "1234", role: "employee", name: "Jane Doe" },
  ],
  employees: [
    { id: "e1", name: "Jane Doe", department: "Engineering", jobTitle: "Frontend Dev", salary: 1500, status: "active" },
    { id: "e2", name: "Sam Okoth", department: "HR", jobTitle: "HR Manager", salary: 1300, status: "active" },
    { id: "e3", name: "Alice Mwangi", department: "Finance", jobTitle: "Accountant", salary: 1400, status: "active" },
  ],
  attendance: [
    // {id, employeeId, date, status}
  ],
  leaves: [
    // {id, employeeId, startDate, endDate, reason, status}
  ],
  payslips: [
    // {id, employeeId, month, year, gross, net}
  ],
  notifications: [
    { id: 1, text: "Welcome to the EMS demo!", createdAt: Date.now(), read: false }
  ]
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    // Merge defaults with stored (keeps new shape)
    return { ...initialState, ...parsed };
  } catch (e) {
    console.error("Load state error", e);
    return initialState;
  }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Inline styles ---------- */
const styles = {
  app: { fontFamily: "Inter, Arial, sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#f3f6fb", color: "#1f2937" },
  header: { height: 64, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", boxShadow: "0 2px 6px rgba(2,6,23,0.15)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontWeight: 700, fontSize: 18 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  main: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: 220, background: "#0b1220", color: "white", padding: 16, display: "flex", flexDirection: "column", gap: 8 },
  mainContent: { flex: 1, padding: 20, overflowY: "auto" },
  sectionCard: { background: "white", padding: 18, borderRadius: 10, boxShadow: "0 4px 10px rgba(15,23,42,0.06)", marginBottom: 18 },
  smallCardRow: { display: "flex", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 12, borderRadius: 8, background: "#0f172a", color: "white", textAlign: "center" },
  button: { background: "#0369a1", color: "white", padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer" },
  ghostButton: { background: "transparent", color: "white", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer" },
  input: { padding: "8px 10px", borderRadius: 6, border: "1px solid #e6eef6", width: "100%" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 10 },
  th: { textAlign: "left", padding: 8, borderBottom: "1px solid #edf2f7", background: "#f8fafc" },
  td: { padding: 8, borderBottom: "1px solid #f1f5f9" },
  notifArea: { position: "relative" },
  notifBtn: { background: "transparent", color: "white", border: "none", fontSize: 18, cursor: "pointer", position: "relative" },
  notifCount: { position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", width: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 },
  notifPanel: { position: "absolute", right: 0, marginTop: 8, width: 320, background: "white", color: "#111827", borderRadius: 8, boxShadow: "0 10px 30px rgba(2,6,23,0.12)", padding: 12, zIndex: 60 },
  chatToggle: { position: "fixed", left: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, background: "#0369a1", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer", boxShadow: "0 6px 18px rgba(3,105,161,0.24)" },
  chatWindow: { position: "fixed", left: 20, bottom: 86, width: 300, height: 360, background: "white", borderRadius: 10, boxShadow: "0 10px 30px rgba(2,6,23,0.12)", display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 80 },
  chatHeader: { background: "#0369a1", color: "white", padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" },
  chatBody: { padding: 10, flex: 1, overflowY: "auto", background: "#fbfdff" },
  chatInputRow: { display: "flex", gap: 8, padding: 10, borderTop: "1px solid #eef2f7" },
  badge: { display: "inline-block", padding: "6px 10px", background: "#eef2ff", borderRadius: 8, color: "#0f172a", fontSize: 13 }
};

/* ---------- Utility helpers ---------- */
const uid = (p = "") => p + Math.random().toString(36).substring(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- Main Component ---------- */
export default function EMSDemo() {
  const [store, setStore] = useState(() => loadState());
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard, employees, attendance, leave, payroll
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMenuPointer, setChatMenuPointer] = useState([]); // stack for menu navigation
  const [chatMessages, setChatMessages] = useState([{ id: uid("m_"), from: "bot", text: "Hi — EMS assistant here. Choose an option." }]);

  // persist on store change
  useEffect(() => saveState(store), [store]);

  // Basic auth handler
  function login(email, password) {
    const u = store.users.find(x => x.email === email && x.password === password);
    if (!u) return alert("Invalid credentials.");
    setCurrentUser(u);
    // If user is employee, try to map to employee record by name
    setView("dashboard");
    pushNotification(`${u.name} logged in`);
  }

  function logout() {
    setCurrentUser(null);
    setView("dashboard");
  }

  /* ---------- Notifications ---------- */
  function pushNotification(text) {
    const n = { id: uid("n_"), text, createdAt: Date.now(), read: false };
    setStore(prev => ({ ...prev, notifications: [...prev.notifications, n] }));
  }
  function markAllNotifRead() {
    setStore(prev => ({ ...prev, notifications: prev.notifications.map(x => ({ ...x, read: true })) }));
  }

  /* ---------- Employees CRUD (Admin) ---------- */
  function addEmployee({ name, department, jobTitle, salary }) {
    const newEmp = { id: uid("e_"), name, department, jobTitle, salary: Number(salary || 0), status: "active" };
    setStore(prev => ({ ...prev, employees: [...prev.employees, newEmp] }));
    pushNotification(`Employee added: ${name}`);
  }
  function removeEmployee(empId) {
    setStore(prev => ({ ...prev, employees: prev.employees.filter(e => e.id !== empId) }));
    pushNotification(`Employee removed`);
  }

  /* ---------- Attendance ---------- */
  function markAttendance(employeeId, status) {
    const rec = { id: uid("a_"), employeeId, date: todayISO(), status };
    // avoid duplicate for same employee/day
    const exists = store.attendance.find(a => a.employeeId === employeeId && a.date === rec.date);
    if (exists) {
      alert("Attendance already marked for today for that employee.");
      return;
    }
    setStore(prev => ({ ...prev, attendance: [...prev.attendance, rec] }));
    pushNotification(`Attendance: ${employeeById(employeeId)?.name} — ${status}`);
  }

  /* ---------- Leave ---------- */
  function applyLeave(employeeId, startDate, endDate, reason) {
    const leave = { id: uid("l_"), employeeId, startDate, endDate, reason, status: "Pending" };
    setStore(prev => ({ ...prev, leaves: [...prev.leaves, leave] }));
    pushNotification(`Leave applied by ${employeeById(employeeId)?.name}`);
  }
  function setLeaveStatus(leaveId, status) {
    setStore(prev => ({ ...prev, leaves: prev.leaves.map(l => l.id === leaveId ? { ...l, status } : l) }));
    pushNotification(`Leave ${status}`);
  }

  /* ---------- Payroll ---------- */
  function generatePayslip(employeeId, month, year) {
    const emp = employeeById(employeeId);
    if (!emp) return;
    const gross = emp.salary || 0;
    const net = Math.round(gross * 0.9);
    const ps = { id: uid("p_"), employeeId, month, year, gross, net, createdAt: Date.now() };
    setStore(prev => ({ ...prev, payslips: [...prev.payslips, ps] }));
    pushNotification(`Payslip: ${emp.name} (${month}/${year})`);
  }

  /* ---------- Helpers ---------- */
  function employeeById(id) {
    return store.employees.find(e => e.id === id);
  }
  function currentEmployeeRecord() {
    // Try to find employee record for the logged-in user by name
    if (!currentUser) return null;
    return store.employees.find(e => e.name.toLowerCase().includes(currentUser.name.split(" ")[0].toLowerCase()));
  }

  /* ---------- Chatbot (menu-driven) ---------- */
  function chatSendUser(text) {
    const userMsg = { id: uid("m_"), from: "user", text };
    setChatMessages(c => [...c, userMsg]);
    // Interpret user's input based on current menu pointer
    const lower = text.trim().toLowerCase();
    if (lower === "menu" || lower === "m") {
      setChatMenuPointer([]);
      chatBotReply("Main menu: choose 1) Quick summary 2) Attendance 3) Leave 4) Payroll 5) Help");
      return;
    }
    // If menu-driven numeric commands:
    if (lower === "1" || lower === "quick" || lower === "summary") {
      showQuickSummary();
      return;
    }
    if (lower === "2" || lower === "attendance") {
      if (currentUser.role === "admin") {
        chatBotReply("Admin: go to Attendance tab to view and mark attendance for any employee.");
      } else {
        chatBotReply("Employee: you can mark your attendance in Attendance tab (Mark Present / Absent).");
      }
      return;
    }
    if (lower === "3" || lower === "leave") {
      if (currentUser.role === "admin") chatBotReply("Admin: visit Leave tab to approve/reject requests.");
      else chatBotReply("Employee: visit Leave tab to apply for leave.");
      return;
    }
    if (lower === "4" || lower === "payroll") {
      if (currentUser.role === "admin") chatBotReply("Admin: use Payroll tab to generate payslips.");
      else chatBotReply("Employee: visit Payroll tab to view your payslips.");
      return;
    }
    if (lower === "5" || lower === "help") {
      chatBotReply("Help: Type 'menu' to show main menu, or '1'..'5' to select an option.");
      return;
    }
    // fallback
    chatBotReply("Sorry, I didn't get that. Type 'menu' to see options.");
  }
  function chatBotReply(text) {
    const bot = { id: uid("m_"), from: "bot", text };
    setChatMessages(c => [...c, bot]);
  }
  function showQuickSummary() {
    // produce summary based on role
    if (!currentUser) {
      chatBotReply("Please log in to see a summary.");
      return;
    }
    if (currentUser.role === "admin") {
      const totalEmployees = store.employees.length;
      const pendingLeaves = store.leaves.filter(l => l.status === "Pending").length;
      const today = todayISO();
      const todaysAttendance = store.attendance.filter(a => a.date === today).length;
      chatBotReply(`Admin summary — Employees: ${totalEmployees}, Today's attendance: ${todaysAttendance}, Pending leaves: ${pendingLeaves}`);
    } else {
      const emp = currentEmployeeRecord();
      if (!emp) {
        chatBotReply("No employee record linked to your account.");
        return;
      }
      const myLeaves = store.leaves.filter(l => l.employeeId === emp.id).length;
      const myPayslips = store.payslips.filter(p => p.employeeId === emp.id).length;
      chatBotReply(`Hi ${emp.name} — your leaves: ${myLeaves}, payslips: ${myPayslips}`);
    }
  }

  /* ---------- Derived UI data ---------- */
  const unreadCount = store.notifications.filter(n => !n.read).length;
  const recentNotifs = store.notifications.slice(-6).reverse();

  /* ---------- Component UI ---------- */
  return (
    <div style={styles.app}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>VictorLabs — EMS Demo</div>
          <div style={{ marginLeft: 8 }} className="tagline">Frontend-only demo</div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.notifArea}>
            <button style={styles.notifBtn} onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications">
              🔔
              {unreadCount > 0 && <span style={styles.notifCount}>{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div style={styles.notifPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>Notifications</strong>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...styles.button, padding: "6px 9px", background: "#10b981" }} onClick={() => { markAllNotifRead(); }}>Mark all read</button>
                    <button style={{ ...styles.button, padding: "6px 9px", background: "#ef4444" }} onClick={() => { setStore(prev => ({ ...prev, notifications: [] })); }}>Clear</button>
                  </div>
                </div>
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {recentNotifs.length === 0 && <div style={{ color: "#6b7280" }}>No notifications</div>}
                  {recentNotifs.map(n => (
                    <div key={n.id} style={{ padding: 8, borderBottom: "1px solid #eef2f7" }}>
                      <div style={{ fontSize: 14 }}>{n.text}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ color: "white", marginLeft: 12 }}>
            {currentUser ? `${currentUser.name} (${currentUser.role})` : "Not signed in"}
          </div>
          {currentUser ? (
            <button style={{ ...styles.button, marginLeft: 10 }} onClick={() => logout()}>Logout</button>
          ) : null}
        </div>
      </header>

      {/* MAIN */}
      <div style={styles.main}>
        {/* SIDEBAR */}
        <aside style={styles.sidebar}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>Navigation</div>
          <NavButton label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          {currentUser && currentUser.role === "admin" && <NavButton label="Employees" active={view === "employees"} onClick={() => setView("employees")} />}
          <NavButton label="Attendance" active={view === "attendance"} onClick={() => setView("attendance")} />
          <NavButton label="Leave" active={view === "leave"} onClick={() => setView("leave")} />
          <NavButton label="Payroll" active={view === "payroll"} onClick={() => setView("payroll")} />
          <div style={{ marginTop: "auto", fontSize: 13, opacity: 0.8 }}>
            Demo — no backend • localStorage persistence
          </div>
        </aside>

        {/* CONTENT */}
        <main style={styles.mainContent}>
          {/* If not logged in: show login card */}
          {!currentUser && (
            <div style={{ maxWidth: 540, margin: "20px auto" }}>
              <div style={styles.sectionCard}>
                <h2 style={{ margin: 0 }}>Sign in to EMS Demo</h2>
                <p style={{ color: "#6b7280", marginTop: 6 }}>Use the demo credentials below</p>
                <LoginCard onLogin={login} />
                <div style={{ marginTop: 10, color: "#6b7280" }}>
                  Admin: <span className="badge">admin@test.com / 1234</span><br />
                  Employee: <span className="badge">user@test.com / 1234</span>
                </div>
              </div>
            </div>
          )}

          {/* If logged in: show selected view */}
          {currentUser && (
            <>
              {view === "dashboard" && (
                <div>
                  <div style={styles.sectionCard}>
                    <h2 style={{ marginTop: 0 }}>Dashboard</h2>
                    <div style={styles.smallCardRow}>
                      <div style={styles.statCard}>
                        <div style={{ fontSize: 12 }}>Employees</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{store.employees.length}</div>
                      </div>
                      <div style={styles.statCard}>
                        <div style={{ fontSize: 12 }}>Today's Attendance</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{store.attendance.filter(a => a.date === todayISO()).length}</div>
                      </div>
                      <div style={styles.statCard}>
                        <div style={{ fontSize: 12 }}>Pending Leaves</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{store.leaves.filter(l => l.status === "Pending").length}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong>Recent Notifications</strong>
                          <button style={{ ...styles.button, padding: "6px 8px" }} onClick={() => setNotifOpen(!notifOpen)}>View</button>
                        </div>
                        <div>
                          {store.notifications.slice(-5).reverse().map(n => (
                            <div key={n.id} style={{ padding: 10, borderRadius: 8, marginBottom: 8, background: "#fbfdff", border: "1px solid #f1f5f9" }}>
                              <div style={{ fontSize: 14 }}>{n.text}</div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>{new Date(n.createdAt).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ width: 260 }}>
                        <div style={{ marginBottom: 8 }}><strong>Quick Actions</strong></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <button style={styles.button} onClick={() => setView("attendance")}>Mark Attendance</button>
                          <button style={styles.button} onClick={() => setView("leave")}>Apply Leave</button>
                          {currentUser.role === "admin" && <button style={styles.button} onClick={() => setView("employees")}>Manage Employees</button>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent payslips */}
                  <div style={styles.sectionCard}>
                    <h3 style={{ marginTop: 0 }}>Recent Payslips</h3>
                    {store.payslips.length === 0 ? <div style={{ color: "#6b7280" }}>No payslips generated yet.</div> : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Employee</th>
                            <th style={styles.th}>Month/Year</th>
                            <th style={styles.th}>Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {store.payslips.slice(-5).reverse().map(ps => (
                            <tr key={ps.id}>
                              <td style={styles.td}>{employeeByIdUI(store, ps.employeeId).name}</td>
                              <td style={styles.td}>{ps.month}/{ps.year}</td>
                              <td style={styles.td}>${ps.net}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {view === "employees" && currentUser.role === "admin" && (
                <div style={styles.sectionCard}>
                  <h2 style={{ marginTop: 0 }}>Employee Management</h2>
                  <EmployeeManager employees={store.employees} onAdd={addEmployee} onRemove={removeEmployee} />
                </div>
              )}

              {view === "attendance" && (
                <div style={styles.sectionCard}>
                  <h2>Attendance</h2>
                  <AttendanceView
                    employees={store.employees}
                    attendance={store.attendance}
                    onMark={(empId, status) => markAttendance(empId, status)}
                    currentUser={currentUser}
                  />
                </div>
              )}

              {view === "leave" && (
                <div style={styles.sectionCard}>
                  <h2>Leave Requests</h2>
                  <LeaveView
                    currentUser={currentUser}
                    employees={store.employees}
                    leaves={store.leaves}
                    onApply={(empId, s, e, r) => applyLeave(empId, s, e, r)}
                    onSetStatus={(id, status) => setLeaveStatus(id, status)}
                  />
                </div>
              )}

              {view === "payroll" && (
                <div style={styles.sectionCard}>
                  <h2>Payroll</h2>
                  <PayrollView
                    currentUser={currentUser}
                    employees={store.employees}
                    payslips={store.payslips}
                    onGenerate={(empId, month, year) => generatePayslip(empId, month, year)}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* CHATBOT */}
      <div style={styles.chatToggle} title="Open assistant" onClick={() => setChatOpen(v => !v)}>💬</div>
      {chatOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.chatHeader}>
            <div>EMS Assistant</div>
            <div style={{ fontSize: 12 }}>
              <button style={{ ...styles.ghostButton, padding: "6px 8px" }} onClick={() => { setChatMessages([{ id: uid("m_"), from: "bot", text: "Hi — EMS assistant here. Type 'menu' or '1'..'5'." }]); setChatMenuPointer([]); }}>Reset</button>
              <button style={{ ...styles.ghostButton, padding: "6px 8px", marginLeft: 8 }} onClick={() => setChatOpen(false)}>Close</button>
            </div>
          </div>
          <div style={styles.chatBody}>
            {chatMessages.map(m => (
              <div key={m.id} style={{ marginBottom: 8, display: "flex", justifyContent: m.from === "bot" ? "flex-start" : "flex-end" }}>
                <div style={{ maxWidth: "78%", padding: 8, borderRadius: 8, background: m.from === "bot" ? "#eff6ff" : "#0369a1", color: m.from === "bot" ? "#0f172a" : "white", fontSize: 14 }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div style={styles.chatInputRow}>
            <input style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #e6eef6" }} placeholder="Type 'menu' or an option number..." onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = e.target.value;
                e.target.value = "";
                chatSendUser(val);
              }
            }} />
            <button style={styles.button} onClick={() => {
              // find input in DOM (quick hack to stay single file)
              const root = document.activeElement;
              // fallback: take value from first input
              const inp = document.querySelector('.chat-input-row-placeholder') || document.querySelector('input[placeholder="Type \'menu\' or an option number..."]');
              if (inp) {
                const v = inp.value;
                inp.value = "";
                chatSendUser(v);
              } else {
                chatBotReply("No input found.");
              }
            }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Small UI subcomponents ---------- */

function NavButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "block", textAlign: "left", padding: "10px 12px", borderRadius: 8, background: active ? "#06263a" : "transparent", border: "none", color: "white", cursor: "pointer" }}>
      {label}
    </button>
  );
}

function LoginCard({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #e6eef6" }} />
      <input placeholder="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #e6eef6" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.button} onClick={() => onLogin(email.trim(), pass)}>Sign in</button>
        <button style={{ ...styles.ghostButton }} onClick={() => { setEmail("admin@test.com"); setPass("1234"); }}>Fill Admin</button>
        <button style={{ ...styles.ghostButton }} onClick={() => { setEmail("user@test.com"); setPass("1234"); }}>Fill Employee</button>
      </div>
    </div>
  );
}

/* Employees manager */
function EmployeeManager({ employees, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [salary, setSalary] = useState("");

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
        <input placeholder="Department" value={department} onChange={e => setDepartment(e.target.value)} style={styles.input} />
        <input placeholder="Job title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} style={styles.input} />
        <input placeholder="Salary" value={salary} onChange={e => setSalary(e.target.value)} style={styles.input} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <button style={styles.button} onClick={() => {
          if (!name) return alert("Name required");
          onAdd({ name, department, jobTitle, salary });
          setName(""); setDepartment(""); setJobTitle(""); setSalary("");
        }}>Add employee</button>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Department</th>
            <th style={styles.th}>Job title</th>
            <th style={styles.th}>Salary</th>
            <th style={styles.th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(e => (
            <tr key={e.id}>
              <td style={styles.td}>{e.name}</td>
              <td style={styles.td}>{e.department}</td>
              <td style={styles.td}>{e.jobTitle}</td>
              <td style={styles.td}>${e.salary}</td>
              <td style={styles.td}><button style={{ ...styles.button, background: "#ef4444" }} onClick={() => onRemove(e.id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Attendance view */
function AttendanceView({ employees, attendance, onMark, currentUser }) {
  const me = currentUser.role === "employee" ? (employees.find(e => e.name.toLowerCase().includes(currentUser.name.split(" ")[0].toLowerCase())) || null) : null;
  const today = todayISO();

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {currentUser.role === "admin" ? (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}><strong>Mark attendance (Admin)</strong></div>
            <AttendanceAdminForm employees={employees} onMark={onMark} />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}><strong>Your Attendance</strong></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.button} onClick={() => { if (!me) return alert("No employee record linked to your account"); onMark(me.id, "Present"); }}>Mark Present</button>
              <button style={{ ...styles.button, background: "#ef4444" }} onClick={() => { if (!me) return alert("No employee record linked to your account"); onMark(me.id, "Absent"); }}>Mark Absent</button>
            </div>
          </div>
        )}

        <div style={{ width: 300 }}>
          <div style={{ marginBottom: 8 }}><strong>Today's attendance</strong></div>
          <div style={{ background: "#fbfdff", padding: 10, borderRadius: 8 }}>
            {attendance.filter(a => a.date === today).length === 0 ? <div style={{ color: "#6b7280" }}>No records yet</div> :
              attendance.filter(a => a.date === today).map(a => (
                <div key={a.id} style={{ padding: 6, borderBottom: "1px dashed #eef2f7" }}>{employees.find(e => e.id === a.employeeId)?.name} — <span style={{ fontWeight: 700 }}>{a.status}</span></div>
              ))
            }
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: 8 }}>Attendance History (most recent)</h4>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Employee</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.slice(-20).reverse().map(a => (
              <tr key={a.id}>
                <td style={styles.td}>{a.date}</td>
                <td style={styles.td}>{employees.find(e => e.id === a.employeeId)?.name}</td>
                <td style={styles.td}>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function AttendanceAdminForm({ employees, onMark }) {
  const [sel, setSel] = useState(employees[0]?.id || "");
  const [status, setStatus] = useState("Present");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={sel} onChange={e => setSel(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e6eef6", flex: 1 }}>
        <option value="">-- select employee --</option>
        {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
      </select>
      <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e6eef6" }}>
        <option>Present</option>
        <option>Absent</option>
        <option>Remote</option>
      </select>
      <button style={styles.button} onClick={() => { if (!sel) return alert("Select employee"); onMark(sel, status); }}>Mark</button>
    </div>
  );
}

/* Leave view */
function LeaveView({ currentUser, employees, leaves, onApply, onSetStatus }) {
  const me = currentUser.role === "employee" ? (employees.find(e => e.name.toLowerCase().includes(currentUser.name.split(" ")[0].toLowerCase())) || null) : null;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [empSel, setEmpSel] = useState(employees[0]?.id || "");

  return (
    <div>
      {currentUser.role === "employee" ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}><strong>Apply for leave</strong></div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={styles.input} />
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={styles.input} />
            <input placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} style={styles.input} />
            <button style={styles.button} onClick={() => {
              if (!me) return alert("No employee record linked");
              if (!start || !end) return alert("Dates required");
              onApply(me.id, start, end, reason || "No reason");
              setStart(""); setEnd(""); setReason("");
            }}>Apply</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}><strong>Apply leave on behalf</strong></div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={empSel} onChange={e => setEmpSel(e.target.value)} style={styles.input}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={styles.input} />
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={styles.input} />
            <input placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} style={styles.input} />
            <button style={styles.button} onClick={() => {
              if (!empSel || !start || !end) return alert("Select employee and dates");
              onApply(empSel, start, end, reason || "No reason");
              setStart(""); setEnd(""); setReason("");
            }}>Apply</button>
          </div>
        </div>
      )}

      <div>
        <h4 style={{ marginBottom: 8 }}>Leave requests</h4>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee</th>
              <th style={styles.th}>Range</th>
              <th style={styles.th}>Reason</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l.id}>
                <td style={styles.td}>{employees.find(e => e.id === l.employeeId)?.name}</td>
                <td style={styles.td}>{l.startDate} → {l.endDate}</td>
                <td style={styles.td}>{l.reason}</td>
                <td style={styles.td}>{l.status}</td>
                <td style={styles.td}>
                  {currentUser.role === "admin" && (
                    <>
                      <button style={{ ...styles.button, padding: "6px 8px" }} onClick={() => onSetStatus(l.id, "Approved")}>Approve</button>
                      <button style={{ ...styles.button, background: "#ef4444", padding: "6px 8px", marginLeft: 6 }} onClick={() => onSetStatus(l.id, "Rejected")}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td style={styles.td} colSpan={5}>No leave requests</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Payroll view */
function PayrollView({ currentUser, employees, payslips, onGenerate }) {
  const [empSel, setEmpSel] = useState(employees[0]?.id || "");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  return (
    <div>
      {currentUser.role === "admin" ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={empSel} onChange={e => setEmpSel(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input placeholder="Month (1-12)" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: 8, borderRadius: 6, width: 140 }} />
            <input placeholder="Year" value={year} onChange={e => setYear(e.target.value)} style={{ padding: 8, borderRadius: 6, width: 100 }} />
            <button style={styles.button} onClick={() => {
              if (!empSel || !month || !year) return alert("Select employee, month and year");
              onGenerate(empSel, Number(month), Number(year));
              setMonth(""); setYear(new Date().getFullYear());
            }}>Generate payslip</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12, color: "#6b7280" }}>
          Employees can view payslips generated for them in the list below.
        </div>
      )}

      <div>
        <h4 style={{ marginBottom: 8 }}>Payslips</h4>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee</th>
              <th style={styles.th}>Month/Year</th>
              <th style={styles.th}>Net</th>
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 && <tr><td style={styles.td} colSpan={3}>No payslips</td></tr>}
            {payslips.slice().reverse().map(p => (
              <tr key={p.id}>
                <td style={styles.td}>{employeeByIdUI({ employees }, p.employeeId).name}</td>
                <td style={styles.td}>{p.month}/{p.year}</td>
                <td style={styles.td}>${p.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* small UI helper used earlier to avoid referencing closure vars incorrectly */
function employeeByIdUI(store, id) {
  return store.employees.find(e => e.id === id) || { name: "—" };
}
function employeeByIdUI2(employees, id) {
  return employees.find(e => e.id === id) || { name: "—" };
}
function employeeByIdUI_plain(employees, id) {
  return employees.find(e => e.id === id) || { name: "—" };
}
// helper wrapper used inside table render (safe)
function employeeByIdUIWrapper(store, id) {
  return employeeByIdUI(store, id);
}

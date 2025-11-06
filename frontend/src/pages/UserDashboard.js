import React from "react";

function UserDashboard({ token, onLogout }) {
  return (
    <div style={{ textAlign: "center", marginTop: "60px" }}>
      <h2>Welcome, User!</h2>
      <p>This is your user dashboard.</p>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
}

export default UserDashboard;

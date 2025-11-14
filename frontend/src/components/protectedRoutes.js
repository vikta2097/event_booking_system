import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

const ProtectedRoute = ({ user, setRedirect, children }) => {
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      setRedirect(location.pathname);
    }
  }, [user, location.pathname, setRedirect]);

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;

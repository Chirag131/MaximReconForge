import { useMemo, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // <AnimatePresence mode="sync"> in SharedLayout keeps the exiting route
  // element mounted during its exit transition, so this component can keep
  // rendering for a few frames *after* the URL has already moved to /login.
  // Freezing the original location in a ref (captured once, on first
  // render) means later renders don't recompute the redirect target from
  // an already-changed pathname. Wrapping it in a one-time useMemo also
  // keeps the `state` object reference stable — react-router's <Navigate>
  // depends on `state` by reference in its redirect effect, so a fresh
  // object literal on every render would re-fire that effect forever.
  const originalLocationRef = useRef(location);
  const redirectState = useMemo(() => ({ from: originalLocationRef.current }), []);

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={redirectState} replace />;
  }

  return children;
}

export default ProtectedRoute;

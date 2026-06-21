import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "./Components/AppHeader";
import { Dashboard } from "./Components/Dashboard";
import { LoginPanel } from "./Components/LoginPanel";
import { StorageWarning } from "./Components/StorageWarning";
import { restoreSession, subscribeAuthState } from "./services/authService";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeAuthState((authenticated) => {
      if (isMounted) setIsAuthenticated(authenticated);
    });

    void restoreSession();

    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return (
      <main id="LoginPage">
        <p className="Muted">載入中...</p>
      </main>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
      {isAuthenticated ? (
        <>
          <AppHeader />
          <StorageWarning />
        </>
      ) : null}
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPanel />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

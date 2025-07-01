import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, PortfolioProvider } from "./context";
import ThemeToggle from "./components/ThemeToggle";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Builder from "./pages/Builder";
import Backtest from "./pages/Backtest";
import Trading from "./pages/Trading";
import Portfolio from "./pages/Portfolio";
import AI from "./pages/AI";
import Health from "./pages/Health";
import "./App.css";

function AppRoutes() {
  const { token } = useAuth();
  return (
    <div className="app-layout">
      {token && <Sidebar />}
      <main className={token ? "main-with-sidebar" : "main-full"}>
        <Topbar />
        <Routes>
          {/* LANDING: Always visible, navigation options handled in Landing page */}
          <Route path="/" element={<Landing />} />
          {/* REGISTER: Shown only when not logged in */}
          <Route
            path="/register"
            element={!token ? <Register /> : <Navigate to="/dashboard" replace />}
          />
          {/* LOGIN: Shown only when not logged in */}
          <Route
            path="/login"
            element={!token ? <Login /> : <Navigate to="/dashboard" replace />}
          />
          {/* DASHBOARD: Only when logged in */}
          <Route
            path="/dashboard"
            element={token ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/builder"
            element={token ? <Builder /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/backtest"
            element={token ? <Backtest /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/trading"
            element={token ? <Trading /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/portfolio"
            element={token ? <Portfolio /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/ai"
            element={token ? <AI /> : <Navigate to="/login" replace />}
          />
          <Route path="/health" element={<Health />} />
          {/* Fallback: if unknown route, redirect depending on auth */}
          <Route
            path="*"
            element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
          />
        </Routes>
      </main>
      <ThemeToggle />
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  // Theme State
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <AuthProvider>
      <PortfolioProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PortfolioProvider>
    </AuthProvider>
  );
}

export default App;

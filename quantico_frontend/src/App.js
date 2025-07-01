import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, PortfolioProvider } from "./context";
import ThemeToggle from "./components/ThemeToggle";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
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
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={token ? <Navigate to="/dashboard"/> : <Login />} />
          <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/builder" element={token ? <Builder /> : <Navigate to="/login" />} />
          <Route path="/backtest" element={token ? <Backtest /> : <Navigate to="/login" />} />
          <Route path="/trading" element={token ? <Trading /> : <Navigate to="/login" />} />
          <Route path="/portfolio" element={token ? <Portfolio /> : <Navigate to="/login" />} />
          <Route path="/ai" element={token ? <AI /> : <Navigate to="/login" />} />
          <Route path="/health" element={<Health />} />
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

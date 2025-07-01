import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/builder", label: "Builder", icon: "🧩" },
  { to: "/backtest", label: "Backtest", icon: "📈" },
  { to: "/trading", label: "Trading", icon: "💹" },
  { to: "/portfolio", label: "Portfolio", icon: "💼" },
  { to: "/ai", label: "AI Assistant", icon: "🤖" },
  { to: "/health", label: "Health", icon: "❤️" }
];

export default function Sidebar() {
  const { logout } = useAuth();
  return (
    <aside className="sidebar">
      <div className="brand">Quantico</div>
      <nav>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className="nav-item">
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="logout" onClick={logout}>Logout</button>
    </aside>
  );
}

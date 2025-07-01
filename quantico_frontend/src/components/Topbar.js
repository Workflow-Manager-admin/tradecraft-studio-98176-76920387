import React from "react";
import { useAuth } from "../context";

export default function Topbar() {
  const { user } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar-title">Quantico {user ? "Workspace" : ""}</div>
      {user && (
        <div className="topbar-user">
          <span>{user.name || user.email}</span>
        </div>
      )}
    </header>
  );
}

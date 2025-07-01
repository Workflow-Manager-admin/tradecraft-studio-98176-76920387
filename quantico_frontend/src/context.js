import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext();
const PortfolioContext = createContext();

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const login = (tk, u) => {
    setToken(tk); setUser(u);
    localStorage.setItem("quantico_token", tk);
    localStorage.setItem("quantico_user", JSON.stringify(u));
  };
  const logout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem("quantico_token");
    localStorage.removeItem("quantico_user");
  };

  React.useEffect(() => {
    // Restore from storage
    const tk = localStorage.getItem("quantico_token");
    const u = localStorage.getItem("quantico_user");
    if (tk && u) { setToken(tk); setUser(JSON.parse(u)); }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function useAuth() {
  return useContext(AuthContext);
}

// PUBLIC_INTERFACE
export function PortfolioProvider({ children }) {
  const [portfolio, setPortfolio] = useState([]);
  return (
    <PortfolioContext.Provider value={{ portfolio, setPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function usePortfolio() {
  return useContext(PortfolioContext);
}

//
// Centralized configuration for Quantico Frontend
// Handles backend API URL and other environment-based options.
//

// PUBLIC_INTERFACE
export const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  "https://vscode-internal-287130-beta.beta01.cloud.kavia.ai:3001"; // matches running FastAPI backend

// Add other config values (e.g. feature toggles, analytics keys) here as needed

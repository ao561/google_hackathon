import { Routes, Route, Navigate } from "react-router-dom";
import UserPage from "./pages/UserPage.jsx";
import ResponderPage from "./pages/ResponderPage.jsx";
import "./App.css";

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="pulse" />
          <div>
            <h1>AI Crisis Triage Mapper</h1>
            <p className="tagline">
              Extract &amp; prioritize crisis events, visualized on a live globe.
            </p>
          </div>
        </div>
      </header>

      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/user" replace />} />
          <Route path="/user" element={<UserPage />} />
          <Route path="/responder" element={<ResponderPage />} />
          <Route path="*" element={<Navigate to="/user" replace />} />
        </Routes>
      </div>
    </div>
  );
}

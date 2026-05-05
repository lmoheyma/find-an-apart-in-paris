import { Routes, Route, NavLink } from "react-router-dom";
import Preferences from "./pages/Preferences.js";
import Templates from "./pages/Templates.js";
import Listings from "./pages/Listings.js";
import Stats from "./pages/Stats.js";
import Sessions from "./pages/Sessions.js";

function Layout({ children }: { children: React.ReactNode }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded ${isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`;

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow p-4 flex gap-2">
        <NavLink to="/" className={linkClass}>Annonces</NavLink>
        <NavLink to="/preferences" className={linkClass}>Preferences</NavLink>
        <NavLink to="/templates" className={linkClass}>Messages</NavLink>
        <NavLink to="/stats" className={linkClass}>Stats</NavLink>
        <NavLink to="/sessions" className={linkClass}>Sessions</NavLink>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Listings />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/sessions" element={<Sessions />} />
      </Routes>
    </Layout>
  );
}

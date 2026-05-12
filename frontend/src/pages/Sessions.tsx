import { useState, useEffect } from "react";
import { api, type Session } from "../api.js";

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    setSessions(await api.sessions.list());
  }

  async function handleLogin(platform: string) {
    setMessage(`Ouverture du navigateur pour ${platform}...`);
    try {
      const result = await api.sessions.login(platform);
      setMessage(result.message);
    } catch (error) {
      setMessage(`Erreur: ${error}`);
    }
  }

  const platforms = ["leboncoin", "seloger"];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Sessions</h1>

      {message && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4">{message}</div>}

      <div className="space-y-4">
        {platforms.map((platform) => {
          const session = sessions.find((s) => s.platform === platform);
          const status = session?.status || "non configure";
          const statusClass =
            status === "valid" ? "bg-green-100 text-green-700"
            : status === "captcha_required" ? "bg-orange-100 text-orange-700"
            : status === "needs_check" ? "bg-yellow-100 text-yellow-700"
            : status === "expired" ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-700";

          return (
            <div key={platform} className="bg-white p-4 rounded shadow flex items-center justify-between">
              <div>
                <span className="font-semibold capitalize">{platform}</span>
                <span className={`ml-3 px-2 py-0.5 rounded text-xs ${statusClass}`}>
                  {status === "captcha_required" ? "CAPTCHA à résoudre" : status === "needs_check" ? "À vérifier" : status}
                </span>
                {session?.last_valid_at && (
                  <span className="ml-2 text-sm text-gray-500">
                    Derniere validation: {new Date(session.last_valid_at).toLocaleString("fr")}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleLogin(platform)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Se connecter
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-yellow-50 p-4 rounded border border-yellow-200">
        <p className="text-sm text-yellow-800">
          Cliquer sur "Se connecter" ouvre un navigateur visible. Connectez-vous manuellement,
          puis fermez le navigateur. La session sera automatiquement persistee.
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { api, type Stats as StatsType } from "../api.js";

export default function Stats() {
  const [stats, setStats] = useState<StatsType | null>(null);

  useEffect(() => { api.stats().then(setStats); }, []);

  if (!stats) return <div>Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Statistiques</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totalListings}</div>
          <div className="text-sm text-gray-500">Annonces detectees</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-green-600">{stats.sentMessages}</div>
          <div className="text-sm text-gray-500">Messages envoyes</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.pendingMessages}</div>
          <div className="text-sm text-gray-500">En attente</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-red-600">{stats.failedMessages}</div>
          <div className="text-sm text-gray-500">Echoues</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Annonces / jour (30 derniers jours)</h2>
          <div className="space-y-1">
            {stats.listingsPerDay.slice(0, 14).map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-500">{d.day}</span>
                <div className="bg-blue-200 h-4 rounded" style={{ width: `${Math.min(100, d.count * 5)}%` }} />
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Messages / jour (30 derniers jours)</h2>
          <div className="space-y-1">
            {stats.messagesPerDay.slice(0, 14).map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-500">{d.day}</span>
                <div className="bg-green-200 h-4 rounded" style={{ width: `${Math.min(100, d.count * 10)}%` }} />
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

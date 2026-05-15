import { useState, useEffect } from "react";
import { api, type Listing } from "../api.js";

export default function Listings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [platform, setPlatform] = useState<string>("");
  const [sendStatus, setSendStatus] = useState("");
  const limit = 20;

  useEffect(() => { loadListings(); }, [page, platform]);

  async function loadListings() {
    const result = await api.listings.list({ limit, offset: page * limit, platform: platform || undefined });
    setListings(result.listings);
    setTotal(result.total);
  }

  async function handleSendRecent() {
    setSendStatus("Scraping en cours (peut prendre quelques minutes)...");
    try {
      const result = await api.listings.sendRecent(15);
      setSendStatus(`${result.scraped} nouvelles annonces scrapées, ${result.queued} messages en queue pour ${result.listings} annonces`);
      loadListings(); // refresh list
    } catch (e) {
      setSendStatus(`Erreur: ${e}`);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Annonces ({total})</h1>
        <div className="flex gap-2 items-center">
          <button onClick={handleSendRecent} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Scraper + Envoyer (15 jours)
          </button>
          <select className="border p-2 rounded" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(0); }}>
            <option value="">Toutes</option>
            <option value="leboncoin">LeBonCoin</option>
            <option value="seloger">SeLoger</option>
          </select>
        </div>
      </div>

      {sendStatus && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4">{sendStatus}</div>}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Titre</th>
              <th className="p-3 text-left">Prix</th>
              <th className="p-3 text-left">Surface</th>
              <th className="p-3 text-left">Ville</th>
              <th className="p-3 text-left">Plateforme</th>
              <th className="p-3 text-left">Message</th>
              <th className="p-3 text-left">Envoyé le</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Lien</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">{l.title}</td>
                <td className="p-3">{l.price ? `${l.price}€` : "—"}</td>
                <td className="p-3">{l.surface ? `${l.surface}m2` : "—"}</td>
                <td className="p-3">{l.city || "—"}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${l.platform === "leboncoin" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>{l.platform}</span></td>
                <td className="p-3">
                  {l.message_status === "sent" && <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Envoyé</span>}
                  {l.message_status === "pending" && <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">En attente</span>}
                  {l.message_status === "failed" && <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Erreur</span>}
                  {!l.message_status && <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">—</span>}
                </td>
                <td className="p-3 text-gray-500 text-xs">
                  {l.message_sent_at ? new Date(l.message_sent_at).toLocaleString("fr", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </td>
                <td className="p-3 text-gray-500">{new Date(l.discovered_at).toLocaleDateString("fr")}</td>
                <td className="p-3"><a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Voir</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 border rounded disabled:opacity-50">Precedent</button>
          <span className="px-3 py-1">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 border rounded disabled:opacity-50">Suivant</button>
        </div>
      )}
    </div>
  );
}

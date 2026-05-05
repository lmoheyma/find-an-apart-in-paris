import { useState, useEffect } from "react";
import { api, type Listing } from "../api.js";

export default function Listings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [platform, setPlatform] = useState<string>("");
  const limit = 20;

  useEffect(() => { loadListings(); }, [page, platform]);

  async function loadListings() {
    const result = await api.listings.list({ limit, offset: page * limit, platform: platform || undefined });
    setListings(result.listings);
    setTotal(result.total);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Annonces ({total})</h1>
        <select className="border p-2 rounded" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(0); }}>
          <option value="">Toutes</option>
          <option value="leboncoin">LeBonCoin</option>
          <option value="seloger">SeLoger</option>
        </select>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Titre</th>
              <th className="p-3 text-left">Prix</th>
              <th className="p-3 text-left">Surface</th>
              <th className="p-3 text-left">Ville</th>
              <th className="p-3 text-left">Plateforme</th>
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

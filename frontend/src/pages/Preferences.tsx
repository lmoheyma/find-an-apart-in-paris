import { useState, useEffect } from "react";
import { api, type Preference } from "../api.js";

export default function Preferences() {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [form, setForm] = useState({ name: "", leboncoin_location: "", seloger_location: "", budget_min: "", budget_max: "", surface_min: "", rooms_min: "", rooms_max: "" });
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => { loadPrefs(); }, []);

  async function loadPrefs() {
    setPrefs(await api.preferences.list());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      leboncoin_location: form.leboncoin_location,
      seloger_location: form.seloger_location,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      surface_min: form.surface_min ? Number(form.surface_min) : null,
      rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
      rooms_max: form.rooms_max ? Number(form.rooms_max) : null,
    };
    if (editing) {
      await api.preferences.update(editing, data);
      setEditing(null);
    } else {
      await api.preferences.create(data);
    }
    setForm({ name: "", leboncoin_location: "", seloger_location: "", budget_min: "", budget_max: "", surface_min: "", rooms_min: "", rooms_max: "" });
    loadPrefs();
  }

  async function toggleActive(pref: Preference) {
    await api.preferences.update(pref.id, { active: pref.active ? 0 : 1 });
    loadPrefs();
  }

  async function handleDelete(id: number) {
    await api.preferences.delete(id);
    loadPrefs();
  }

  function startEdit(pref: Preference) {
    setEditing(pref.id);
    setForm({
      name: pref.name,
      leboncoin_location: pref.leboncoin_location || "",
      seloger_location: pref.seloger_location || "",
      budget_min: pref.budget_min?.toString() || "",
      budget_max: pref.budget_max?.toString() || "",
      surface_min: pref.surface_min?.toString() || "",
      rooms_min: pref.rooms_min?.toString() || "",
      rooms_max: pref.rooms_max?.toString() || "",
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Preferences de recherche</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 grid grid-cols-2 gap-3">
        <input className="border p-2 rounded col-span-2" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="LeBonCoin location (ex: Paris)" value={form.leboncoin_location} onChange={(e) => setForm({ ...form, leboncoin_location: e.target.value })} />
        <input className="border p-2 rounded" placeholder="SeLoger location (ex: AD08FR31096)" value={form.seloger_location} onChange={(e) => setForm({ ...form, seloger_location: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Budget min" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Budget max" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Surface min (m2)" value={form.surface_min} onChange={(e) => setForm({ ...form, surface_min: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Chambres min" value={form.rooms_min} onChange={(e) => setForm({ ...form, rooms_min: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Chambres max" value={form.rooms_max} onChange={(e) => setForm({ ...form, rooms_max: e.target.value })} />
        <button type="submit" className="col-span-2 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          {editing ? "Modifier" : "Ajouter"}
        </button>
      </form>

      <div className="space-y-3">
        {prefs.map((pref) => (
          <div key={pref.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
            <div>
              <span className="font-semibold">{pref.name}</span> — LBC: {pref.leboncoin_location || "—"} | SL: {pref.seloger_location || "—"}
              <span className="text-sm text-gray-500 ml-2">
                {pref.budget_min}-{pref.budget_max}€ | {pref.surface_min}m2 | {pref.rooms_min}-{pref.rooms_max} ch.
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleActive(pref)} className={`px-3 py-1 rounded text-sm ${pref.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {pref.active ? "Actif" : "Inactif"}
              </button>
              <button onClick={() => startEdit(pref)} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">Modifier</button>
              <button onClick={() => handleDelete(pref.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

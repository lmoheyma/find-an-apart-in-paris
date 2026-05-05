import { useState, useEffect } from "react";
import { api, type Template } from "../api.js";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ name: "", body: "", is_default: false });
  const [editing, setEditing] = useState<number | null>(null);
  const [preview, setPreview] = useState("");

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setTemplates(await api.templates.list());
  }

  function updatePreview(body: string) {
    const vars: Record<string, string> = {
      "{{title}}": "Studio lumineux Paris 11",
      "{{price}}": "950",
      "{{city}}": "Paris 11",
      "{{surface}}": "28",
      "{{rooms}}": "1",
      "{{url}}": "https://leboncoin.fr/exemple",
    };
    let result = body;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replaceAll(key, val);
    }
    setPreview(result);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await api.templates.update(editing, { name: form.name, body: form.body, is_default: form.is_default ? 1 : 0 });
      setEditing(null);
    } else {
      await api.templates.create({ name: form.name, body: form.body, is_default: form.is_default ? 1 : 0 });
    }
    setForm({ name: "", body: "", is_default: false });
    setPreview("");
    loadTemplates();
  }

  async function handleDelete(id: number) {
    await api.templates.delete(id);
    loadTemplates();
  }

  function startEdit(t: Template) {
    setEditing(t.id);
    setForm({ name: t.name, body: t.body, is_default: !!t.is_default });
    updatePreview(t.body);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Templates de message</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 space-y-3">
        <input className="border p-2 rounded w-full" placeholder="Nom du template" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <textarea
          className="border p-2 rounded w-full h-32"
          placeholder="Message... Utilisez {{title}}, {{price}}, {{city}}, {{surface}}, {{rooms}}, {{url}}"
          value={form.body}
          onChange={(e) => { setForm({ ...form, body: e.target.value }); updatePreview(e.target.value); }}
          required
        />
        {preview && (
          <div className="bg-gray-50 p-3 rounded border text-sm">
            <span className="font-semibold text-gray-500">Apercu :</span><br />{preview}
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Template par defaut
        </label>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 w-full">
          {editing ? "Modifier" : "Ajouter"}
        </button>
      </form>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">{t.name} {t.is_default ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">defaut</span> : ""}</span>
              <div className="flex gap-2">
                <button onClick={() => startEdit(t)} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">Modifier</button>
                <button onClick={() => handleDelete(t.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Supprimer</button>
              </div>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

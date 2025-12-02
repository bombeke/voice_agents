import { useState } from "react";

// PoleVision™ High-Fidelity Mockup (React + Tailwind)
// Default export a React component that renders a complete dashboard mockup.
// Notes: This file is intended as a single-file prototype. TailwindCSS must be enabled
// in the host project. It uses plain React and Tailwind; you may replace UI pieces
// with shadcn/ui components if desired.

const KPI = ({ title, value, delta, children }: any) => (
  <div className="bg-white shadow-md rounded-2xl p-4 flex flex-col">
    <div className="flex justify-between items-start">
      <div>
        <div className="text-sm text-slate-500">{title}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </div>
      <div className="text-sm text-slate-400">{delta}</div>
    </div>
    <div className="mt-3 text-xs text-slate-500">{children}</div>
  </div>
);

const MapPlaceholder = ({ children=null }: any) => (
  <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl h-96 flex items-center justify-center">
    <div className="text-slate-400">Interactive Map Canvas (placeholder)</div>
    {children}
  </div>
);

const DataTable = ({ rows, onSelect }: any) => (
  <div className="bg-white shadow rounded-2xl overflow-hidden">
    <table className="min-w-full divide-y divide-slate-100">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">ID</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Type</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Owner</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Condition</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Risk</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Location</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {rows.map((r: any) => (
          <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(r)}>
            <td className="px-4 py-3 text-sm text-slate-600">{r.id}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.type}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.owner}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.condition}</td>
            <td className={`px-4 py-3 text-sm font-semibold ${r.risk === 'High' ? 'text-rose-600' : r.risk === 'Med' ? 'text-amber-600' : 'text-emerald-600'}`}>{r.risk}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.location}</td>
            <td className="px-4 py-3 text-right text-sm">
              <button className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700">View</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PoleDetailModal = ({ pole, onClose }: any) => {
  if (!pole) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-11/12 md:w-3/4 lg:w-1/2 shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-slate-500">Pole Detail</div>
              <div className="text-xl font-semibold">{pole.id} — {pole.type}</div>
              <div className="text-sm text-slate-400">{pole.location} • Owner: {pole.owner}</div>
            </div>
            <div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">Close ✕</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="h-48 bg-[url('https://images.unsplash.com/photo-1563306408-0e5b96a4f9fb?auto=format&fit=crop&w=800&q=60')] bg-cover bg-center rounded-lg" />
              <div className="mt-3 text-sm text-slate-500">AI Annotations</div>
              <ul className="mt-2 text-sm text-slate-600 list-disc list-inside">
                <li>Lean Angle: {pole.analysis.lean}°</li>
                <li>Wood Rot: {pole.analysis.woodRot ? 'Detected' : 'None'}</li>
                <li>Vegetation Proximity: {pole.analysis.veg}m</li>
                <li>Wildlife Flag: {pole.analysis.wildlife ? 'Yes' : 'No'}</li>
              </ul>
            </div>

            <div className="p-3">
              <div className="text-sm text-slate-500">Recommended Actions</div>
              <div className="mt-3 space-y-2">
                <div className="p-3 bg-amber-50 rounded-lg">Schedule Inspection — Priority: <strong>{pole.risk}</strong></div>
                <div className="p-3 bg-rose-50 rounded-lg">Flag for Replacement if lean > 12°</div>
                <div className="p-3 bg-sky-50 rounded-lg">Environmental Notice: Avoid maintenance during nesting season</div>
              </div>

              <div className="mt-4">
                <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white mr-2">Schedule Team</button>
                <button className="px-4 py-2 rounded-lg bg-slate-100">Export Report</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default function PoleVisionMockup() {
  const [selected, setSelected] = useState(null);

  const rows = [
    { id: 'P-00933', type: 'Power', owner: 'UMEME', condition: 'Leaning', risk: 'High', location: 'Kampala - KLA-24A', analysis: { lean: 11, woodRot: true, veg: 1.2, wildlife: true } },
    { id: 'T-22188', type: 'Telecom', owner: 'ISP A', condition: 'OK', risk: 'Med', location: 'Kampala - KLA-55C', analysis: { lean: 2, woodRot: false, veg: 3.4, wildlife: false } },
    { id: 'T-22190', type: 'Telecom', owner: 'ISP B', condition: 'Clutter', risk: 'High', location: 'Kampala - KLA-55D', analysis: { lean: 4, woodRot: false, veg: 0.6, wildlife: false } },
    { id: 'S-99423', type: 'StreetLight', owner: 'KCCA', condition: 'OK', risk: 'Low', location: 'Kampala - KLA-11Z', analysis: { lean: 0, woodRot: false, veg: 4.0, wildlife: false } },
  ];

  const kpis = [
    { title: 'Total Poles', value: '2,435,991', delta: '+2.1% MoM', note: 'All registered infrastructure' },
    { title: 'High-Risk Poles', value: '139,442', delta: '-1.3% MoM', note: 'Flagged for immediate action' },
    { title: 'Telecom Clutter Zones', value: '1,933', delta: '+7% MoM', note: 'High redundancy areas' },
    { title: 'Wildlife-sensitive Zones', value: '388', delta: '—', note: 'Environmental overlays' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="max-w-7xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">PoleVision™ Dashboard</div>
          <p className="text-sm text-slate-500">Unified pole monitoring for power, telecom & environment</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-2 rounded-lg bg-white shadow text-sm">New Scan</button>
          <img src="https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=64&q=60" alt="avatar" className="w-10 h-10 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <KPI key={k.title} title={k.title} value={k.value} delta={k.delta}>{k.note}</KPI>
            ))}
          </div>

          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">City Overview</div>
              <div className="flex gap-2 items-center">
                <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option>Kampala</option>
                  <option>Nairobi</option>
                  <option>Lagos</option>
                </select>
                <button className="px-3 py-2 rounded-lg bg-slate-100">Filters</button>
              </div>
            </div>

            <MapPlaceholder />

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-sky-50 rounded-lg">Hotspots: Jinja Rd, Ntinda, Bukoto</div>
              <div className="p-3 bg-rose-50 rounded-lg">Critical: 112 poles need urgent inspection</div>
              <div className="p-3 bg-emerald-50 rounded-lg">Environmental: 38 nesting zones nearby</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="text-lg font-semibold">Pole Registry</div>
              <div className="text-sm text-slate-500">Tap a row to open detail</div>
            </div>
            <DataTable rows={rows} onSelect={(r: any) => setSelected(r)} />
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="text-md font-semibold mb-2">Telecom Clutter</div>
            <div className="text-sm text-slate-500 mb-3">Top clusters & recommendations</div>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-orange-50">Cluster C-0081 • Poles: 12 • Recommendation: Consolidate 8</div>
              <div className="p-3 rounded-lg bg-orange-50">Cluster C-0143 • Poles: 7 • Recommendation: Consolidate 3</div>
              <div className="mt-3">
                <button className="w-full px-4 py-2 rounded-lg bg-amber-600 text-white">Run Clutter Audit</button>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="text-md font-semibold mb-2">Environment & Birds</div>
            <div className="text-sm text-slate-500 mb-3">Nesting zones & migration windows</div>
            <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
              <li>142 poles with active nests</li>
              <li>Migration peak: May–July</li>
              <li>Recommended: Schedule work outside nesting windows</li>
            </ul>
            <div className="mt-3">
              <button className="w-full px-4 py-2 rounded-lg bg-sky-600 text-white">Export Environmental Report</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="text-md font-semibold mb-2">Maintenance Queue</div>
            <div className="text-sm text-slate-500 mb-3">Active & upcoming tasks</div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="p-2 rounded-lg bg-slate-50">P-00933 • Leaning • Priority: High</div>
              <div className="p-2 rounded-lg bg-slate-50">T-22190 • Clutter consolidation • Priority: Med</div>
              <div className="p-2 rounded-lg bg-slate-50">P-11221 • Rot • Priority: High</div>
            </div>
          </div>
        </aside>
      </main>

      <PoleDetailModal pole={selected} onClose={() => setSelected(null)} />

      <footer className="max-w-7xl mx-auto mt-10 text-center text-xs text-slate-400">PoleVision™ • Prototype UI • For demo purposes</footer>
    </div>
  );
}

// -------------------------
// Figma / Design Handoff Notes
// -------------------------
// Frames to create in Figma:
// 1) Dashboard Overview (1440x1024) – Map, KPI cards, Territory filters
// 2) Pole Registry Table (1440x800) – Table rows, row hover state, modals
// 3) Pole Detail Modal (900x700) – Image area, AI annotation list, actions
// 4) Clutter Cluster Panel (720x500) – Cluster card, recommendations
// 5) Environment Module (720x600) – Heatmaps, seasonal guidance
// 
// Assets & tokens:
// - Color tokens: slate-50, slate-100, sky-600, amber-600, rose-600, emerald-600
// - Icon set: lucide / heroicons (map-pin, alert-circle, bird, tree, layers)
// - Images: drone photos, street imagery (use Unsplash placeholders)
// - Fonts: Inter (system fallback)
// 
// Export guidance:
// - Provide components as variants: KPI-card, data-table-row, modal, button.
// - Supply spacing tokens (8, 12, 16, 24), border radius: 12px / 16px for cards.
// - Include sample JSON data for each component in the Figma file's description to help developers wire data bindings.

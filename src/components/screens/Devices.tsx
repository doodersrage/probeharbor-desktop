import { useEffect, useState } from "preact/hooks";
import {
  aggregateDevices,
  fetchHomeReadings,
  renameDevice,
  setDeviceSpace,
} from "../../lib/api";
import type { DeviceSummary } from "../../lib/types";

export function DevicesScreen() {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [space, setSpace] = useState("");

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const readings = await fetchHomeReadings();
      setDevices(aggregateDevices(readings.sensors ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div class="loading">Loading devices…</div>;

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      {msg && <div class="success-banner">{msg}</div>}
      <div class="card">
        <div class="card-title">Devices</div>
        <p class="card-sub">Aggregated from live sensors. Rename and set space like Android.</p>
        {devices.length === 0 ? (
          <div class="empty">No devices yet.</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Space</th>
                <th>Sensors</th>
                <th>Kinds</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.space ?? "—"}</td>
                  <td>{d.sensorCount}</td>
                  <td>{d.kinds.join(", ")}</td>
                  <td>
                    <button
                      class="btn btn-ghost"
                      onClick={() => {
                        setEditId(d.id);
                        setName(d.name);
                        setSpace(d.space ?? "");
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editId && (
        <div class="card stack">
          <div class="card-title">Edit device</div>
          <div class="row">
            <div class="field">
              <label>Name</label>
              <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label>Space</label>
              <input value={space} onInput={(e) => setSpace((e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <div class="row">
            <button
              class="btn btn-primary"
              onClick={async () => {
                setMsg(null);
                setError(null);
                try {
                  await renameDevice(editId, name);
                  await setDeviceSpace(editId, space);
                  setMsg("Device updated");
                  setEditId(null);
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Save
            </button>
            <button class="btn btn-ghost" onClick={() => setEditId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

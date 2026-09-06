import { useEffect, useState } from "preact/hooks";
import {
  createShareLink,
  fetchShareLinks,
  openExternal,
  revokeShareLink,
} from "../../lib/api";
import type { ShareLinkDto } from "../../lib/types";

interface Props {
  canShare: boolean;
}

export function ShareScreen({ canShare }: Props) {
  const [links, setLinks] = useState<ShareLinkDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Family");
  const [scope, setScope] = useState("live");
  const [days, setDays] = useState(30);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchShareLinks();
      setLinks(res.links ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (!canShare) {
    return (
      <div class="card">
        <div class="card-title">Share links (Pro)</div>
        <p class="card-sub">
          Guest and family share links require Pro. Manage billing on the web.
        </p>
        <button
          class="btn btn-primary"
          onClick={() => void openExternal("https://thermaltrace.dev/dashboard/plans")}
        >
          Open plans
        </button>
      </div>
    );
  }

  if (loading) return <div class="loading">Loading share links…</div>;

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      {msg && <div class="success-banner">{msg}</div>}

      <div class="card stack">
        <div class="card-title">Create link</div>
        <div class="row">
          <div class="field">
            <label>Label</label>
            <input value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope((e.target as HTMLSelectElement).value)}
            >
              <option value="live">Live</option>
              <option value="history">History</option>
            </select>
          </div>
          <div class="field">
            <label>Expires (days)</label>
            <input
              type="number"
              value={days}
              onInput={(e) => setDays(Number((e.target as HTMLInputElement).value))}
            />
          </div>
          <button
            class="btn btn-primary"
            onClick={async () => {
              setMsg(null);
              try {
                const token = await createShareLink(label, scope, days);
                setMsg(
                  token
                    ? `Created — https://thermaltrace.dev/share/${token}`
                    : "Share link created",
                );
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Create
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Existing links</div>
        {links.length === 0 ? (
          <div class="empty">No share links yet.</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Scope</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>{l.label ?? "—"}</td>
                  <td>{l.scope}</td>
                  <td>{l.expires_at ?? "—"}</td>
                  <td class="row">
                    <button
                      class="btn btn-ghost"
                      onClick={() =>
                        void openExternal(`https://thermaltrace.dev/share/${l.token}`)
                      }
                    >
                      Open
                    </button>
                    <button
                      class="btn btn-ghost"
                      onClick={async () => {
                        try {
                          await revokeShareLink(l.id);
                          setMsg("Revoked");
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

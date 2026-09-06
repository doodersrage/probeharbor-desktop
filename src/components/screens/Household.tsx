import { useEffect, useState } from "preact/hooks";
import {
  fetchHousehold,
  inviteMember,
  renameHousehold,
  switchHousehold,
} from "../../lib/api";
import type { HouseholdResponse } from "../../lib/types";

export function HouseholdScreen() {
  const [data, setData] = useState<HouseholdResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const h = await fetchHousehold();
      setData(h);
      const current = h.households?.find((x) => x.household_id === h.householdId);
      setName(current?.name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div class="loading">Loading household…</div>;

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      {msg && <div class="success-banner">{msg}</div>}

      <div class="card stack">
        <div class="card-title">Current household</div>
        <div class="row">
          <div class="field">
            <label>Name</label>
            <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </div>
          <button
            class="btn btn-primary"
            onClick={async () => {
              try {
                await renameHousehold(name);
                setMsg("Household renamed");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Rename
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Members</div>
        <table class="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {(data?.members ?? []).map((m) => (
              <tr key={m.id ?? m.user_id ?? m.email}>
                <td>{m.email ?? m.user_id ?? "—"}</td>
                <td>{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="card stack">
        <div class="card-title">Invite</div>
        <div class="row">
          <div class="field">
            <label>Email</label>
            <input
              value={inviteEmail}
              onInput={(e) => setInviteEmail((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="field">
            <label>Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole((e.target as HTMLSelectElement).value)}
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <button
            class="btn btn-primary"
            onClick={async () => {
              try {
                await inviteMember(inviteEmail, inviteRole);
                setMsg("Invite sent");
                setInviteEmail("");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Invite
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Switch household</div>
        <div class="stack">
          {(data?.households ?? []).map((h) => (
            <div class="row" key={h.household_id}>
              <span>
                {h.name || h.household_id}{" "}
                <span class="badge">{h.role}</span>
                {h.household_id === data?.householdId && (
                  <span class="badge ok">current</span>
                )}
              </span>
              {h.household_id !== data?.householdId && (
                <button
                  class="btn btn-ghost"
                  onClick={async () => {
                    try {
                      await switchHousehold(h.household_id);
                      setMsg("Switched household");
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Switch
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api, authClient, initializeApi, type AppConfig } from "../lib/api";
import type { OAuthAuthorizationDetails, Session } from "@supabase/supabase-js";

interface Grant {
  client_id: string;
  can_read: boolean;
  can_edit: boolean;
  can_submit: boolean;
  revoked_at: string | null;
}
export function McpAccount() {
  const authorizationId = new URLSearchParams(location.search).get(
    "authorization_id",
  );
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false);
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(
    null,
  );
  const [grants, setGrants] = useState<Grant[]>([]);
  const [edit, setEdit] = useState(true),
    [submit, setSubmit] = useState(false);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const fail = (e: unknown) =>
    setMessage(e instanceof Error ? e.message : "The request failed.");
  useEffect(() => {
    let alive = true,
      unsubscribe: (() => void) | undefined;
    void initializeApi()
      .then(async (cfg) => {
        if (!alive) return;
        if (cfg.apiOrigin && location.origin !== cfg.apiOrigin) {
          location.replace(
            `${cfg.apiOrigin}${location.pathname}${location.search}`,
          );
          return;
        }
        setConfig(cfg);
        const auth = authClient();
        if (auth) {
          const result = await auth.auth.getSession();
          if (alive) setSession(result.data.session);
          const { data } = auth.auth.onAuthStateChange((_, s) => setSession(s));
          unsubscribe = () => data.subscription.unsubscribe();
        }
      })
      .catch(fail);
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    if (authorizationId) {
      void authClient()!
        .auth.oauth.getAuthorizationDetails(authorizationId)
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) throw error;
          if (data && "authorization_id" in data) setDetails(data);
          else if (data?.redirect_url) location.assign(data.redirect_url);
        })
        .catch(fail);
    } else
      void api<Grant[]>("/mcp/connections")
        .then((data) => {
          if (alive) setGrants(data);
        })
        .catch(fail);
    return () => {
      alive = false;
    };
  }, [session, authorizationId]);
  async function consent(approved: boolean) {
    if (!authorizationId) return;
    setBusy(true);
    setMessage("");
    try {
      if (approved) {
        await api("/mcp/connections", {
          method: "PUT",
          body: JSON.stringify({
            authorizationId,
            canRead: true,
            canEdit: edit,
            canSubmit: submit,
          }),
        });
        const { error } =
          await authClient()!.auth.oauth.approveAuthorization(authorizationId);
        if (error) throw error;
      } else {
        const { error } =
          await authClient()!.auth.oauth.denyAuthorization(authorizationId);
        if (error) throw error;
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mcp-account">
      <a href={config?.apiOrigin || "/"}>
        <img
          src="/logo.png"
          width="44"
          height="44"
          alt="Game Economist Consulting shipyard"
        />
      </a>
      <h1>{authorizationId ? "Connect to Economy Flow" : "MCP connections"}</h1>
      {config && !config.cloud ? (
        <p>
          Account connections are not activated yet. The public editor remains
          available.
        </p>
      ) : !session ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const auth = authClient();
              if (!auth) throw new Error("Accounts unavailable.");
              const { error } = sent
                ? await auth.auth.verifyOtp({
                    email,
                    token: code,
                    type: "email",
                  })
                : await auth.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: location.href },
                  });
              if (error) throw error;
              setSent(true);
              if (!sent)
                setMessage("Check your email for the sign-in link or code.");
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Sign in to choose what this connection can access.</p>
          <label>
            Email{" "}
            <input
              aria-label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {sent && (
            <label>
              Sign-in code{" "}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
              />
            </label>
          )}
          <button className="button primary" disabled={!config || busy}>
            {sent ? "Verify code" : "Email sign-in link"}
          </button>
        </form>
      ) : authorizationId ? (
        <>
          <p>
            {details?.client.name || "This client"} requests access to your
            Economy Flow account.
          </p>
          {details && <p>Identity access: {details.scope || "openid"}</p>}
          <label>
            <input type="checkbox" checked readOnly /> Read your diagrams and
            public presets
          </label>
          <label>
            <input
              type="checkbox"
              checked={edit}
              onChange={(e) => setEdit(e.target.checked)}
            />{" "}
            Create and edit your diagrams
          </label>
          <label>
            <input
              type="checkbox"
              checked={submit}
              onChange={(e) => setSubmit(e.target.checked)}
            />{" "}
            Submit public preset pull requests to GitHub
          </label>
          <p>
            New saved diagrams default to public. Existing private diagrams stay
            private. You can revoke this connection at any time.
          </p>
          <div className="modal-actions">
            <button
              className="button"
              disabled={busy || !details}
              onClick={() => void consent(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || !details}
              onClick={() => void consent(true)}
            >
              Connect
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Use this server URL in your MCP client:</p>
          <code>{config?.mcpUrl}</code>
          {!grants.length && <p>No connected clients yet.</p>}
          {grants.map((grant) => (
            <article key={grant.client_id}>
              <strong>{grant.client_id}</strong>
              <p>
                {grant.revoked_at
                  ? "Revoked"
                  : `Read${grant.can_edit ? " · Edit" : ""}${grant.can_submit ? " · GitHub submissions" : ""}`}
              </p>
              {!grant.revoked_at && (
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await api("/mcp/connections", {
                        method: "DELETE",
                        body: JSON.stringify({ clientId: grant.client_id }),
                      });
                      setGrants((g) =>
                        g.map((item) =>
                          item.client_id === grant.client_id
                            ? { ...item, revoked_at: new Date().toISOString() }
                            : item,
                        ),
                      );
                    } catch (e) {
                      fail(e);
                    }
                  }}
                >
                  Revoke access
                </button>
              )}
            </article>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
      <p>
        <a href={config?.apiOrigin || "/"}>Return to editor</a>
      </p>
    </main>
  );
}

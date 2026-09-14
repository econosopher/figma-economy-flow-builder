import { exportEvidencePackage } from "../lib/evidenceMedia";
import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  Link,
  Globe,
  Send,
  Plus,
  ExternalLink,
  Trash2,
  Check,
} from "lucide-react";
import { Modal } from "./Modal";
import type { EconomyDocument } from "../core/document";
import type { Layout } from "../core/layout";
import { checkReleaseReadiness } from "../core/conventions";
import { api, type AppConfig } from "../lib/api";
import {
  backupFilename,
  copyPng,
  download,
  draftBackupBlob,
  filename,
  pngBlob,
  svgBlob,
} from "../lib/export";
interface Installation {
  id: string;
  team_name: string;
  bot_name: string;
}
export function ShareDialog({
  document: d,
  layout,
  selection,
  config,
  signedIn,
  onClose,
  onSignIn,
  notify,
}: {
  document: EconomyDocument;
  layout: Layout;
  selection: string[];
  config: AppConfig;
  signedIn: boolean;
  onClose: () => void;
  onSignIn: () => void;
  notify: (s: string) => void;
}) {
  const readiness = checkReleaseReadiness(d);
  const [tab, setTab] = useState("export"),
    [blob, setBlob] = useState<Blob | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [installations, setInstallations] = useState<Installation[]>([]),
    [install, setInstall] = useState(""),
    [channels, setChannels] = useState<{ id: string; name: string }[]>([]),
    [channel, setChannel] = useState(""),
    [cursor, setCursor] = useState("");
  const [message, setMessage] = useState(""),
    [thread, setThread] = useState(""),
    [sendState, setSendState] = useState(""),
    [operation, setOperation] = useState(crypto.randomUUID());
  const [url, setUrl] = useState(""),
    [shares, setShares] = useState<
      { id: string; created_at: string; document_id: string }[]
    >([]),
    [published, setPublished] = useState<
      { id: string; title: string; document_id: string }[]
    >([]);
  const [title, setTitle] = useState(d.name),
    [author, setAuthor] = useState(""),
    [description, setDescription] = useState(""),
    [publishConfirmed, setPublishConfirmed] = useState(false);
  useEffect(() => {
    let active = true,
      localUrl = "";
    setBlob(null);
    setPreview("");
    setError("");
    if (!readiness.ready) return;
    pngBlob(d, layout)
      .then((b) => {
        if (active) {
          setBlob(b);
          localUrl = URL.createObjectURL(b);
          setPreview(localUrl);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [d, layout, readiness.ready]);
  useEffect(() => {
    if (!signedIn) return;
    api<Installation[]>("/slack/installations")
      .then(setInstallations)
      .catch(() => {});
    api<typeof shares>("/shares")
      .then(setShares)
      .catch(() => {});
    api<typeof published>("/publications")
      .then(setPublished)
      .catch(() => {});
  }, [signedIn]);
  useEffect(() => {
    setChannel("");
    setChannels([]);
    setCursor("");
    if (install)
      api<{ channels: typeof channels; cursor: string }>(
        `/slack/installations/${install}/channels`,
      )
        .then((r) => {
          setChannels(r.channels);
          setCursor(r.cursor);
        })
        .catch((e) => setError(e.message));
  }, [install]);
  useEffect(() => {
    setOperation(crypto.randomUUID());
    setSendState("");
  }, [message, thread, channel, install]);
  useEffect(() => {
    if (!["queued", "uploading", "completing"].includes(sendState)) return;
    const timer = setInterval(() => {
      void api<{ status: string }>(`/slack/uploads/${operation}`)
        .then((result) => setSendState(result.status))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [sendState, operation]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  const accountGate = !signedIn ? (
    <div className="account-gate">
      <h3>Keep your economy connected.</h3>
      <p>
        {config.cloud
          ? "Sign in to share links, publish diagrams, or connect your Slack workspace."
          : "Cloud accounts are being configured. PNG, SVG, and JSON exports are available now."}
      </p>
      <button
        className="button primary"
        disabled={!config.cloud}
        onClick={onSignIn}
      >
        Sign in
      </button>
    </div>
  ) : null;
  const releaseGate = !readiness.ready ? (
    <div className="release-gate">
      <h3>Draft blocked from release</h3>
      <p>
        Keep editing and saving this draft. Sharing, publication, Slack sending,
        and final image exports unlock when every convention fix is complete.
      </p>
      <ul>
        {readiness.violations.map((violation) => (
          <li
            key={`${violation.code}:${violation.cardId || violation.edgeId || violation.message}`}
          >
            {violation.message}
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  return (
    <Modal
      title="Share your economy"
      description="A clear picture, wherever the conversation happens."
      onClose={onClose}
      wide
    >
      <div className="tabs">
        {[
          ["export", "Export"],
          ["link", "View link"],
          ["slack", "Slack"],
          ["publish", "Publish"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="share-layout">
        <div className="share-preview">
          {preview ? (
            <img src={preview} alt="Exact PNG sharing preview" />
          ) : !readiness.ready ? (
            <span>Draft preview · final export locked</span>
          ) : (
            <span>Preparing preview…</span>
          )}
          <div>
            {d.name}
            <span>{d.cards.length} cards · PNG at 2×</span>
          </div>
        </div>
        <div className="share-options">
          {tab === "export" ? (
            <>
              <h3>
                {readiness.ready
                  ? "Ready for the conversation."
                  : "Draft backup and recovery"}
              </h3>
              <p className="helper">
                {readiness.ready
                  ? "Export the full diagram, including its groups, notes, and resource key."
                  : "Final PNG, SVG, and clipboard exports are locked. Download an editable backup to keep working elsewhere."}
              </p>
              {!readiness.ready && releaseGate}
              <button
                className="button primary full"
                disabled={!blob || !readiness.ready}
                onClick={() => blob && download(blob, filename(d.name, "png"))}
              >
                <Download size={16} />
                Download PNG
              </button>
              <button
                className="button full"
                disabled={!readiness.ready}
                onClick={() =>
                  run(async () => {
                    await copyPng(d, layout);
                    notify("PNG copied to clipboard.");
                  })
                }
              >
                <Copy size={15} />
                Copy image
              </button>
              {selection.length > 0 && (
                <button
                  className="button full"
                  disabled={!readiness.ready}
                  onClick={() =>
                    run(async () =>
                      download(
                        await pngBlob(d, layout, selection),
                        filename(`${d.name} selection`, "png"),
                      ),
                    )
                  }
                >
                  Export {selection.length} selected{" "}
                  {selection.length === 1 ? "card" : "cards"}
                </button>
              )}
              <div className="divider" />
              <button
                className="text-button"
                disabled={!readiness.ready}
                onClick={() =>
                  run(async () =>
                    download(await svgBlob(d, layout), filename(d.name, "svg")),
                  )
                }
              >
                Download SVG
              </button>
              <button
                className="text-button"
                onClick={() =>
                  download(
                    draftBackupBlob(d),
                    backupFilename(d.name, "json", readiness.ready),
                  )
                }
              >
                Download editable {readiness.ready ? "JSON" : "draft JSON"}
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    download(
                      await exportEvidencePackage(d),
                      `${backupFilename(d.name, "flowpack", readiness.ready)}.json`,
                    );
                  })
                }
              >
                <Download size={15} /> Download{" "}
                {readiness.ready
                  ? "with screenshots"
                  : "draft with screenshots"}
              </button>
              {!!d.evidence?.items.some((i) => i.mediaId) && (
                <p className="helper">
                  Editable JSON and shared snapshots contain references only.
                  Screenshot attachments stay in this browser; use Download with
                  screenshots to transfer them.
                </p>
              )}
            </>
          ) : (
            releaseGate ||
            accountGate || (
              <>
                {tab === "link" && (
                  <>
                    <h3>Share a read-only snapshot.</h3>
                    <p className="helper">
                      Your private edits stay private. This link shows the
                      version in the preview.
                    </p>
                    <button
                      className="button primary full"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const result = await api<{ url: string; id: string }>(
                            "/shares",
                            { method: "POST", body: JSON.stringify(d) },
                          );
                          setUrl(result.url);
                          setShares(await api("/shares"));
                        })
                      }
                    >
                      <Link size={15} />
                      Create view link
                    </button>
                    {url && (
                      <div className="copy-link">
                        <input aria-label="Share URL" readOnly value={url} />
                        <button
                          className="icon-button"
                          aria-label="Copy share link"
                          onClick={() => navigator.clipboard.writeText(url)}
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    )}
                    {shares
                      .filter((s) => s.document_id === d.id)
                      .map((s) => (
                        <div className="saved-link" key={s.id}>
                          <span>
                            Snapshot ·{" "}
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                          <button
                            className="icon-button danger"
                            aria-label="Revoke link"
                            onClick={() =>
                              run(async () => {
                                await api(`/shares/${s.id}`, {
                                  method: "DELETE",
                                });
                                setShares(shares.filter((x) => x.id !== s.id));
                                setUrl("");
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                  </>
                )}
                {tab === "slack" && (
                  <>
                    <label className="field">
                      Workspace
                      <select
                        value={install}
                        onChange={(e) => setInstall(e.target.value)}
                      >
                        <option value="">Choose a workspace…</option>
                        {installations.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.team_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="text-button"
                      disabled={!config.slack}
                      onClick={() =>
                        run(async () => {
                          const r = await api<{ url: string }>(
                            "/slack/connect",
                            { method: "POST" },
                          );
                          window.location.assign(r.url);
                        })
                      }
                    >
                      <Plus size={14} />
                      Connect Slack workspace
                    </button>
                    {!config.slack && (
                      <p className="helper">
                        Slack OAuth is not configured on this host yet. Copy PNG
                        from Export to share manually.
                      </p>
                    )}
                    <label className="field">
                      Channel
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                      >
                        <option value="">Choose a channel…</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {cursor && (
                      <button
                        className="text-button"
                        onClick={() =>
                          run(async () => {
                            const r = await api<{
                              channels: typeof channels;
                              cursor: string;
                            }>(
                              `/slack/installations/${install}/channels?cursor=${encodeURIComponent(cursor)}`,
                            );
                            setChannels([...channels, ...r.channels]);
                            setCursor(r.cursor);
                          })
                        }
                      >
                        Load more channels
                      </button>
                    )}
                    <p className="helper">
                      Invite Economy Flow Builder to the channel if it is not
                      listed.
                    </p>
                    <label className="field">
                      Thread timestamp{" "}
                      <span className="optional">optional</span>
                      <input
                        placeholder="e.g. 1789300000.000100"
                        value={thread}
                        onChange={(e) => setThread(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Message
                      <textarea
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={3000}
                        placeholder="Add a little context…"
                      />
                    </label>
                    <div className="sending-as">
                      Sending as{" "}
                      <strong>
                        {installations.find((i) => i.id === install)
                          ?.bot_name || "Economy Flow Builder"}
                      </strong>
                    </div>
                    <button
                      className="button primary full"
                      disabled={
                        busy || !blob || !channel || !install || !!sendState
                      }
                      onClick={() =>
                        run(async () => {
                          const form = new FormData();
                          form.set("image", blob!, filename(d.name, "png"));
                          form.set("operationId", operation);
                          form.set("installationId", install);
                          form.set("channel", channel);
                          form.set("thread", thread);
                          form.set("message", message);
                          setSendState("sending");
                          try {
                            const r = await api<{ status: string }>(
                              "/slack/uploads",
                              { method: "POST", body: form },
                            );
                            setSendState(r.status);
                          } catch (e) {
                            try {
                              const r = await api<{ status: string }>(
                                `/slack/uploads/${operation}`,
                              );
                              setSendState(r.status);
                            } catch {
                              setSendState("uncertain");
                            }
                            throw e;
                          }
                        })
                      }
                    >
                      <Send size={15} />
                      {sendState === "sent" ? "Sent to Slack" : "Send this PNG"}
                    </button>
                    {sendState === "sent" && (
                      <p className="success">
                        <Check size={14} />
                        Slack confirmed the upload.
                      </p>
                    )}
                    {sendState &&
                      sendState !== "sent" &&
                      ![
                        "sending",
                        "queued",
                        "uploading",
                        "completing",
                      ].includes(sendState) && (
                        <p className="helper">
                          Status: {sendState}. Check Slack before starting a new
                          send. This preview will not be resent automatically.
                        </p>
                      )}
                    {install && (
                      <button
                        className="text-button danger"
                        onClick={() =>
                          run(async () => {
                            await api(`/slack/installations/${install}`, {
                              method: "DELETE",
                            });
                            setInstallations(
                              installations.filter((i) => i.id !== install),
                            );
                            setInstall("");
                          })
                        }
                      >
                        Disconnect workspace
                      </button>
                    )}
                  </>
                )}
                {tab === "publish" && d.visibility !== undefined && (
                  <div className="account-gate">
                    <h3>
                      {d.visibility === "public"
                        ? "Public with account saves"
                        : "Private diagram"}
                    </h3>
                    <p>
                      {d.visibility === "public"
                        ? "The community gallery follows your latest successful account save. Use the lock beside the title to make this diagram private."
                        : "This diagram is excluded from the community gallery. Unlock it beside the title to publish with account saves."}
                    </p>
                  </div>
                )}
                {tab === "publish" && d.visibility === undefined && (
                  <>
                    <h3>Put it in the community gallery.</h3>
                    <label className="field">
                      Title
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                      />
                    </label>
                    <label className="field">
                      Your public name
                      <input
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      Description
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={2000}
                      />
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={publishConfirmed}
                        onChange={(e) => setPublishConfirmed(e.target.checked)}
                      />
                      Make this snapshot public and allow others to copy it.
                    </label>
                    <button
                      className="button primary full"
                      disabled={
                        busy ||
                        !publishConfirmed ||
                        !author.trim() ||
                        !title.trim()
                      }
                      onClick={() =>
                        run(async () => {
                          const r = await api<{ url: string; id: string }>(
                            "/publications",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                document: d,
                                title,
                                author,
                                description,
                              }),
                            },
                          );
                          setUrl(r.url);
                          const thumb = await pngBlob(
                            d,
                            layout,
                            undefined,
                            Math.min(0.5, 720 / layout.bounds.width),
                          );
                          await api(`/publications/${r.id}/thumbnail`, {
                            method: "PUT",
                            body: thumb,
                          });
                          setPublished(await api("/publications"));
                          notify("Published to the community gallery.");
                        })
                      }
                    >
                      <Globe size={15} />
                      {published.some((p) => p.document_id === d.id)
                        ? "Update published snapshot"
                        : "Publish snapshot"}
                    </button>
                    {url && (
                      <a
                        className="text-button"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open published diagram
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {published
                      .filter((p) => p.document_id === d.id)
                      .map((p) => (
                        <button
                          key={p.id}
                          className="text-button danger"
                          onClick={() =>
                            run(async () => {
                              await api(`/publications/${p.id}`, {
                                method: "DELETE",
                              });
                              setPublished(
                                published.filter((x) => x.id !== p.id),
                              );
                              setUrl("");
                              notify("Publication removed.");
                            })
                          }
                        >
                          Unpublish {p.title}
                        </button>
                      ))}
                  </>
                )}
              </>
            )
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

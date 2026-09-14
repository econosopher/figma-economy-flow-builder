import { PublicCatalog } from "./components/PublicCatalog";
import { recordDiagramView } from "./lib/api";
import { EvidencePanel } from "./components/CardEvidence";
import {
  exportEvidencePackage,
  importEvidencePackage,
} from "./lib/evidenceMedia";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider, type Connection } from "@xyflow/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Download,
  FolderOpen,
  Globe,
  Layers,
  LayoutGrid,
  LoaderCircle,
  LogIn,
  LockKeyhole,
  LockKeyholeOpen,
  LogOut,
  Minus,
  Plus,
  Redo2,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { textEditKey } from "./core/history";
import { Canvas, type Selection } from "./components/Canvas";
import { ResourceDrawer, type ResourceKind } from "./components/DirectEditing";
import { Inspector } from "./components/Inspector";
import { PresetSources } from "./components/PresetSources";
import { Modal } from "./components/Modal";
import { ShareDialog } from "./components/ShareDialog";
import { ResearchDialog } from "./components/ResearchDialog";
import { DiagramSvg } from "./components/DiagramSvg";
import {
  addConnectedCard,
  blankDocument,
  deleteCard,
  forkDocument,
  importDocument,
  uid,
  validateDocument,
  type EconomyDocument,
} from "./core/document";
import {
  layoutDocument,
  measureCards,
  measureHeadings,
  type Layout,
} from "./core/layout";
import { presets, starter, presetDescription } from "./core/presets";
import {
  api,
  ApiError,
  authClient,
  initializeApi,
  reportEvent,
  type AppConfig,
} from "./lib/api";
import {
  listLocal,
  loadSettings,
  localKey,
  persistSettings,
  readSaved,
  saveLocal,
  storagePrefix,
  type SavedDocument,
} from "./lib/storage";
import { download, filename, pngBlob } from "./lib/export";
const defaultConfig: AppConfig = {
  cloud: false,
  slack: false,
  research: false,
  environment: "local",
};
type RemoteDocument = {
  document: EconomyDocument;
  revision: number;
  updated_at: string;
  is_preset: boolean;
};

export type EditorRoute =
  | { kind: "snapshot" }
  | { kind: "account" }
  | { kind: "local"; id: string }
  | { kind: "preset"; id: string }
  | { kind: "default" };

export function editorRoute(search: string): EditorRoute {
  const params = new URLSearchParams(search);
  if (params.has("share") || params.has("gallery")) return { kind: "snapshot" };
  if (params.has("document")) return { kind: "account" };
  const local = params.get("local");
  if (local) return { kind: "local", id: local };
  const preset = params.get("preset");
  if (preset) return { kind: "preset", id: preset };
  return { kind: "default" };
}

function privateFork(document: EconomyDocument) {
  return { ...forkDocument(document), visibility: "private" as const };
}

export function initial(search = globalThis.location?.search ?? "") {
  const route = editorRoute(search);
  try {
    if (route.kind === "local") {
      const saved = readSaved(route.id);
      if (saved) return saved.document;
    }
    if (route.kind === "preset") {
      const preset = presets.find((entry) => entry.id === route.id);
      if (preset) return privateFork(preset.document);
    }
    const id = localStorage.getItem(`${storagePrefix}last:guest`);
    const saved = id && readSaved(id);
    if (saved) return saved.document;
  } catch {}
  return privateFork(
    presets.find((preset) => preset.id === "wardogs")?.document || starter,
  );
}
function Editor() {
  const [doc, setDoc] = useState<EconomyDocument>(initial),
    [layout, setLayout] = useState<Layout>(() => layoutDocument(doc)),
    [layoutBusy, setLayoutBusy] = useState(true),
    [layoutError, setLayoutError] = useState("");
  const layoutWorker = useRef<Worker | null>(null),
    layoutRequest = useRef(0);
  const [selection, setSelection] = useState<Selection>(null),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [inspector, setInspector] = useState(false),
    [resourcesOpen, setResourcesOpen] = useState(false),
    [focusTarget, setFocusTarget] = useState<string | null>(null),
    [fitKey, setFitKey] = useState(0);
  const [sourcesDocument, setSourcesDocument] =
    useState<EconomyDocument | null>(null);
  const [evidenceCard, setEvidenceCard] = useState<string | null>(null);
  const consumeFocus = useCallback(() => setFocusTarget(null), []);
  const [modal, setModal] = useState<string | null>(null),
    [libraryTab, setLibraryTab] = useState("presets"),
    [search, setSearch] = useState(""),
    [jsonText, setJsonText] = useState(""),
    [importPreview, setImportPreview] = useState<ReturnType<
      typeof importDocument
    > | null>(null);
  const [config, setConfig] = useState<AppConfig>(defaultConfig),
    [session, setSession] = useState<Session | null>(null),
    [email, setEmail] = useState(""),
    [authMessage, setAuthMessage] = useState("");
  const [saveState, setSaveState] = useState("Saved locally"),
    [online, setOnline] = useState(navigator.onLine),
    [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState(false),
    [toast, setToast] = useState("");
  const [localItems, setLocalItems] = useState<SavedDocument[]>([]),
    [remoteItems, setRemoteItems] = useState<RemoteDocument[]>([]),
    [authCode, setAuthCode] = useState("");
  const [readonly, setReadonly] = useState(
      () =>
        new URLSearchParams(location.search).has("share") ||
        new URLSearchParams(location.search).has("gallery") ||
        new URLSearchParams(location.search).has("document"),
    ),
    [publicLoading, setPublicLoading] = useState(readonly),
    [publicError, setPublicError] = useState(""),
    [publicationId, setPublicationId] = useState<string | null>(
      new URLSearchParams(location.search).get("gallery"),
    );
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(
      null,
    ),
    [historyTick, setHistoryTick] = useState(0),
    [report, setReport] = useState(""),
    [moderation, setModeration] = useState<
      {
        id: string;
        publication_id: string;
        reason: string;
        publications: { title: string };
      }[]
    >([]);
  const history = useRef<{
    past: EconomyDocument[];
    future: EconomyDocument[];
  }>({ past: [], future: [] });
  const pendingView = useRef<{ itemId: string; documentId: string } | null>(
    null,
  );
  const docRef = useRef(doc);
  docRef.current = doc;
  const revisions = useRef(new Map<string, number>()),
    cloudRevisions = useRef(new Map<string, number>());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const lastCommit = useRef(0);
  const lastEditKey = useRef<string | null>(null);
  const bootstrappedOwner = useRef("");
  const requestedAccountDocument = useRef(
    new URLSearchParams(location.search).get("document"),
  );
  const owner = session?.user.id || "guest";
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const notify = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    void initializeApi().then(async (c) => {
      setConfig(c);
      const auth = authClient();
      if (auth) {
        setSession((await auth.auth.getSession()).data.session);
        subscription = auth.auth.onAuthStateChange((_, s) => {
          setSession(s);
          if (s) setModal((m) => (m === "auth" ? null : m));
        }).data.subscription;
      }
    });
    return () => subscription?.unsubscribe();
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const share = params.get("share"),
      publicId = params.get("gallery");
    if (!share && !publicId) return;
    void api<{ snapshot: unknown }>(
      share ? `/shared/${share}` : `/gallery/${publicId}`,
    )
      .then((r) => {
        const snapshot = validateDocument(r.snapshot);
        if (publicId)
          pendingView.current = {
            itemId: `publication:${publicId}`,
            documentId: snapshot.id,
          };
        setDoc(snapshot);
        setDirty(false);
        setFitKey((k) => k + 1);
      })
      .catch((e) => {
        setPublicError(e.message);
        notify(e.message);
      })
      .finally(() => setPublicLoading(false));
  }, [notify]);
  useEffect(() => {
    const worker = new Worker(
      new URL("./core/layout.worker.ts", import.meta.url),
      { type: "module" },
    );
    layoutWorker.current = worker;
    worker.onmessage = (event) => {
      if (event.data.id !== layoutRequest.current) return;
      setLayoutBusy(false);
      if (event.data.error) {
        reportEvent("layout_failed");
        setLayoutError(event.data.error);
        return;
      }
      setLayoutError("");
      setLayout(event.data.layout);
      if (
        pendingView.current?.documentId === docRef.current.id &&
        !event.data.layout.issues.length
      ) {
        recordDiagramView(pendingView.current.itemId);
        pendingView.current = null;
      }
      if (event.data.layout.issues.length)
        reportEvent("route_failed", {
          cards: docRef.current.cards.length,
          edges: docRef.current.edges.length,
        });
    };
    worker.onerror = () => {
      reportEvent("layout_failed");
      setLayoutBusy(false);
      setLayoutError(
        "The layout engine is unavailable. Reload the editor to load the latest version.",
      );
    };
    return () => {
      worker.terminate();
      layoutWorker.current = null;
    };
  }, []);
  useEffect(() => {
    const requestId = ++layoutRequest.current;
    let cancelled = false;
    setLayoutBusy(true);
    const timer = setTimeout(() => {
      void document.fonts.ready.then(() => {
        if (cancelled || !layoutWorker.current) return;
        const ctx = document.createElement("canvas").getContext("2d");
        const measure = (text: string, size: number, weight: number) => {
          if (!ctx) return text.length * size * 0.6;
          ctx.font = `${weight} ${size}px Inter`;
          return ctx.measureText(text).width;
        };
        layoutWorker.current.postMessage({
          id: requestId,
          document: doc,
          metrics: measureCards(doc, measure),
          headings: measureHeadings(doc, measure),
        });
      });
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc]);
  const commit = useCallback(
    (next: EconomyDocument) => {
      if (readonly) return;
      try {
        next = validateDocument(next);
        const now = Date.now();
        const editKey = textEditKey(docRef.current, next);
        if (
          !editKey ||
          editKey !== lastEditKey.current ||
          now - lastCommit.current > 450
        ) {
          history.current.past.push(docRef.current);
          history.current.past = history.current.past.slice(-100);
        }
        lastCommit.current = now;
        lastEditKey.current = editKey;
        history.current.future = [];
        setDoc(next);
        setDirty(true);
        setHistoryTick((k) => k + 1);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Invalid edit.");
      }
    },
    [readonly, notify],
  );
  const openDocument = useCallback(
    (d: EconomyDocument, asCopy = true, cloudRevision?: number) => {
      const next = asCopy ? forkDocument(d) : validateDocument(d);
      pendingView.current = null;
      history.current = { past: [], future: [] };
      lastCommit.current = 0;
      setDoc(next);
      setFocusTarget(null);
      setReadonly(false);
      setPublicationId(null);
      setSelection(null);
      setEvidenceCard(null);
      setInspector(false);
      setResourcesOpen(false);
      setConflict(false);
      setDirty(asCopy);
      setFitKey((k) => k + 1);
      setModal(null);
      setHistoryTick((k) => k + 1);
      if (cloudRevision !== undefined)
        cloudRevisions.current.set(next.id, cloudRevision);
      window.history.replaceState(
        null,
        "",
        `${location.pathname}?local=${encodeURIComponent(next.id)}`,
      );
      return next.id;
    },
    [],
  );
  useEffect(() => {
    if (readonly || conflict) return;
    const key = localKey(doc.id, owner);
    if (!revisions.current.has(key))
      revisions.current.set(key, readSaved(doc.id, owner)?.revision || 0);
    const existingLocal = readSaved(doc.id, owner);
    if (!cloudRevisions.current.has(doc.id) && existingLocal?.cloudRevision)
      cloudRevisions.current.set(doc.id, existingLocal.cloudRevision);
    if (
      !dirty &&
      existingLocal &&
      !(session && online && existingLocal.pendingCloud)
    ) {
      setSaveState(
        session && existingLocal.cloudRevision
          ? "Saved to your account"
          : "Saved locally",
      );
      return;
    }
    setSaveState(online ? "Saving…" : "Offline · saving locally");
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.then(async () => {
        if (activeOwner.current !== owner) return;
        let localSaved = false;
        try {
          const writeLocal = () =>
            saveLocal(doc, revisions.current.get(key) || 0, owner, {
              cloudRevision: cloudRevisions.current.get(doc.id),
              pendingCloud: !!session,
            });
          const saved = navigator.locks
            ? await navigator.locks.request(key, writeLocal)
            : writeLocal();
          localSaved = true;
          revisions.current.set(key, saved.revision);
          persistSettings(doc.settings, owner);
          if (session && online) {
            const r = await api<RemoteDocument>(
              `/documents/${doc.id}`,
              {
                method: "PUT",
                body: JSON.stringify({
                  document: doc,
                  expectedRevision: cloudRevisions.current.get(doc.id) || 0,
                  isPreset: !!saved.isPreset,
                }),
              },
              owner,
            );
            cloudRevisions.current.set(doc.id, r.revision);
            const current = readSaved(doc.id, owner);
            if (current) {
              localStorage.setItem(
                key,
                JSON.stringify({
                  ...current,
                  cloudRevision: r.revision,
                  pendingCloud: current.revision !== saved.revision,
                }),
              );
            }
            await api(
              "/settings",
              {
                method: "PUT",
                body: JSON.stringify(doc.settings),
              },
              owner,
            );
          }
          if (docRef.current === doc) {
            setDirty(false);
            setSaveState(
              session && online
                ? "Saved to your account"
                : online
                  ? "Saved locally"
                  : "Offline · saved locally",
            );
          }
        } catch (e) {
          reportEvent("save_failed");
          if (
            (e instanceof ApiError && e.status === 409) ||
            (e instanceof Error && e.message.includes("another tab"))
          ) {
            setConflict(true);
            setSaveState("Save conflict");
            notify(e.message);
          } else {
            setSaveState(
              localSaved
                ? "Saved locally · cloud pending"
                : "Not saved · storage unavailable",
            );
            notify(e instanceof Error ? e.message : "Saving failed.");
          }
        }
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [doc, dirty, owner, session, online, readonly, conflict, notify]);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== localKey(doc.id, owner) || !e.newValue) return;
      try {
        const next: SavedDocument = JSON.parse(e.newValue);
        if (next.revision === revisions.current.get(e.key)) return;
        if (dirty) {
          setConflict(true);
          setSaveState("Save conflict");
        } else {
          revisions.current.set(e.key, next.revision);
          setDoc(validateDocument(next.document));
        }
      } catch {}
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [doc.id, owner, dirty]);
  useEffect(() => {
    if (!session) {
      bootstrappedOwner.current = "";
      return;
    }
    if (bootstrappedOwner.current === session.user.id) return;
    cloudRevisions.current.clear();
    bootstrappedOwner.current = session.user.id;
    const last = localStorage.getItem(
      `${storagePrefix}last:${session.user.id}`,
    );
    const saved = last ? readSaved(last, session.user.id) : null;
    if (saved && !readonly) {
      setDoc(saved.document);
      if (saved.cloudRevision)
        cloudRevisions.current.set(saved.document.id, saved.cloudRevision);
      setDirty(!!saved.pendingCloud);
    } else if (!readonly) {
      setDoc(forkDocument(docRef.current));
      setDirty(true);
    }
    void api<EconomyDocument["settings"] | null>(
      "/settings",
      {},
      session.user.id,
    )
      .then((settings) => {
        if (settings) persistSettings(settings, session.user.id);
      })
      .catch(() => {});
    void api<RemoteDocument[]>("/documents", {}, session.user.id)
      .then(setRemoteItems)
      .catch((e) => notify(e.message));
  }, [session, readonly, notify]);
  useEffect(() => {
    const id = requestedAccountDocument.current;
    if (!id || !config.cloud) return;
    if (!session) {
      setPublicLoading(false);
      setPublicError("Sign in to open this account diagram.");
      return;
    }
    let cancelled = false;
    setPublicLoading(true);
    setPublicError("");
    void api<RemoteDocument>(
      `/documents/${encodeURIComponent(id)}`,
      {},
      session.user.id,
    )
      .then((row) => {
        if (cancelled) return;
        const local = readSaved(id, session.user.id);
        if (local?.pendingCloud) {
          setPublicError(
            "This browser has unsaved changes for this diagram. Open it from My diagrams to recover them.",
          );
          return;
        }
        requestedAccountDocument.current = null;
        openDocument(row.document, false, row.revision);
      })
      .catch((e) => {
        if (!cancelled) setPublicError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, config.cloud, openDocument]);
  const undo = useCallback(() => {
    const previous = history.current.past.pop();
    if (!previous || readonly) return;
    history.current.future.push(docRef.current);
    setFocusTarget(null);
    setDoc(previous);
    setDirty(true);
    setHistoryTick((k) => k + 1);
    lastCommit.current = 0;
  }, [readonly]);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next || readonly) return;
    history.current.past.push(docRef.current);
    setFocusTarget(null);
    setDoc(next);
    setDirty(true);
    setHistoryTick((k) => k + 1);
    lastCommit.current = 0;
  }, [readonly]);
  const remove = useCallback(
    (id?: string, explicit?: NonNullable<Selection>) => {
      const s = explicit || (id ? { kind: "card", id } : selection);
      if (!s) return;
      const d = docRef.current;
      let next = d;
      if (s.kind === "card") next = deleteCard(d, s.id);
      if (s.kind === "edge")
        next = { ...d, edges: d.edges.filter((e) => e.id !== s.id) };
      if (s.kind === "group") {
        if (d.groups.length === 1 || d.cards.some((c) => c.groupId === s.id)) {
          notify(
            "Move or remove this group’s cards before removing the group. Keep at least one group.",
          );
          return;
        }
        next = { ...d, groups: d.groups.filter((g) => g.id !== s.id) };
      }
      if (s.kind === "stage") {
        if (d.stages.length === 1 || d.cards.some((c) => c.stageId === s.id)) {
          notify(
            "Move or remove this stage’s cards before removing the stage. Keep at least one stage.",
          );
          return;
        }
        next = { ...d, stages: d.stages.filter((g) => g.id !== s.id) };
      }
      lastCommit.current = 0;
      commit(next);
      setSelection(null);
    },
    [selection, commit, notify],
  );
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const editable = (e.target as HTMLElement)?.closest(
        "input,textarea,select,[contenteditable=true]",
      );
      if (editable || modal || evidenceCard) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setDirty(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key === "Escape") {
        setSelection(null);
        setInspector(false);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo, remove, modal, evidenceCard]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || conflict) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, conflict]);
  async function loadLibrary() {
    setModal("library");
    setLocalItems(listLocal(owner));
    if (session)
      try {
        setRemoteItems(await api("/documents"));
      } catch (e) {
        notify(e instanceof Error ? e.message : "Cloud library unavailable.");
      }
  }
  const newCard = useCallback(
    (fromId?: string) => {
      try {
        const result = addConnectedCard(
          docRef.current,
          fromId,
          selection?.kind === "group" ? selection.id : undefined,
        );
        lastCommit.current = 0;
        commit(result.document);
        setSelection({ kind: "card", id: result.cardId });
        setFocusTarget(`${result.cardId}:label`);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Could not add a card.");
      }
    },
    [commit, selection, notify],
  );
  const move = useCallback(
    (id: string, stageId: string, groupId: string, order: number) => {
      lastCommit.current = 0;
      commit({
        ...docRef.current,
        cards: docRef.current.cards.map((c) =>
          c.id === id ? { ...c, stageId, groupId, order } : c,
        ),
      });
    },
    [commit],
  );
  const connect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      const d = docRef.current,
        a = d.cards.find((n) => n.id === c.source),
        b = d.cards.find((n) => n.id === c.target);
      if (!a || !b) return;
      if (
        d.stages.findIndex((s) => s.id === a.stageId) >=
        d.stages.findIndex((s) => s.id === b.stageId)
      ) {
        setPendingConnection(c);
        return;
      }
      lastCommit.current = 0;
      commit({
        ...d,
        edges: [
          ...d.edges,
          {
            id: uid(),
            from: c.source,
            to: c.target,
            type: "normal",
            feedback: false,
            label: "",
          },
        ],
      });
    },
    [commit],
  );
  async function quickExport() {
    try {
      download(await pngBlob(doc, layout), filename(doc.name, "png"));
      notify("PNG downloaded.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed.");
    }
  }
  const select = useCallback((s: Selection) => {
    setSelection(s);
  }, []);
  const addResource = useCallback(
    (kind: ResourceKind, value?: string, cardId?: string) => {
      const d = docRef.current;
      const id =
        cardId || (selection?.kind === "card" ? selection.id : undefined);
      const card = d.cards.find((c) => c.id === id);
      if (!card) {
        notify("Choose a card, or drag this resource onto one.");
        return;
      }
      const text =
        value ||
        (kind === "notes"
          ? "Add a note…"
          : kind === "sources"
            ? "New source"
            : kind === "sinks"
              ? "New sink"
              : "New store of value");
      lastCommit.current = 0;
      commit({
        ...d,
        cards: d.cards.map((c) =>
          c.id !== card.id
            ? c
            : {
                ...c,
                [kind]:
                  kind === "notes"
                    ? c.notes
                      ? `${c.notes}\n${text}`
                      : text
                    : [...c[kind], text],
              },
        ),
      });
      setSelection({ kind: "card", id: card.id });
      if (!value)
        setFocusTarget(
          `${card.id}:${kind}:${kind === "notes" ? 0 : card[kind].length}`,
        );
    },
    [commit, notify, selection],
  );
  const currentCount = layout.routes.filter((r) => !r.unresolved).length;
  const localFiltered = localItems.filter((i) =>
    i.document.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => void loadLibrary()}
          aria-label="Open diagram library"
        >
          <img src="/logo.png" alt="Economy Flow Builder shipyard logo" />
          <div>
            <strong>Economy Flow</strong>
            <span>BY GAME ECONOMIST CONSULTING</span>
          </div>
        </button>
        <div className="header-separator" />
        <div className="document-heading">
          <input
            aria-label="Diagram title"
            value={doc.name}
            readOnly={readonly}
            onChange={(e) => commit({ ...doc, name: e.target.value })}
          />
          <span className="save-status">
            {readonly ? (
              <Globe size={11} />
            ) : saveState.includes("Saving") ? (
              <LoaderCircle size={11} className="spin" />
            ) : (
              <span className={`status-dot ${conflict ? "warning" : ""}`} />
            )}{" "}
            {readonly ? "Read-only snapshot" : saveState}
          </span>
          {!readonly && session && doc.evidence?.items.some((item) => item.mediaId) && (
            <span className="save-status helper">
              Local screenshots stay on this device.
            </span>
          )}
        </div>
        <div className="header-actions">
          {!readonly && (
            <button
              className="button visibility-control"
              aria-label={
                doc.visibility === "public"
                  ? "Make diagram private"
                  : "Make diagram public"
              }
              aria-pressed={doc.visibility !== "public"}
              title={
                doc.visibility === "public"
                  ? session
                    ? "Public gallery: edits publish with each account save. Click to make private."
                    : "Local only. Will publish when saved to an account. Click to make private."
                  : "Private. Click to publish with account saves."
              }
              onClick={() => {
                const visibility =
                  doc.visibility === "public" ? "private" : "public";
                // Privacy is not undone by canvas undo/redo.
                history.current.past = history.current.past.map((d) => ({
                  ...d,
                  visibility,
                }));
                history.current.future = history.current.future.map((d) => ({
                  ...d,
                  visibility,
                }));
                setDoc({ ...doc, visibility });
                setDirty(true);
                notify(
                  visibility === "private"
                    ? session
                      ? "Making private on the next successful account save."
                      : "Private. Saved in this browser."
                    : session
                      ? "Public: account saves update the community gallery."
                      : "Local only. Public when saved to an account; lock to keep private.",
                );
              }}
            >
              {doc.visibility === "public" ? (
                <LockKeyholeOpen size={15} />
              ) : (
                <LockKeyhole size={15} />
              )}
              <span>
                {doc.visibility === "public"
                  ? session
                    ? "Public"
                    : "Public · local only"
                  : "Private"}
              </span>
            </button>
          )}
          <a
            className="icon-button"
            href="https://github.com/econosopher/figma-economy-flow-builder"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source code on GitHub"
            title="Source code and JSON contributions"
          >
            <Code2 size={17} />
          </a>
          <a
            className="text-button"
            href={`${config.apiOrigin || ""}/connections`}
            target="_blank"
            rel="noopener noreferrer"
            title="Connect an AI client"
          >
            MCP
          </a>
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (⌘Z)"
            disabled={!history.current.past.length || readonly}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
            disabled={!history.current.future.length || readonly}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <span className="header-separator" />
          <button
            className="button"
            disabled={layoutBusy || !!layoutError}
            onClick={() => void quickExport()}
          >
            <Download size={15} />
            <span>PNG</span>
          </button>
          {readonly ? (
            <button
              className="button primary"
              onClick={() => openDocument(doc)}
            >
              <Copy size={15} />
              Make a copy
            </button>
          ) : (
            <button
              className="button primary"
              disabled={layoutBusy || !!layoutError}
              onClick={() => setModal("share")}
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          )}
          <button
            className="account-button"
            aria-label={session ? "Account" : "Sign in"}
            title={session?.user.email || "Sign in"}
            onClick={() => {
              setAuthMessage("");
              setModal("auth");
            }}
          >
            {session ? (
              session.user.email?.[0].toUpperCase()
            ) : (
              <LogIn size={17} />
            )}
          </button>
        </div>
      </header>
      <div className="workspace">
        <main className="canvas-area">
          <div className="canvas-toolbar">
            <button className="tool-button" onClick={() => void loadLibrary()}>
              <LayoutGrid size={16} />
              Library
              <ChevronDown size={12} />
            </button>
            <span className="toolbar-divider" />
            {!readonly && (
              <>
                <button className="tool-button" onClick={() => newCard()}>
                  <Plus size={17} />
                  Card
                </button>
                <button
                  className="tool-button"
                  onClick={() => {
                    const id = uid();
                    lastCommit.current = 0;
                    commit({
                      ...doc,
                      groups: [
                        ...doc.groups,
                        { id, label: "New group", color: "#f6f7f9" },
                      ],
                    });
                    setSelection({ kind: "group", id });
                  }}
                >
                  <Plus size={16} />
                  Group
                </button>
                <button
                  className="tool-button"
                  onClick={() => {
                    const id = uid(),
                      stages = [...doc.stages];
                    stages.splice(Math.max(0, stages.length - 1), 0, {
                      id,
                      label: "New stage",
                    });
                    lastCommit.current = 0;
                    commit({ ...doc, stages });
                    setSelection({ kind: "stage", id });
                  }}
                >
                  <Plus size={16} />
                  Stage
                </button>
                <span className="toolbar-divider" />
                <button
                  className="tool-button research-tool"
                  onClick={() => setModal("research")}
                >
                  <Sparkles size={15} />
                  Research
                </button>
              </>
            )}
            <div className="toolbar-spacer" />
            {doc.research && (
              <button
                className="tool-button"
                onClick={() => setSourcesDocument(doc)}
              >
                Sources
              </button>
            )}
            <button
              className="icon-button"
              title="Edit JSON"
              aria-label="Edit JSON"
              onClick={() => {
                setJsonText(JSON.stringify(doc, null, 2));
                setImportPreview(null);
                setModal("json");
              }}
            >
              <Code2 size={17} />
            </button>
            <button
              className={`icon-button ${inspector ? "active" : ""}`}
              title="Appearance"
              aria-label="Appearance"
              onClick={() => {
                setInspector(!inspector);
                setResourcesOpen(false);
              }}
            >
              <Settings2 size={17} />
            </button>
          </div>
          {conflict && (
            <div className="conflict-banner">
              This diagram changed elsewhere.
              <button
                onClick={() => {
                  if (session)
                    void api<RemoteDocument>(`/documents/${doc.id}`).then(
                      (r) => {
                        cloudRevisions.current.set(doc.id, r.revision);
                        const local = readSaved(doc.id, owner);
                        revisions.current.set(
                          localKey(doc.id, owner),
                          local?.revision || 0,
                        );
                        setConflict(false);
                        setDoc(r.document);
                        setDirty(true);
                      },
                    );
                  else {
                    const saved = readSaved(doc.id, owner);
                    if (saved) {
                      revisions.current.set(
                        localKey(doc.id, owner),
                        saved.revision,
                      );
                      setDoc(saved.document);
                      setConflict(false);
                      setDirty(false);
                    }
                  }
                }}
              >
                Reload saved version
              </button>
              <button onClick={() => openDocument(doc, true)}>
                Save my edits as a copy
              </button>
            </div>
          )}
          {layoutError && (
            <div className="layout-error-banner" role="alert">
              <p>{layoutError}</p>
              <button className="button" onClick={() => location.reload()}>
                Reload editor
              </button>
            </div>
          )}
          {publicError ? (
            <div className="loading-canvas" role="alert">
              {publicError}
              <button
                className="button"
                onClick={() => {
                  setPublicError("");
                  openDocument(starter);
                }}
              >
                Open editor
              </button>
            </div>
          ) : publicLoading ? (
            <div className="loading-canvas">
              <LoaderCircle className="spin" />
              Loading snapshot…
            </div>
          ) : (
            <Canvas
              document={doc}
              layout={layout}
              selection={selection}
              onSelect={select}
              onMove={move}
              onConnect={connect}
              onAdd={newCard}
              onDelete={remove}
              readOnly={readonly || layout.documentId !== doc.id}
              fitKey={fitKey}
              onSelectedIds={setSelectedIds}
              onChange={commit}
              onResource={addResource}
              onRemoveSelection={(s) => remove(undefined, s)}
              focusTarget={focusTarget}
              onFocusConsumed={consumeFocus}
              onOpenEvidence={setEvidenceCard}
            />
          )}
          {!doc.cards.length && (
            <div className="empty-canvas">
              <span className="empty-icon">
                <ArrowRight size={25} />
              </span>
              <h1>
                Every economy starts
                <br />
                with a connection.
              </h1>
              <p>Add your first card, or start from a game you know.</p>
              <div>
                <button className="button primary" onClick={() => newCard()}>
                  <Plus size={16} />
                  Add a card
                </button>
                <button className="button" onClick={() => void loadLibrary()}>
                  Explore presets
                </button>
              </div>
            </div>
          )}
          <div className="canvas-footer">
            <span>
              {doc.cards.length} cards<span className="footer-dot">·</span>
              {currentCount} pipes<span className="footer-dot">·</span>
              {doc.groups.length} groups
            </span>
            <span className="flow-principle">
              <ArrowRight size={13} />
              Left to right, by design
            </span>
            <button
              className="text-button"
              onClick={() => setFitKey((k) => k + 1)}
            >
              Fit diagram
            </button>
          </div>
          {layout.issues.length > 0 && (
            <div className="routing-issues" role="alert">
              <strong>
                {layout.issues.length} routing issue
                {layout.issues.length > 1 ? "s" : ""}
              </strong>
              <details>
                <summary>View details</summary>
                {layout.issues.map((i, n) => (
                  <p key={n}>{i}</p>
                ))}
              </details>
            </div>
          )}
          {layoutBusy && (
            <div className="layout-status">
              <LoaderCircle className="spin" size={12} />
              Arranging…
            </div>
          )}
          {!readonly && (
            <button
              className={`resources-tab ${resourcesOpen ? "active" : ""}`}
              aria-label="Open resources"
              aria-expanded={resourcesOpen}
              onClick={() => {
                setResourcesOpen(!resourcesOpen);
                setInspector(false);
              }}
            >
              <Layers size={15} />
              Resources
            </button>
          )}
          {resourcesOpen && !readonly && (
            <ResourceDrawer
              document={doc}
              selection={selection}
              onAdd={addResource}
              onClose={() => setResourcesOpen(false)}
            />
          )}
        </main>
        {evidenceCard && doc.cards.some((card) => card.id === evidenceCard) && (
          <EvidencePanel
            key={`${doc.id}:${evidenceCard}`}
            document={doc}
            cardId={evidenceCard}
            onChange={commit}
            onClose={() => setEvidenceCard(null)}
            readOnly={readonly}
          />
        )}
        {inspector && !readonly && (
          <Inspector
            document={doc}
            selection={null}
            onChange={commit}
            onClose={() => setInspector(false)}
            onDelete={() => remove()}
          />
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "library" && (
        <Modal
          title="Your next economy starts here."
          description="Pick a starting point. Make it your own."
          onClose={() => setModal(null)}
          wide
        >
          <div className="library-top">
            <div className="tabs">
              {[
                ["presets", "Presets"],
                ["mine", "My diagrams"],
                ["gallery", "Community"],
              ].map(([id, label]) => (
                <button
                  className={libraryTab === id ? "active" : ""}
                  key={id}
                  onClick={() => setLibraryTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="button"
              onClick={() => {
                const d = blankDocument();
                const settings = loadSettings(owner);
                if (settings) d.settings = settings;
                openDocument(d);
              }}
            >
              <Plus size={15} />
              Blank diagram
            </button>
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search diagrams"
              placeholder="Find a game or diagram…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {libraryTab === "mine" && (
            <>
              <div className="library-note">
                <span>
                  {session
                    ? "Your local and cloud diagrams"
                    : "Saved on this browser. Sign in to save across devices."}
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    const saved = readSaved(doc.id, owner);
                    if (saved) {
                      localStorage.setItem(
                        localKey(doc.id, owner),
                        JSON.stringify({ ...saved, isPreset: true }),
                      );
                      setLocalItems(listLocal(owner));
                      setDirty(true);
                      notify("Saved as a personal preset.");
                    }
                  }}
                >
                  Save current as preset
                </button>
              </div>
              {localFiltered.length === 0 && remoteItems.length === 0 ? (
                <div className="empty-list">
                  <FolderOpen size={30} />
                  <h3>A home for your economies.</h3>
                  <p>Your diagrams will appear here as you build.</p>
                </div>
              ) : (
                <div className="document-list">
                  {remoteItems
                    .filter((i) =>
                      i.document.name
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((i) => (
                      <button
                        key={`remote-${i.document.id}`}
                        onClick={() =>
                          openDocument(i.document, i.is_preset, i.revision)
                        }
                      >
                        <span>
                          <strong>{i.document.name}</strong>
                          <small>
                            Cloud ·{" "}
                            {new Date(i.updated_at).toLocaleDateString()}
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  {localFiltered.map((i) => (
                    <button
                      key={i.document.id}
                      onClick={() =>
                        openDocument(i.document, !!i.isPreset, i.cloudRevision)
                      }
                    >
                      <span>
                        <strong>
                          {i.document.name}
                          {i.isPreset && <em>Personal preset</em>}
                        </strong>
                        <small>
                          This browser ·{" "}
                          {new Date(i.updatedAt).toLocaleDateString()}
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {libraryTab !== "mine" && (
            <PublicCatalog
              source={libraryTab === "presets" ? "preset" : "all"}
              search={search}
              onPreset={(document) => {
                const documentId = openDocument(document);
                if (document.id !== "starter")
                  pendingView.current = {
                    itemId: `preset:${document.id}`,
                    documentId,
                  };
              }}
              onSources={setSourcesDocument}
              preview={(d) => <Miniature doc={d} />}
              onCommunity={async (id) => {
                try {
                  const r = await api<{ snapshot: unknown }>(`/gallery/${id}`);
                  const snapshot = validateDocument(r.snapshot);
                  pendingView.current = {
                    itemId: `publication:${id}`,
                    documentId: snapshot.id,
                  };
                  setDoc(snapshot);
                  setReadonly(true);
                  setPublicationId(id);
                  setDirty(false);
                  setModal(null);
                  setFitKey((k) => k + 1);
                } catch (e) {
                  notify(e instanceof Error ? e.message : "Unable to open.");
                }
              }}
            />
          )}
        </Modal>
      )}
      {sourcesDocument && (
        <PresetSources
          doc={sourcesDocument}
          onClose={() => setSourcesDocument(null)}
        />
      )}
      {modal === "json" && (
        <Modal
          title={readonly ? "Diagram JSON" : "Import & edit JSON"}
          description="Open v2 plugin files or the web editor’s editable format."
          onClose={() => setModal(null)}
          wide
        >
          <div className="modal-actions">
            <button
              className="button"
              onClick={async () => {
                try {
                  download(
                    await exportEvidencePackage(doc),
                    `${filename(doc.name, "flowpack")}.json`,
                  );
                } catch (error) {
                  notify(
                    error instanceof Error
                      ? error.message
                      : "Could not export screenshot attachments.",
                  );
                }
              }}
            >
              Download diagram with screenshots
            </button>
          </div>
          {doc.evidence?.items.some((item) => item.mediaId) && (
            <p className="helper">
              Account saves, shares, and ordinary JSON retain screenshot
              references only. Use the diagram package to move local images.
            </p>
          )}
          <textarea
            className="json-editor"
            aria-label="Diagram JSON"
            value={jsonText}
            readOnly={readonly}
            onChange={(e) => {
              setJsonText(e.target.value);
              setImportPreview(null);
            }}
            spellCheck={false}
          />
          <div className="modal-actions">
            <label className="button file-label">
              Open JSON file
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 200_000_000) {
                      notify("Diagram packages must be smaller than 200 MB.");
                      return;
                    }
                    setJsonText(await file.text());
                    setImportPreview(null);
                  }
                }}
              />
            </label>
            <button
              className="button"
              onClick={() => navigator.clipboard.writeText(jsonText)}
            >
              <Copy size={15} />
              Copy JSON
            </button>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  const parsed = JSON.parse(jsonText);
                  if (parsed?.format === "economy-flow-evidence-package") {
                    const imported = await importEvidencePackage(
                      new Blob([jsonText], { type: "application/json" }),
                    );
                    setImportPreview({
                      document: imported,
                      notices: ["Screenshot attachments restored in this browser."],
                    });
                  } else {
                    setImportPreview(importDocument(parsed));
                  }
                } catch (e) {
                  notify(e instanceof Error ? e.message : "Invalid JSON.");
                }
              }}
            >
              Review import
            </button>
          </div>
          {importPreview && (
            <div className="import-review">
              <strong>{importPreview.document.name}</strong>
              <p>{presetDescription(importPreview.document)}</p>
              {importPreview.notices.map((n, i) => (
                <p className="helper" key={i}>
                  {n}
                </p>
              ))}
              <button
                className="button primary"
                onClick={() => openDocument(importPreview.document)}
              >
                Open as a new diagram
              </button>
            </div>
          )}
        </Modal>
      )}
      {modal === "auth" && (
        <Modal
          title={session ? "Your account" : "A home for your diagrams."}
          description={
            session
              ? session.user.email
              : "Save across devices, share with your team, and publish to the community."
          }
          onClose={() => setModal(null)}
        >
          {session ? (
            <>
              <button
                className="button full"
                onClick={async () => {
                  await authClient()?.auth.signOut();
                  setSession(null);
                  setModal(null);
                  cloudRevisions.current.clear();
                  setRemoteItems([]);
                  openDocument(initial(), false);
                  notify("Signed out.");
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    setModeration(await api("/moderation/reports"));
                    setModal("moderation");
                  } catch (e) {
                    notify(
                      e instanceof Error
                        ? e.message
                        : "Administrator access required.",
                    );
                  }
                }}
              >
                Gallery moderation
              </button>
            </>
          ) : (
            <>
              <label className="field">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                />
              </label>
              <button
                className="button primary full"
                disabled={!config.cloud || !email.includes("@")}
                onClick={async () => {
                  const r = await authClient()?.auth.signInWithOtp({
                    email,
                    options: {
                      emailRedirectTo: config.apiOrigin || location.origin,
                    },
                  });
                  setAuthMessage(
                    r?.error?.message ||
                      "Check your email for your sign-in link or code. Enter the code here to keep editing this diagram.",
                  );
                }}
              >
                Send sign-in link
                <ArrowRight size={15} />
              </button>
              {config.cloud && authMessage && (
                <div className="field">
                  <label>
                    Email sign-in code
                    <input
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button
                    className="button"
                    disabled={!authCode.trim()}
                    onClick={async () => {
                      const result = await authClient()?.auth.verifyOtp({
                        email,
                        token: authCode.trim(),
                        type: "email",
                      });
                      if (result?.error) setAuthMessage(result.error.message);
                    }}
                  >
                    Verify code
                  </button>
                </div>
              )}
              {!config.cloud && (
                <p className="helper">
                  Cloud accounts are not connected yet. Your diagrams save in
                  this browser, and all editing and exports work without an
                  account.
                </p>
              )}
              <p className="helper">Free to use. No password to remember.</p>
            </>
          )}
          {authMessage && (
            <p role="status" className="helper">
              {authMessage}
            </p>
          )}
        </Modal>
      )}
      {modal === "share" && (
        <ShareDialog
          document={doc}
          layout={layout}
          selection={selectedIds}
          config={config}
          signedIn={!!session}
          onClose={() => setModal(null)}
          onSignIn={() => setModal("auth")}
          notify={notify}
        />
      )}
      {modal === "research" && (
        <ResearchDialog
          config={config}
          signedIn={!!session}
          onClose={() => setModal(null)}
          onSignIn={() => setModal("auth")}
          onApply={(d) => openDocument(d)}
        />
      )}
      {pendingConnection && (
        <Modal
          title="Create a return pipe?"
          description="This connection goes to an earlier or equal stage. It will use its own outside track."
          onClose={() => setPendingConnection(null)}
        >
          <button
            className="button primary full"
            onClick={() => {
              const c = pendingConnection;
              lastCommit.current = 0;
              commit({
                ...doc,
                edges: [
                  ...doc.edges,
                  {
                    id: uid(),
                    from: c.source!,
                    to: c.target!,
                    feedback: true,
                    type: "value",
                    label: "",
                  },
                ],
              });
              setPendingConnection(null);
            }}
          >
            <ArrowLeft size={16} />
            Create return pipe
          </button>
        </Modal>
      )}
      {readonly && publicationId && (
        <button className="report-button" onClick={() => setModal("report")}>
          Report diagram
        </button>
      )}
      {modal === "report" && (
        <Modal
          title="Report this diagram"
          description="Tell us what should be reviewed."
          onClose={() => setModal(null)}
        >
          <label className="field">
            Reason
            <textarea
              rows={4}
              value={report}
              onChange={(e) => setReport(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={!report.trim() || !session}
            onClick={async () => {
              try {
                await api(`/gallery/${publicationId}/report`, {
                  method: "POST",
                  body: JSON.stringify({ reason: report }),
                });
                setModal(null);
                notify("Report submitted.");
              } catch (e) {
                notify(e instanceof Error ? e.message : "Could not report.");
              }
            }}
          >
            Submit report
          </button>
          {!session && (
            <button className="text-button" onClick={() => setModal("auth")}>
              Sign in to submit a report
            </button>
          )}
        </Modal>
      )}
      {modal === "moderation" && (
        <Modal title="Gallery reports" onClose={() => setModal(null)}>
          {moderation.length ? (
            moderation.map((r) => (
              <div className="moderation-item" key={r.id}>
                <h3>{r.publications.title}</h3>
                <p>{r.reason}</p>
                <button
                  className="button danger"
                  onClick={async () => {
                    try {
                      await api(`/moderation/${r.publication_id}`, {
                        method: "DELETE",
                      });
                      setModeration((m) =>
                        m.filter((x) => x.publication_id !== r.publication_id),
                      );
                    } catch (e) {
                      notify(
                        e instanceof Error
                          ? e.message
                          : "Could not remove publication.",
                      );
                    }
                  }}
                >
                  Remove publication
                </button>
              </div>
            ))
          ) : (
            <p>No reports to review.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
const miniatureCache = new WeakMap<EconomyDocument, Layout>();
function Miniature({ doc }: { doc: EconomyDocument }) {
  let layout = miniatureCache.get(doc);
  if (!layout) {
    layout = layoutDocument(doc);
    miniatureCache.set(doc, layout);
  }
  return (
    <DiagramSvg
      document={{
        ...doc,
        settings: { ...doc.settings, background: "transparent" },
      }}
      layout={layout}
    />
  );
}
export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  FileImage,
  Link as LinkIcon,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  cardFingerprint,
  evidenceNeedsReview,
  uid,
  type CardDetail,
  type EconomyDocument,
  type EvidenceItem,
} from "../core/document";
import { getMedia, putMedia } from "../lib/evidenceMedia";
import "./card-evidence.css";

type EvidenceStatus = CardDetail["status"];

const statusLabels: Record<EvidenceStatus, string> = {
  current: "Current",
  older: "Older version",
  announced: "Announced",
  inference: "Interpretation",
  unverified: "Unverified",
};

function emptyDetail(cardId: string): CardDetail {
  return {
    cardId,
    explanation: "",
    implications: "",
    prompt: "",
    status: "unverified",
    uncertainties: [],
  };
}

function evidenceFor(document: EconomyDocument) {
  return document.evidence ?? { details: [], items: [] };
}

function youtubeId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    const candidate =
      parsed.hostname === "youtu.be"
        ? parsed.pathname.slice(1).split("/")[0]
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
              parsed.hostname,
            )
          ? parsed.searchParams.get("v") ||
            parsed.pathname.match(
              /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/,
            )?.[1]
          : undefined;
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function clockTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function useStoredImage(mediaId?: string) {
  const [result, setResult] = useState<{
    mediaId?: string;
    url?: string;
    missing?: boolean;
  }>({ mediaId });

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setResult({ mediaId });
    if (!mediaId) return () => undefined;
    void getMedia(mediaId)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setResult({ mediaId, missing: true });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setResult({ mediaId, url: objectUrl });
      })
      .catch(() => {
        if (active) setResult({ mediaId, missing: true });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  return result;
}

function EvidenceImage({
  item,
  alt,
  className,
}: {
  item: EvidenceItem;
  alt: string;
  className?: string;
}) {
  const image = useStoredImage(item.mediaId);
  const publicImageUrl =
    !item.mediaId && isHttpsUrl(item.url) ? item.url : undefined;
  const source = image.url || publicImageUrl;
  const [brokenSource, setBrokenSource] = useState<string>();
  if (source && brokenSource !== source)
    return (
      <img
        className={className}
        src={source}
        alt={alt}
        onError={() => setBrokenSource(source)}
      />
    );
  return (
    <div className={`${className ?? ""} evidence-image-placeholder`}>
      <FileImage aria-hidden="true" size={22} />
      <span>
        {brokenSource
          ? "This evidence image could not be displayed"
          : image.missing
          ? "This saved image is unavailable on this device"
          : "Loading image…"}
      </span>
    </div>
  );
}

export function EvidenceBadge({
  document,
  cardId,
  onOpen,
}: {
  document: EconomyDocument;
  cardId: string;
  onOpen: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const evidence = evidenceFor(document);
  const detail = evidence.details.find((entry) => entry.cardId === cardId);
  const items = evidence.items.filter((item) => item.cardIds.includes(cardId));
  const image = items.find((item) => item.kind === "image");
  const needsReview = evidenceNeedsReview(document, cardId);
  const visible = hovered || focused;
  const previewId = `evidence-preview-${cardId}`;

  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(300, window.innerWidth - 24);
      const left = Math.max(
        12,
        Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12),
      );
      const above = rect.top > window.innerHeight - rect.bottom;
      setPosition({
        width,
        left,
        ...(above
          ? { bottom: window.innerHeight - rect.top + 9 }
          : { top: rect.bottom + 9 }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [visible]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`evidence-badge nodrag nopan evidence-status-${detail?.status ?? "unverified"}`}
        aria-label={`Open evidence for ${document.cards.find((card) => card.id === cardId)?.label ?? "card"}`}
        aria-describedby={visible ? previewId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setHovered(false);
          setFocused(false);
          onOpen();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <FileImage size={12} aria-hidden="true" />
        <span>{items.length || "Evidence"}</span>
      </button>
      {visible &&
        createPortal(
          <div
            id={previewId}
            role="tooltip"
            className="evidence-preview"
            style={position}
          >
            {image ? (
              <EvidenceImage
                item={image}
                className="evidence-preview-image"
                alt=""
              />
            ) : (
              <div className="evidence-preview-empty">
                <FileImage size={24} aria-hidden="true" />
                Visual evidence not yet verified
              </div>
            )}
            <div className="evidence-preview-copy">
              <span
                className={`evidence-status evidence-status-${detail?.status ?? "unverified"}`}
              >
                {statusLabels[detail?.status ?? "unverified"]}
              </span>
              {needsReview && (
                <span className="evidence-preview-review">
                  Card changed since this evidence was reviewed
                </span>
              )}
              <p>
                {detail?.explanation ||
                  "Open the evidence panel to review the supporting material."}
              </p>
            </div>
          </div>,
          globalThis.document.body,
        )}
    </>
  );
}

function YouTubeEvidence({ item }: { item: EvidenceItem }) {
  const [playing, setPlaying] = useState(false);
  const id = item.videoId || youtubeId(item.url);
  const start = item.timestampSeconds ?? 0;
  const externalUrl = id
    ? `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`
    : item.url;

  useEffect(() => setPlaying(false), [id, start, item.endSeconds]);

  return (
    <div className="evidence-video">
      {playing && id ? (
        <iframe
          title={item.title || "Evidence video"}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&start=${start}${item.endSeconds ? `&end=${item.endSeconds}` : ""}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          className="evidence-video-play"
          disabled={!id}
          onClick={() => setPlaying(true)}
        >
          <Play fill="currentColor" size={21} aria-hidden="true" />
          {id ? "Play video" : "Add a valid YouTube link to play"}
        </button>
      )}
      <a href={externalUrl} target="_blank" rel="noreferrer">
        <ExternalLink size={13} aria-hidden="true" />
        Open at {clockTime(start)} on YouTube
      </a>
    </div>
  );
}

function ItemEditor({
  item,
  index,
  total,
  readOnly,
  onPatch,
  onMove,
  onRemove,
  onEnlarge,
  onReplaceImage,
  uploadBusy,
}: {
  item: EvidenceItem;
  index: number;
  total: number;
  readOnly: boolean;
  onPatch: (patch: Partial<EvidenceItem>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onEnlarge: () => void;
  onReplaceImage: (file: File) => void;
  uploadBusy: boolean;
}) {
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [urlDraft, setUrlDraft] = useState(item.url);
  const [startDraft, setStartDraft] = useState(
    item.timestampSeconds?.toString() ?? "",
  );
  const [endDraft, setEndDraft] = useState(
    item.endSeconds?.toString() ?? "",
  );
  const [draftError, setDraftError] = useState("");

  useEffect(() => setTitleDraft(item.title), [item.title]);
  useEffect(() => setUrlDraft(item.url), [item.url]);
  useEffect(
    () => setStartDraft(item.timestampSeconds?.toString() ?? ""),
    [item.timestampSeconds],
  );
  useEffect(
    () => setEndDraft(item.endSeconds?.toString() ?? ""),
    [item.endSeconds],
  );

  const dirty =
    titleDraft !== item.title ||
    urlDraft !== item.url ||
    startDraft !== (item.timestampSeconds?.toString() ?? "") ||
    endDraft !== (item.endSeconds?.toString() ?? "");

  function parseSeconds(value: string, minimum: number) {
    if (!value.trim()) return undefined;
    if (!/^\d+$/.test(value.trim())) return null;
    const parsed = Number(value);
    return parsed >= minimum && parsed <= 604800 ? parsed : null;
  }

  function saveDrafts() {
    if (readOnly) return true;
    if (!dirty) {
      setDraftError("");
      return true;
    }
    const title = titleDraft.trim();
    if (!title) {
      setDraftError("Title cannot be empty.");
      return false;
    }
    const url = urlDraft.trim();
    if (!isHttpsUrl(url)) {
      setDraftError("Use a secure HTTPS link.");
      return false;
    }
    const videoId = item.kind === "youtube" ? youtubeId(url) : undefined;
    if (item.kind === "youtube" && !videoId) {
      setDraftError("Use a full YouTube link.");
      return false;
    }
    const timestampSeconds = parseSeconds(startDraft, 0);
    const endSeconds = parseSeconds(endDraft, 1);
    if (timestampSeconds === null || endSeconds === null) {
      setDraftError("Times must be whole seconds between 0 and 604800.");
      return false;
    }
    if (
      endSeconds !== undefined &&
      endSeconds <= (timestampSeconds ?? 0)
    ) {
      setDraftError("The end time must come after the start time.");
      return false;
    }
    setDraftError("");
    onPatch({
      title,
      url,
      ...(item.kind === "youtube" ? { videoId } : {}),
      ...(item.kind === "youtube" ? { timestampSeconds, endSeconds } : {}),
    });
    return true;
  }

  return (
    <article className="evidence-item">
      <div className="evidence-item-heading">
        <span className="evidence-kind">
          {item.kind === "image" ? (
            <FileImage size={14} aria-hidden="true" />
          ) : item.kind === "youtube" ? (
            <Play size={14} aria-hidden="true" />
          ) : (
            <LinkIcon size={14} aria-hidden="true" />
          )}
          {item.kind === "image"
            ? "Screenshot"
            : item.kind === "youtube"
              ? "Video"
              : "Source"}
        </span>
        {!readOnly && (
          <div className="evidence-item-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={`Move ${item.title} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Move ${item.title} down`}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              aria-label={`Remove ${item.title}`}
              onClick={onRemove}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {item.kind === "image" && (
        <>
          <button
            type="button"
            className="evidence-image-button"
            onClick={onEnlarge}
            aria-label={`Enlarge ${item.title}`}
          >
            <EvidenceImage
              item={item}
              className="evidence-gallery-image"
              alt={item.caption || item.title}
            />
          </button>
          {!readOnly && (
            <label className="evidence-upload-button">
              {uploadBusy ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Upload size={14} />
              )}
              {uploadBusy ? "Saving image…" : "Replace image"}
              <input
                type="file"
                accept="image/*"
                disabled={uploadBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onReplaceImage(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          )}
        </>
      )}
      {item.kind === "youtube" && <YouTubeEvidence item={item} />}

      <label className="evidence-field">
        Title
        <input
          value={titleDraft}
          readOnly={readOnly}
          maxLength={300}
          aria-invalid={!!draftError}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={saveDrafts}
        />
      </label>
      <label className="evidence-field">
        {item.kind === "image"
          ? "Source page"
          : item.kind === "youtube"
            ? "YouTube link"
            : "Link"}
        <input
          type="url"
          value={urlDraft}
          readOnly={readOnly}
          maxLength={3000}
          aria-invalid={!!draftError}
          onChange={(event) => setUrlDraft(event.target.value)}
          onBlur={saveDrafts}
        />
      </label>
      {draftError && (
        <p className="evidence-inline-error" role="alert">
          {draftError}
        </p>
      )}
      <label className="evidence-field">
        What this shows
        <textarea
          rows={2}
          value={item.caption}
          readOnly={readOnly}
          onChange={(event) => onPatch({ caption: event.target.value })}
        />
      </label>
      <div className="evidence-field-row">
        <label className="evidence-field">
          Observed on
          <input
            value={item.observedAt ?? ""}
            readOnly={readOnly}
            placeholder="e.g. 14 Sep 2026"
            onChange={(event) =>
              onPatch({ observedAt: event.target.value || undefined })
            }
          />
        </label>
        <label className="evidence-field">
          Game version
          <input
            value={item.build ?? ""}
            readOnly={readOnly}
            placeholder="e.g. 2.4.1"
            onChange={(event) =>
              onPatch({ build: event.target.value || undefined })
            }
          />
        </label>
      </div>
      {item.kind === "youtube" && (
        <div className="evidence-field-row">
          <label className="evidence-field">
            Start time (seconds)
            <input
              type="number"
              min={0}
              max={604800}
              value={startDraft}
              readOnly={readOnly}
              onChange={(event) => setStartDraft(event.target.value)}
              onBlur={saveDrafts}
            />
          </label>
          <label className="evidence-field">
            End time (seconds)
            <input
              type="number"
              min={1}
              max={604800}
              value={endDraft}
              readOnly={readOnly}
              onChange={(event) => setEndDraft(event.target.value)}
              onBlur={saveDrafts}
            />
          </label>
        </div>
      )}
      {!readOnly && dirty && (
        <button
          type="button"
          className="button evidence-save-item"
          onClick={saveDrafts}
        >
          <Check size={14} aria-hidden="true" />
          Save changes
        </button>
      )}
      {item.kind === "source" && isHttpsUrl(item.url) && (
        <a
          className="evidence-source-link"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Open source
        </a>
      )}
    </article>
  );
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Original source";
  }
}

function EvidenceAttribution({ item }: { item: EvidenceItem }) {
  return (
    <div className="evidence-read-attribution">
      <div>
        {item.observedAt && <span>Observed {item.observedAt}</span>}
        {item.build && <span>Version {item.build}</span>}
      </div>
      <a href={item.url} target="_blank" rel="noreferrer">
        {sourceHost(item.url)}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}

function ReadEvidenceCard({
  item,
  onEnlarge,
}: {
  item: EvidenceItem;
  onEnlarge: () => void;
}) {
  return (
    <article className={`evidence-read-item evidence-read-${item.kind}`}>
      {item.kind === "image" && (
        <button
          type="button"
          className="evidence-image-button"
          onClick={onEnlarge}
          aria-label={`Enlarge ${item.title}`}
        >
          <EvidenceImage
            item={item}
            className="evidence-gallery-image"
            alt={item.caption || item.title}
          />
        </button>
      )}
      {item.kind === "youtube" && <YouTubeEvidence item={item} />}
      <div className="evidence-read-item-copy">
        {item.kind === "source" ? (
          <a
            className="evidence-read-source-title"
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            <strong>{item.title}</strong>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <strong>{item.title}</strong>
        )}
        {item.caption && <p>{item.caption}</p>}
        <EvidenceAttribution item={item} />
      </div>
    </article>
  );
}

type ResearchSource = NonNullable<
  EconomyDocument["research"]
>["sources"][number];

function EvidenceReadingView({
  detail,
  items,
  researchSources,
  needsReview,
  onEnlarge,
}: {
  detail: CardDetail;
  items: EvidenceItem[];
  researchSources: ResearchSource[];
  needsReview: boolean;
  onEnlarge: (id: string) => void;
}) {
  const primaryImage = items.find((item) => item.kind === "image");
  const remainingItems = primaryImage
    ? items.filter((item) => item.id !== primaryImage.id)
    : items;

  return (
    <div className="evidence-reading-view">
      {primaryImage ? (
        <figure className="evidence-primary">
          <button
            type="button"
            onClick={() => onEnlarge(primaryImage.id)}
            aria-label={`Enlarge ${primaryImage.title}`}
          >
            <EvidenceImage
              item={primaryImage}
              alt={primaryImage.caption || primaryImage.title}
            />
          </button>
          <figcaption>
            <strong>{primaryImage.title}</strong>
            {primaryImage.caption && <p>{primaryImage.caption}</p>}
            <EvidenceAttribution item={primaryImage} />
          </figcaption>
        </figure>
      ) : (
        <div className="evidence-empty-visual evidence-primary-empty">
          <FileImage size={25} aria-hidden="true" />
          <strong>Visual evidence not yet verified</strong>
          <span>No screenshot has been attached to this card.</span>
        </div>
      )}

      <section className="evidence-reading-copy" aria-labelledby="evidence-summary-heading">
        <div className="evidence-section-heading">
          <h3 id="evidence-summary-heading">What the evidence means</h3>
          <span className={`evidence-status evidence-status-${detail.status}`}>
            {statusLabels[detail.status]}
          </span>
        </div>
        {needsReview && (
          <p className="evidence-reading-review">
            Card changed since this evidence was reviewed.
          </p>
        )}
        <div className="evidence-reading-section">
          <h4>Explanation</h4>
          <p>{detail.explanation || "No explanation recorded yet."}</p>
        </div>
        {detail.implications && (
          <div className="evidence-reading-section">
            <h4>Why it matters</h4>
            <p>{detail.implications}</p>
          </div>
        )}
        {detail.prompt && (
          <div className="evidence-reading-section evidence-reading-prompt">
            <h4>Discussion prompt</h4>
            <p>{detail.prompt}</p>
          </div>
        )}
        {!!detail.uncertainties.length && (
          <div className="evidence-reading-section">
            <h4>Open questions</h4>
            <ul>
              {detail.uncertainties
                .filter((question) => question.trim())
                .map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {!!remainingItems.length && (
        <section className="evidence-read-gallery" aria-labelledby="evidence-gallery-heading">
          <div className="evidence-section-heading">
            <h3 id="evidence-gallery-heading">Supporting material</h3>
            <span>{remainingItems.length}</span>
          </div>
          {remainingItems.map((item) => (
            <ReadEvidenceCard
              key={item.id}
              item={item}
              onEnlarge={() => onEnlarge(item.id)}
            />
          ))}
        </section>
      )}

      {!!researchSources.length && (
        <section className="evidence-research-sources" aria-labelledby="read-original-sources-heading">
          <h3 id="read-original-sources-heading">Original research sources</h3>
          {researchSources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <strong>{source.title}</strong>
                <small>{source.publisher}</small>
              </span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </section>
      )}
    </div>
  );
}

type NewKind = EvidenceItem["kind"];

function AddEvidence({
  cardId,
  documentKey,
  onAdd,
  onError,
  isCurrent,
}: {
  cardId: string;
  documentKey: string;
  onAdd: (item: EvidenceItem) => void;
  onError: (message: string) => void;
  isCurrent: (key: string) => boolean;
}) {
  const [kind, setKind] = useState<NewKind>("image");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    onError("");
    if (!title.trim()) {
      onError("Add a short title for this evidence.");
      return;
    }
    if (!isHttpsUrl(url.trim())) {
      onError("Use a secure HTTPS link to the original source.");
      return;
    }
    const id = kind === "youtube" ? youtubeId(url.trim()) : undefined;
    if (kind === "youtube" && !id) {
      onError("Use a valid YouTube link.");
      return;
    }
    setBusy(true);
    try {
      const mediaId = file ? await putMedia(file) : undefined;
      if (!isCurrent(documentKey)) return;
      onAdd({
        id: uid(),
        cardIds: [cardId],
        kind,
        title: title.trim(),
        url: url.trim(),
        caption: caption.trim(),
        ...(mediaId ? { mediaId } : {}),
        ...(id ? { videoId: id } : {}),
      });
      setTitle("");
      setUrl("");
      setCaption("");
      setFile(null);
    } catch (error) {
      if (isCurrent(documentKey))
        onError(
          error instanceof Error ? error.message : "The image could not be saved.",
        );
    } finally {
      if (isCurrent(documentKey)) setBusy(false);
    }
  }

  return (
    <section className="evidence-add" aria-labelledby="add-evidence-heading">
      <h3 id="add-evidence-heading">Add evidence</h3>
      <label className="evidence-field">
        Evidence type
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as NewKind);
            setFile(null);
          }}
        >
          <option value="image">Screenshot</option>
          <option value="youtube">YouTube video</option>
          <option value="source">Source link</option>
        </select>
      </label>
      {kind === "image" && (
        <label className="evidence-file-choice">
          <Upload size={16} aria-hidden="true" />
          <span>{file?.name || "Attach a private image (optional)"}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFile(event.target.files?.[0] ?? null)
            }
          />
        </label>
      )}
      <label className="evidence-field">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={kind === "image" ? "Shop screen" : "Official overview"}
        />
      </label>
      <label className="evidence-field">
        {kind === "image"
          ? "Public image or source page"
          : kind === "youtube"
            ? "YouTube link"
            : "Link"}
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
        />
      </label>
      <label className="evidence-field">
        What this shows
        <textarea
          rows={2}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>
      {kind === "image" && (
        <p className="helper">
          A public HTTPS image URL is shown to everyone. Attached images stay
          only in this browser until you download a diagram package.
        </p>
      )}
      <button
        type="button"
        className="button evidence-add-button"
        disabled={busy}
        onClick={() => void add()}
      >
        {busy ? (
          <LoaderCircle className="spin" size={15} aria-hidden="true" />
        ) : (
          <Plus size={15} aria-hidden="true" />
        )}
        {busy ? "Saving…" : "Add evidence"}
      </button>
    </section>
  );
}

export function EvidencePanel({
  document,
  cardId,
  onChange,
  onClose,
  readOnly,
}: {
  document: EconomyDocument;
  cardId: string;
  onChange: (document: EconomyDocument) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const latestDocumentRef = useRef(document);
  const keyRef = useRef(`${document.id}:${cardId}`);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const card = document.cards.find((candidate) => candidate.id === cardId);
  const evidence = evidenceFor(document);
  const savedDetail = evidence.details.find((entry) => entry.cardId === cardId);
  const detail = savedDetail ?? emptyDetail(cardId);
  const items = evidence.items.filter((item) => item.cardIds.includes(cardId));
  const researchSources =
    document.research?.sources.filter((source) =>
      source.cardIds.includes(cardId),
    ) ?? [];
  const needsReview = savedDetail ? evidenceNeedsReview(document, cardId) : false;
  const activeKey = `${document.id}:${cardId}`;
  latestDocumentRef.current = document;
  keyRef.current = activeKey;

  useEffect(() => setEditing(false), [activeKey]);

  useLayoutEffect(() => {
    returnFocusRef.current =
      globalThis.document.activeElement instanceof HTMLElement
        ? globalThis.document.activeElement
        : null;
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (enlarged) setEnlarged(null);
      else onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [enlarged, onClose]);

  const isCurrent = (key: string) =>
    mountedRef.current && keyRef.current === key;

  function changeEvidence(nextEvidence: NonNullable<EconomyDocument["evidence"]>) {
    onChange({ ...document, evidence: nextEvidence });
  }

  function patchDetail(patch: Partial<CardDetail>) {
    const next = { ...detail, ...patch };
    changeEvidence({
      ...evidence,
      details: savedDetail
        ? evidence.details.map((entry) =>
            entry.cardId === cardId ? next : entry,
          )
        : [...evidence.details, next],
    });
  }

  function patchItem(id: string, patch: Partial<EvidenceItem>) {
    changeEvidence({
      ...evidence,
      items: evidence.items.map((item) =>
        item.id === id ? ({ ...item, ...patch } as EvidenceItem) : item,
      ),
    });
  }

  function moveItem(id: string, direction: -1 | 1) {
    const visibleIndex = items.findIndex((item) => item.id === id);
    const other = items[visibleIndex + direction];
    if (!other) return;
    const next = [...evidence.items];
    const from = next.findIndex((item) => item.id === id);
    const to = next.findIndex((item) => item.id === other.id);
    [next[from], next[to]] = [next[to], next[from]];
    changeEvidence({ ...evidence, items: next });
  }

  async function replaceImage(item: EvidenceItem, file: File) {
    const startedFor = activeKey;
    setError("");
    setUploadingItem(item.id);
    try {
      const mediaId = await putMedia(file);
      if (!isCurrent(startedFor)) return;
      const latest = latestDocumentRef.current;
      const latestEvidence = evidenceFor(latest);
      onChange({
        ...latest,
        evidence: {
          ...latestEvidence,
          items: latestEvidence.items.map((entry) =>
            entry.id === item.id ? { ...entry, mediaId } : entry,
          ),
        },
      });
    } catch (uploadError) {
      if (isCurrent(startedFor))
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "The image could not be saved.",
        );
    } finally {
      if (isCurrent(startedFor)) setUploadingItem(null);
    }
  }

  function addItem(item: EvidenceItem) {
    const latest = latestDocumentRef.current;
    const latestEvidence = evidenceFor(latest);
    onChange({
      ...latest,
      evidence: {
        ...latestEvidence,
        items: [...latestEvidence.items, item],
      },
    });
  }

  const enlargedItem = useMemo(
    () => evidence.items.find((item) => item.id === enlarged),
    [enlarged, evidence.items],
  );

  if (!card) return null;

  return createPortal(
    <>
      <aside
        className="evidence-panel"
        aria-labelledby="evidence-panel-title"
        aria-describedby="evidence-panel-description"
      >
        <header className="evidence-panel-heading">
          <div>
            <span>Evidence</span>
            <h2 id="evidence-panel-title">{card.label}</h2>
            <p id="evidence-panel-description">
              Sources, observations, and interpretation for this card.
            </p>
          </div>
          <div className="evidence-panel-actions">
            {!readOnly && (
              <button
                type="button"
                className="button"
                onClick={() => setEditing((value) => !value)}
              >
                {editing ? <Check size={14} /> : <Pencil size={14} />}
                {editing ? "Done editing" : "Edit evidence"}
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              className="icon-button"
              aria-label="Close evidence panel"
              onClick={onClose}
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="evidence-panel-body">
          {!editing ? (
            <EvidenceReadingView
              detail={detail}
              items={items}
              researchSources={researchSources}
              needsReview={needsReview}
              onEnlarge={setEnlarged}
            />
          ) : (
            <>
          {needsReview && (
            <div className="evidence-review-note">
              <div>
                <strong>Card changed since this evidence was reviewed</strong>
                <span>Check that the explanation still matches the diagram.</span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    patchDetail({
                      reviewFingerprint: cardFingerprint(document, cardId),
                    })
                  }
                >
                  <Check size={14} aria-hidden="true" />
                  Confirm review
                </button>
              )}
            </div>
          )}

          <section className="evidence-detail" aria-labelledby="card-evidence-heading">
            <div className="evidence-section-heading">
              <h3 id="card-evidence-heading">What the evidence means</h3>
              <span className={`evidence-status evidence-status-${detail.status}`}>
                {statusLabels[detail.status]}
              </span>
            </div>
            <label className="evidence-field">
              Evidence status
              <select
                value={detail.status}
                disabled={readOnly}
                onChange={(event) =>
                  patchDetail({ status: event.target.value as EvidenceStatus })
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="evidence-field">
              Explanation
              <textarea
                rows={4}
                value={detail.explanation}
                readOnly={readOnly}
                placeholder="Describe what the evidence establishes."
                onChange={(event) =>
                  patchDetail({ explanation: event.target.value })
                }
              />
            </label>
            <label className="evidence-field">
              Why it matters
              <textarea
                rows={3}
                value={detail.implications}
                readOnly={readOnly}
                placeholder="Explain the effect on the economy or player experience."
                onChange={(event) =>
                  patchDetail({ implications: event.target.value })
                }
              />
            </label>
            <label className="evidence-field">
              Discussion prompt
              <textarea
                rows={2}
                value={detail.prompt}
                readOnly={readOnly}
                placeholder="Record the question used to investigate this card."
                onChange={(event) => patchDetail({ prompt: event.target.value })}
              />
            </label>

            <div className="evidence-uncertainties">
              <div className="evidence-subheading">
                <h4>Open questions</h4>
                {!readOnly && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      patchDetail({
                        uncertainties: [...detail.uncertainties, ""],
                      })
                    }
                  >
                    <Plus size={13} aria-hidden="true" />
                    Add question
                  </button>
                )}
              </div>
              {!detail.uncertainties.length && (
                <p className="evidence-empty">No open questions recorded.</p>
              )}
              {detail.uncertainties.map((uncertainty, index) => (
                <div className="evidence-uncertainty" key={index}>
                  <input
                    aria-label={`Open question ${index + 1}`}
                    value={uncertainty}
                    readOnly={readOnly}
                    onChange={(event) =>
                      patchDetail({
                        uncertainties: detail.uncertainties.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      })
                    }
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove open question ${index + 1}`}
                      onClick={() =>
                        patchDetail({
                          uncertainties: detail.uncertainties.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="evidence-library" aria-labelledby="evidence-library-heading">
            <div className="evidence-section-heading">
              <h3 id="evidence-library-heading">Supporting material</h3>
              <span>{items.length}</span>
            </div>
            {!items.length && (
              <div className="evidence-empty-visual">
                <FileImage size={25} aria-hidden="true" />
                <strong>Visual evidence not yet verified</strong>
                <span>Add a screenshot, video, or source link.</span>
              </div>
            )}
            {items.map((item, index) => (
              <ItemEditor
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                readOnly={readOnly}
                onPatch={(patch) => patchItem(item.id, patch)}
                onMove={(direction) => moveItem(item.id, direction)}
                onRemove={() =>
                  changeEvidence({
                    ...evidence,
                    items: evidence.items
                      .map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              cardIds: entry.cardIds.filter(
                                (entryCardId) => entryCardId !== cardId,
                              ),
                            }
                          : entry,
                      )
                      .filter((entry) => entry.cardIds.length),
                  })
                }
                onEnlarge={() => setEnlarged(item.id)}
                onReplaceImage={(file) => void replaceImage(item, file)}
                uploadBusy={uploadingItem === item.id}
              />
            ))}
          </section>

          {!!researchSources.length && (
            <section className="evidence-research-sources" aria-labelledby="original-sources-heading">
              <h3 id="original-sources-heading">Original research sources</h3>
              {researchSources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.publisher}</small>
                  </span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ))}
            </section>
          )}

          {error && (
            <p className="evidence-error" role="alert">
              {error}
            </p>
          )}

          {!readOnly && (
            <AddEvidence
              cardId={cardId}
              documentKey={activeKey}
              onAdd={addItem}
              onError={setError}
              isCurrent={isCurrent}
            />
          )}
            </>
          )}
        </div>
      </aside>

      {enlargedItem?.kind === "image" && (
        <div
          className="evidence-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={enlargedItem.title}
          onClick={(event) => {
            if (event.target === event.currentTarget) setEnlarged(null);
          }}
        >
          <button
            type="button"
            className="evidence-lightbox-close"
            aria-label="Close enlarged image"
            onClick={() => setEnlarged(null)}
          >
            <X size={21} />
          </button>
          <figure>
            <EvidenceImage
              item={enlargedItem}
              alt={enlargedItem.caption || enlargedItem.title}
            />
            <figcaption>
              <strong>{enlargedItem.title}</strong>
              {enlargedItem.caption && <span>{enlargedItem.caption}</span>}
              <a href={enlargedItem.url} target="_blank" rel="noreferrer">
                View original source <ExternalLink size={13} />
              </a>
            </figcaption>
          </figure>
        </div>
      )}
    </>,
    globalThis.document.body,
  );
}

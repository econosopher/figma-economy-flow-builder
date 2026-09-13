import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Globe } from "lucide-react";
import { api } from "../lib/api";
import { presets, starter } from "../core/presets";
import type { EconomyDocument } from "../core/document";
import type { CatalogItem, CatalogPage } from "../../worker/catalog";
import { PresetTile } from "./PresetSources";

export function PublicCatalog({
  source,
  search,
  onPreset,
  onCommunity,
  onSources,
  preview,
}: {
  source: "preset" | "all";
  search: string;
  onPreset: (document: EconomyDocument) => void;
  onCommunity: (id: string) => Promise<void>;
  onSources: (document: EconomyDocument) => void;
  preview: (document: EconomyDocument) => ReactNode;
}) {
  const [sort, setSort] = useState("most_viewed");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => setOffset(0), [source, search, sort]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void api<CatalogPage>(
        `/catalog?${new URLSearchParams({ source, search, sort, offset: String(offset), limit: "24" })}`,
      )
        .then((result) => {
          if (!cancelled) {
            setPage(result);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) {
            const items: CatalogItem[] = presets
              .filter((p) =>
                `${p.document.name} ${p.document.research?.summary || ""} ${p.document.research?.category || ""}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .sort((a, b) =>
                a.document.name.localeCompare(b.document.name, "en"),
              )
              .map((p) => ({
                id: `preset:${p.id}`,
                source: "preset",
                source_id: p.id,
                title: p.document.name,
                description: "",
                author: "GEC",
                thumbnail_path: null,
                views: null,
                created_at: "",
              }));
            setPage({
              items: items.slice(offset, offset + 24),
              total: items.length,
              analyticsAvailable: false,
            });
            setError(
              "Community browsing is unavailable. Bundled presets are still available.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, search, sort, offset]);
  const showStarter =
    offset === 0 &&
    (!search || starter.name.toLowerCase().includes(search.toLowerCase()));
  function openPreset(document: EconomyDocument) {
    onPreset(document);
  }
  return (
    <section aria-label="Public diagrams">
      <div className="library-note">
        <label>
          Sort{" "}
          <select
            aria-label="Sort public diagrams"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="most_viewed">Most viewed</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
          </select>
        </label>
        <span role="status">
          {loading
            ? "Loading diagrams…"
            : page?.analyticsAvailable
              ? `${page.total} diagrams · views counted once per visitor per day`
              : "View counts unavailable"}
        </span>
      </div>
      {error && <p className="error-box">{error}</p>}
      <div className="preset-grid" aria-busy={loading}>
        {showStarter && (
          <PresetTile
            doc={starter}
            preview={preview(starter)}
            onOpen={() => openPreset(starter)}
            onSources={() => {}}
          />
        )}
        {!loading &&
          page?.items.map((item) => {
            if (item.source === "preset") {
              const preset = presets.find((p) => p.id === item.source_id);
              if (!preset) return null;
              return (
                <PresetTile
                  key={item.id}
                  doc={preset.document}
                  preview={preview(preset.document)}
                  onOpen={() => openPreset(preset.document)}
                  onSources={() => onSources(preset.document)}
                  views={item.views}
                />
              );
            }
            return (
              <button
                className="preset-card"
                key={item.id}
                onClick={() => {
                  void onCommunity(item.source_id);
                }}
                aria-label={`Open ${item.title}`}
              >
                <div className="preset-preview">
                  {item.thumbnail_path ? (
                    <img src={item.thumbnail_path} alt="" />
                  ) : (
                    <Globe size={32} />
                  )}
                </div>
                <div className="preset-info">
                  <h3>{item.title}</h3>
                  <p>{item.description || `By ${item.author}`}</p>
                  <p>
                    {item.views === null
                      ? "Views unavailable"
                      : `${item.views.toLocaleString()} views`}
                  </p>
                  <span>
                    COMMUNITY <ArrowRight size={15} />
                  </span>
                </div>
              </button>
            );
          })}
      </div>
      {!loading && page?.total === 0 && !showStarter && (
        <p>No matching diagrams.</p>
      )}
      <div className="modal-actions">
        <button
          className="button"
          disabled={loading || offset === 0}
          onClick={() => setOffset((i) => Math.max(0, i - 24))}
        >
          Previous
        </button>
        <button
          className="button"
          disabled={loading || !page || offset + 24 >= page.total}
          onClick={() => setOffset((i) => i + 24)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

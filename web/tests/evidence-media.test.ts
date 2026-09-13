import { describe, expect, it, vi } from "vitest";
import { blankDocument, type EconomyDocument } from "../src/core/document";
import {
  exportEvidencePackageUsing,
  importEvidencePackageUsing,
  MAX_EVIDENCE_MEDIA_BYTES,
  mediaIdForBlob,
  validateEvidenceImage,
} from "../src/lib/evidenceMedia";

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function png(): Blob {
  return new Blob([pngBytes], { type: "image/png" });
}

function largePng(): Blob {
  const bytes = new Uint8Array(1024 * 1024 + 137);
  bytes.set(pngBytes);
  return new Blob([bytes], { type: "image/png" });
}

function evidenceDocument(mediaId: string): EconomyDocument {
  const document = blankDocument();
  return {
    ...document,
    cards: [
      {
        id: "card-one",
        label: "Daily rewards",
        stageId: document.stages[0].id,
        groupId: document.groups[0].id,
        order: 0,
        kind: "action",
        sources: [],
        sinks: [],
        values: [],
        notes: "",
      },
    ],
    evidence: {
      details: [
        {
          cardId: "card-one",
          explanation: "Observed reward screen",
          implications: "A daily return loop",
          prompt: "Check after the next build",
          status: "current",
          uncertainties: ["Server-side cadence may vary"],
          reviewFingerprint: "review-123",
        },
      ],
      items: [
        {
          id: "evidence-one",
          cardIds: ["card-one"],
          kind: "image",
          title: "Daily reward",
          url: "https://example.com/reward",
          caption: "Day seven reward shown",
          observedAt: "2026-09-14",
          build: "1.4.2",
          timestampSeconds: 42,
          endSeconds: 55,
          videoId: "video-abc12",
          mediaId,
        },
      ],
    },
  } as EconomyDocument;
}

describe("private evidence media", () => {
  it("uses a stable content hash and accepts only supported raster contents", async () => {
    const image = png();
    const first = await mediaIdForBlob(image);
    expect(first).toMatch(/^media-[0-9a-f]{64}$/);
    expect(await mediaIdForBlob(image)).toBe(first);
    expect(await validateEvidenceImage(image)).toBe("image/png");

    await expect(
      validateEvidenceImage(new Blob([pngBytes], { type: "image/jpeg" })),
    ).rejects.toThrow("do not match");
    await expect(
      validateEvidenceImage(new Blob(["<svg/>"], { type: "image/svg+xml" })),
    ).rejects.toThrow("PNG, JPEG, or WebP");
    await expect(
      validateEvidenceImage(
        new Blob([new Uint8Array(MAX_EVIDENCE_MEDIA_BYTES + 1)], {
          type: "image/png",
        }),
      ),
    ).rejects.toThrow("5 MB");
  });

  it("round-trips the document and all image data without dropping evidence metadata", async () => {
    const image = largePng();
    const mediaId = await mediaIdForBlob(image);
    const document = evidenceDocument(mediaId);
    const exported = await exportEvidencePackageUsing(document, async (id) =>
      id === mediaId ? image : null,
    );
    expect(exported.type).toBe("application/json");

    const imported = new Map<string, Blob>();
    const result = await importEvidencePackageUsing(exported, async (blob) => {
      const id = await mediaIdForBlob(blob);
      imported.set(id, blob);
      return id;
    });

    expect(result.evidence).toEqual(document.evidence);
    expect(imported.get(mediaId)?.type).toBe("image/png");
    expect(imported.get(mediaId)?.size).toBe(image.size);
    expect(
      new Uint8Array(await imported.get(mediaId)!.slice(0, 12).arrayBuffer()),
    ).toEqual(pngBytes);
  });

  it("fails export when a referenced private image is missing", async () => {
    const mediaId = await mediaIdForBlob(png());
    await expect(
      exportEvidencePackageUsing(evidenceDocument(mediaId), async () => null),
    ).rejects.toThrow("is missing");
  });

  it("validates every package asset before storing any of them", async () => {
    const first = png();
    const firstId = await mediaIdForBlob(first);
    const second = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], {
      type: "image/jpeg",
    });
    const secondId = await mediaIdForBlob(second);
    const exported = await exportEvidencePackageUsing(
      {
        ...evidenceDocument(firstId),
        evidence: {
          ...evidenceDocument(firstId).evidence!,
          items: [
            ...evidenceDocument(firstId).evidence!.items,
            {
              id: "evidence-two",
              cardIds: ["card-one"],
              kind: "image",
              title: "Second image",
              url: "https://example.com/second",
              caption: "Second capture",
              mediaId: secondId,
            },
          ],
        },
      },
      async (id) => (id === firstId ? first : second),
    );
    const value = JSON.parse(await exported.text());
    value.assets[1].data = value.assets[0].data;
    value.assets[1].size = value.assets[0].size;
    const write = vi.fn(async (blob: Blob) => mediaIdForBlob(blob));

    await expect(
      importEvidencePackageUsing(
        new Blob([JSON.stringify(value)], { type: "application/json" }),
        write,
      ),
    ).rejects.toThrow("contents do not match");
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects a missing referenced asset before writing package contents", async () => {
    const image = png();
    const mediaId = await mediaIdForBlob(image);
    const exported = await exportEvidencePackageUsing(
      evidenceDocument(mediaId),
      async () => image,
    );
    const value = JSON.parse(await exported.text());
    value.assets = [];
    const write = vi.fn(async (blob: Blob) => mediaIdForBlob(blob));

    await expect(
      importEvidencePackageUsing(
        new Blob([JSON.stringify(value)], { type: "application/json" }),
        write,
      ),
    ).rejects.toThrow(`Evidence image ${mediaId} is missing`);
    expect(write).not.toHaveBeenCalled();
  });

  it("surfaces the original storage failure when an import write fails", async () => {
    const image = png();
    const mediaId = await mediaIdForBlob(image);
    const exported = await exportEvidencePackageUsing(
      evidenceDocument(mediaId),
      async () => image,
    );
    const storageFailure = new Error("quota denied");

    await expect(
      importEvidencePackageUsing(exported, async () => {
        throw storageFailure;
      }),
    ).rejects.toMatchObject({
      message: `Could not import evidence image ${mediaId}.`,
      cause: storageFailure,
    });
  });
});

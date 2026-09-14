import { validateDocument, type EconomyDocument } from "../core/document";
import { checkReleaseReadiness } from "../core/conventions";

const DATABASE_NAME = "economy-flow-evidence-media";
const DATABASE_VERSION = 1;
const OBJECT_STORE = "media";
const PACKAGE_FORMAT = "economy-flow-evidence-package";
const PACKAGE_VERSION = 1;

export const MAX_EVIDENCE_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_EVIDENCE_PACKAGE_BYTES = 100 * 1024 * 1024;
const MAX_EVIDENCE_PACKAGE_ASSETS = 600;
// Base64 expands binary data by 4/3. The remaining allowance covers the
// schema-bounded document metadata and JSON structure before parsing.
const MAX_EVIDENCE_PACKAGE_FILE_BYTES =
  Math.ceil(MAX_EVIDENCE_PACKAGE_BYTES / 3) * 4 + 64 * 1024 * 1024;

export type EvidenceImageType = "image/png" | "image/jpeg" | "image/webp";
export type EvidenceMediaReader = (id: string) => Promise<Blob | null>;
export type EvidenceMediaWriter = (blob: Blob) => Promise<string>;

interface EvidencePackageAsset {
  id: string;
  type: EvidenceImageType;
  size: number;
  data: string;
}

interface EvidencePackage {
  format: typeof PACKAGE_FORMAT;
  version: typeof PACKAGE_VERSION;
  document: EconomyDocument;
  assets: EvidencePackageAsset[];
  release: {
    status: "ready" | "draft-noncompliant";
    message: string;
    violations: ReturnType<typeof checkReleaseReadiness>["violations"];
  };
}

const mediaIdPattern = /^media-[0-9a-f]{64}$/;

function mediaError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  error.name = "EvidenceMediaError";
  if (cause !== undefined) (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function assertMediaId(id: string): void {
  if (!mediaIdPattern.test(id))
    throw mediaError(`Invalid evidence media ID: ${id || "(empty)"}.`);
}

function detectedImageType(bytes: Uint8Array): EvidenceImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export async function validateEvidenceImage(
  blob: Blob,
): Promise<EvidenceImageType> {
  if (!(blob instanceof Blob))
    throw mediaError("Evidence media must be a Blob.");
  if (blob.size === 0) throw mediaError("Evidence images cannot be empty.");
  if (blob.size > MAX_EVIDENCE_MEDIA_BYTES)
    throw mediaError("Evidence images must be 5 MB or smaller.");
  if (
    blob.type !== "image/png" &&
    blob.type !== "image/jpeg" &&
    blob.type !== "image/webp"
  )
    throw mediaError("Evidence images must be PNG, JPEG, or WebP files.");

  const detected = detectedImageType(
    new Uint8Array(await blob.slice(0, 12).arrayBuffer()),
  );
  if (detected !== blob.type)
    throw mediaError(
      `Evidence image contents do not match the declared ${blob.type} type.`,
    );
  return blob.type;
}

export async function mediaIdForBlob(blob: Blob): Promise<string> {
  await validateEvidenceImage(blob);
  if (!globalThis.crypto?.subtle)
    throw mediaError("This browser cannot calculate evidence media IDs.");
  let digest: ArrayBuffer;
  try {
    digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  } catch (cause) {
    throw mediaError("Could not calculate the evidence media ID.", cause);
  }
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `media-${hex}`;
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB)
    return Promise.reject(
      mediaError("Private evidence storage is unavailable in this browser."),
    );
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE))
        database.createObjectStore(OBJECT_STORE);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(
        mediaError("Could not open private evidence storage.", request.error),
      );
    request.onblocked = () =>
      reject(
        mediaError(
          "Private evidence storage is blocked by another open app window.",
        ),
      );
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise!;
}

export async function putMedia(blob: Blob): Promise<string> {
  const id = await mediaIdForBlob(blob);
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE, "readwrite");
    transaction.objectStore(OBJECT_STORE).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        mediaError("Could not save the evidence image.", transaction.error),
      );
    transaction.onabort = () =>
      reject(
        mediaError(
          "Saving the evidence image was cancelled.",
          transaction.error,
        ),
      );
  });
  return id;
}

export async function getMedia(id: string): Promise<Blob | null> {
  assertMediaId(id);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE, "readonly");
    const request = transaction.objectStore(OBJECT_STORE).get(id);
    request.onsuccess = () => {
      if (request.result === undefined) return resolve(null);
      if (!(request.result instanceof Blob))
        return reject(mediaError(`Stored evidence image ${id} is corrupted.`));
      resolve(request.result);
    };
    request.onerror = () =>
      reject(mediaError(`Could not read evidence image ${id}.`, request.error));
    transaction.onabort = () =>
      reject(
        mediaError(
          `Reading evidence image ${id} was cancelled.`,
          transaction.error,
        ),
      );
  });
}

function referencedMediaIds(document: EconomyDocument): string[] {
  const evidence = (
    document as EconomyDocument & {
      evidence?: { items?: Array<{ mediaId?: string }> };
    }
  ).evidence;
  if (!evidence) return [];
  return Array.from(
    new Set(
      (evidence.items ?? [])
        .map((item) => item.mediaId)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize)
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  return btoa(binary);
}

function decodedBase64Size(value: string): number {
  if (value.length === 0 || value.length % 4 !== 0)
    throw mediaError("An evidence package contains invalid base64 image data.");

  let padding = 0;
  if (value.endsWith("=")) padding = value.endsWith("==") ? 2 : 1;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index++) {
    const code = value.charCodeAt(index);
    const isAlphabet =
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x30 && code <= 0x39) ||
      code === 0x2b ||
      code === 0x2f;
    if (!isAlphabet)
      throw mediaError(
        "An evidence package contains invalid base64 image data.",
      );
  }
  for (let index = contentLength; index < value.length; index++)
    if (value.charCodeAt(index) !== 0x3d)
      throw mediaError(
        "An evidence package contains invalid base64 image data.",
      );

  return (value.length / 4) * 3 - padding;
}

function base64ToBytes(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch (cause) {
    throw mediaError(
      "An evidence package contains invalid base64 image data.",
      cause,
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function exportEvidencePackageUsing(
  document: EconomyDocument,
  readMedia: EvidenceMediaReader,
): Promise<Blob> {
  const validatedDocument = validateDocument(document);
  const assets: EvidencePackageAsset[] = [];
  let totalSize = 0;

  for (const id of referencedMediaIds(validatedDocument)) {
    assertMediaId(id);
    let blob: Blob | null;
    try {
      blob = await readMedia(id);
    } catch (cause) {
      throw mediaError(
        `Could not read evidence image ${id} for export.`,
        cause,
      );
    }
    if (!blob)
      throw mediaError(
        `Evidence image ${id} is missing. Restore it before exporting this package.`,
      );
    const type = await validateEvidenceImage(blob);
    const actualId = await mediaIdForBlob(blob);
    if (actualId !== id)
      throw mediaError(`Evidence image ${id} failed its integrity check.`);
    totalSize += blob.size;
    if (totalSize > MAX_EVIDENCE_PACKAGE_BYTES)
      throw mediaError(
        "Evidence packages can contain at most 100 MB of images.",
      );
    assets.push({
      id,
      type,
      size: blob.size,
      data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    });
  }

  const payload: EvidencePackage = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    document: validatedDocument,
    assets,
    release: (() => {
      const result = checkReleaseReadiness(validatedDocument);
      return {
        status: result.ready ? "ready" : "draft-noncompliant",
        message: result.ready
          ? "Release-ready economy diagram."
          : "Backup only. Fix the listed economy conventions before sharing, publishing, or final export.",
        violations: result.violations,
      };
    })(),
  };
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
}

export function exportEvidencePackage(
  document: EconomyDocument,
): Promise<Blob> {
  return exportEvidencePackageUsing(document, getMedia);
}

function parsePackage(value: unknown): {
  document: unknown;
  assets: unknown[];
} {
  if (typeof value !== "object" || value === null)
    throw mediaError("This is not an Economy Flow evidence package.");
  const packageValue = value as Record<string, unknown>;
  if (
    packageValue.format !== PACKAGE_FORMAT ||
    packageValue.version !== PACKAGE_VERSION ||
    !Array.isArray(packageValue.assets) ||
    !("document" in packageValue)
  )
    throw mediaError("This is not a supported Economy Flow evidence package.");
  return { document: packageValue.document, assets: packageValue.assets };
}

export async function importEvidencePackageUsing(
  packageBlob: Blob,
  writeMedia: EvidenceMediaWriter,
): Promise<EconomyDocument> {
  if (!(packageBlob instanceof Blob))
    throw mediaError("An evidence package must be provided as a file.");
  if (packageBlob.size > MAX_EVIDENCE_PACKAGE_FILE_BYTES)
    throw mediaError("The evidence package file is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await packageBlob.text());
  } catch (cause) {
    throw mediaError("The evidence package is not valid JSON.", cause);
  }
  const packageValue = parsePackage(parsed);
  if (packageValue.assets.length > MAX_EVIDENCE_PACKAGE_ASSETS)
    throw mediaError("Evidence packages can contain at most 600 images.");

  let document: EconomyDocument;
  try {
    document = validateDocument(packageValue.document);
  } catch (cause) {
    throw mediaError(
      "The evidence package contains an invalid document.",
      cause,
    );
  }

  const preparedAssets: Array<{ id: string; blob: Blob }> = [];
  const seenIds = new Set<string>();
  let totalSize = 0;
  for (const rawAsset of packageValue.assets) {
    if (typeof rawAsset !== "object" || rawAsset === null)
      throw mediaError("The evidence package contains an invalid image entry.");
    const asset = rawAsset as Record<string, unknown>;
    if (
      typeof asset.id !== "string" ||
      typeof asset.type !== "string" ||
      typeof asset.size !== "number" ||
      !Number.isSafeInteger(asset.size) ||
      typeof asset.data !== "string"
    )
      throw mediaError("The evidence package contains an invalid image entry.");
    assertMediaId(asset.id);
    if (seenIds.has(asset.id))
      throw mediaError(`The evidence package repeats image ${asset.id}.`);
    seenIds.add(asset.id);

    const decodedSize = decodedBase64Size(asset.data);
    if (decodedSize !== asset.size)
      throw mediaError(`Evidence image ${asset.id} has an incorrect size.`);
    if (decodedSize > MAX_EVIDENCE_MEDIA_BYTES)
      throw mediaError(`Evidence image ${asset.id} is larger than 5 MB.`);
    totalSize += decodedSize;
    if (totalSize > MAX_EVIDENCE_PACKAGE_BYTES)
      throw mediaError(
        "Evidence packages can contain at most 100 MB of images.",
      );
    const bytes = base64ToBytes(asset.data);
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
      type: asset.type,
    });
    await validateEvidenceImage(blob);
    const actualId = await mediaIdForBlob(blob);
    if (actualId !== asset.id)
      throw mediaError(
        `Evidence image ${asset.id} failed its integrity check.`,
      );
    preparedAssets.push({ id: asset.id, blob });
  }

  for (const id of referencedMediaIds(document)) {
    assertMediaId(id);
    if (!seenIds.has(id))
      throw mediaError(`Evidence image ${id} is missing from the package.`);
  }

  // All document, format, size, content, and integrity checks happen before the
  // first write so a malformed package cannot partially modify local storage.
  for (const asset of preparedAssets) {
    let storedId: string;
    try {
      storedId = await writeMedia(asset.blob);
    } catch (cause) {
      throw mediaError(`Could not import evidence image ${asset.id}.`, cause);
    }
    if (storedId !== asset.id)
      throw mediaError(
        `Evidence image ${asset.id} was stored with the wrong ID.`,
      );
  }
  return document;
}

export function importEvidencePackage(
  packageBlob: Blob,
): Promise<EconomyDocument> {
  return importEvidencePackageUsing(packageBlob, putMedia);
}

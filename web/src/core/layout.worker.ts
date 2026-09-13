import { layoutDocument, measureHeadings, type CardMetrics } from "./layout";
import { validateDocument } from "./document";
self.onmessage = (
  event: MessageEvent<{
    id: number;
    document: unknown;
    metrics: Record<string, CardMetrics>;
    headings: ReturnType<typeof measureHeadings>;
  }>,
) => {
  const { id, document, metrics, headings } = event.data;
  try {
    self.postMessage({
      id,
      layout: layoutDocument(validateDocument(document), metrics, headings),
    });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error
          ? error.message
          : "Unable to lay out this diagram.",
    });
  }
};

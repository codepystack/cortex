/** Maximum characters to include from PDF text to avoid exceeding LLM token limits. */
const MAX_PDF_CHARS = 100_000;

/**
 * Extract all readable text from a PDF File object.
 * Uses a dynamic import so the library is only loaded in the browser
 * (avoiding SSR issues with browser-only APIs like DOMMatrix).
 */
export async function extractPdfText(file: File): Promise<string> {
  // Dynamic import keeps pdfjs-dist out of the server bundle.
  const pdfjsLib = await import("pdfjs-dist");

  // Serve the worker from our own public directory (avoids external CDN dependency).
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join("\n\n");

  if (fullText.length > MAX_PDF_CHARS) {
    return (
      fullText.slice(0, MAX_PDF_CHARS) +
      "\n\n[PDF truncated: content exceeds the maximum allowed length]"
    );
  }

  return fullText;
}

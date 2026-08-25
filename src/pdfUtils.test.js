import { describe, expect, it } from "vitest";
import { extractOcrSegments } from "./pdfUtils";

describe("Tesseract OCR output", () => {
  const word = (text, x0, x1) => ({
    text,
    bbox: { x0, y0: 10, x1, y1: 22 },
  });

  it("reads Tesseract 7 block output", () => {
    const segments = extractOcrSegments({
      blocks: [{
        paragraphs: [{
          lines: [{ words: [word("Paperview", 0, 60), word("OCR", 66, 92)] }],
        }],
      }],
    });

    expect(segments.flatMap((segment) => segment.words).map((entry) => entry.text))
      .toEqual(["Paperview", "OCR"]);
  });

  it("retains compatibility with legacy top-level lines", () => {
    const segments = extractOcrSegments({
      lines: [{ words: [word("Legacy", 0, 40)] }],
    });
    expect(segments[0].words[0].text).toBe("Legacy");
  });
});

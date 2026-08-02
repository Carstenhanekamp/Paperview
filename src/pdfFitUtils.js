/** Compute a PDF.js scale that fits page width into the scroll container. */
export function computeFitWidthScale({
  containerWidth,
  pageWidth,
  horizontalPadding = 36,
  minScale = 0.4,
  maxScale = 4,
} = {}) {
  const width = Number(containerWidth);
  const page = Number(pageWidth);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(page) || page <= 0) {
    return null;
  }
  const available = Math.max(1, width - Math.max(0, Number(horizontalPadding) || 0));
  const scale = available / page;
  return Math.min(maxScale, Math.max(minScale, scale));
}

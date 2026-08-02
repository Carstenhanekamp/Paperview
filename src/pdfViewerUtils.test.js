import { describe, expect, it } from 'vitest';
import {
  computeVisiblePageWindow,
  getWindowAroundPage,
  mergeWindowWithTarget,
} from './pdfViewerUtils';

describe('pdfViewerUtils', () => {
  const pageMetrics = [
    { top: 0, height: 100 },
    { top: 112, height: 100 },
    { top: 224, height: 100 },
    { top: 336, height: 100 },
    { top: 448, height: 100 },
  ];

  it('computes a visible page window with overscan', () => {
    expect(
      computeVisiblePageWindow({
        pageMetrics,
        scrollTop: 120,
        viewportHeight: 160,
        overscanPages: 1,
      })
    ).toEqual({
      startPage: 1,
      endPage: 4,
    });
  });

  it('builds a direct render window around a target page', () => {
    expect(getWindowAroundPage(4, 7, 2)).toEqual({
      startPage: 2,
      endPage: 6,
    });
  });

  it('extends the current render window to cover a jumped-to page', () => {
    expect(
      mergeWindowWithTarget(
        { startPage: 1, endPage: 3 },
        5,
        6,
        1
      )
    ).toEqual({
      startPage: 1,
      endPage: 6,
    });
  });
});

describe('computeFitWidthScale', () => {
  it('fits the page into the available width', async () => {
    const { computeFitWidthScale } = await import('./pdfFitUtils');
    expect(
      computeFitWidthScale({
        containerWidth: 836,
        pageWidth: 612,
        horizontalPadding: 36,
      })
    ).toBeCloseTo(800 / 612, 5);
  });

  it('returns null for invalid sizes', async () => {
    const { computeFitWidthScale } = await import('./pdfFitUtils');
    expect(computeFitWidthScale({ containerWidth: 0, pageWidth: 612 })).toBeNull();
    expect(computeFitWidthScale({ containerWidth: 800, pageWidth: 0 })).toBeNull();
  });

  it('clamps extreme scales', async () => {
    const { computeFitWidthScale } = await import('./pdfFitUtils');
    expect(computeFitWidthScale({ containerWidth: 100, pageWidth: 1000, minScale: 0.4 })).toBe(0.4);
    expect(computeFitWidthScale({ containerWidth: 5000, pageWidth: 100, maxScale: 4 })).toBe(4);
  });
});

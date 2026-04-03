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

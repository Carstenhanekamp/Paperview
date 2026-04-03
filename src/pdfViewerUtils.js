export function getWindowAroundPage(targetPage, totalPages, overscanPages = 2) {
  const total = Math.max(0, Number(totalPages) || 0);
  if (!total) return { startPage: 1, endPage: 0 };

  const page = Math.min(total, Math.max(1, Number(targetPage) || 1));
  const overscan = Math.max(0, Number(overscanPages) || 0);
  return {
    startPage: Math.max(1, page - overscan),
    endPage: Math.min(total, page + overscan),
  };
}

export function computeVisiblePageWindow({
  pageMetrics = [],
  scrollTop = 0,
  viewportHeight = 0,
  overscanPages = 2,
}) {
  if (!Array.isArray(pageMetrics) || !pageMetrics.length) {
    return { startPage: 1, endPage: 0 };
  }

  const viewportTop = Math.max(0, Number(scrollTop) || 0);
  const viewportBottom = viewportTop + Math.max(0, Number(viewportHeight) || 0);
  let firstVisible = null;
  let lastVisible = null;

  pageMetrics.forEach((metric, index) => {
    const top = Number(metric?.top) || 0;
    const height = Number(metric?.height) || 0;
    const bottom = top + height;
    const intersects = bottom >= viewportTop && top <= viewportBottom;
    if (!intersects) return;
    const page = index + 1;
    if (firstVisible == null) firstVisible = page;
    lastVisible = page;
  });

  if (firstVisible == null || lastVisible == null) {
    return getWindowAroundPage(1, pageMetrics.length, overscanPages);
  }

  const overscan = Math.max(0, Number(overscanPages) || 0);
  return {
    startPage: Math.max(1, firstVisible - overscan),
    endPage: Math.min(pageMetrics.length, lastVisible + overscan),
  };
}

export function mergeWindowWithTarget(window, targetPage, totalPages, overscanPages = 2) {
  const targetWindow = getWindowAroundPage(targetPage, totalPages, overscanPages);
  return {
    startPage: Math.min(window?.startPage || targetWindow.startPage, targetWindow.startPage),
    endPage: Math.max(window?.endPage || targetWindow.endPage, targetWindow.endPage),
  };
}

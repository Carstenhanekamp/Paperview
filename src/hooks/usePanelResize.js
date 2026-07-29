import { useCallback, useEffect, useRef, useState } from "react";

export function usePanelResize({ initialWidth, min, max, direction }) {
  const [width, setWidth] = useState(initialWidth);
  const resizeRef = useRef({ active: false, startX: 0, startWidth: initialWidth });
  const configRef = useRef({ min, max, direction });
  configRef.current = { min, max, direction };

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!resizeRef.current.active) return;
      const { min, max, direction } = configRef.current;
      const delta =
        direction === "right"
          ? resizeRef.current.startX - event.clientX
          : event.clientX - resizeRef.current.startX;
      const nextWidth = Math.max(min, Math.min(max, resizeRef.current.startWidth + delta));
      setWidth(nextWidth);
    };
    const onMouseUp = () => {
      if (!resizeRef.current.active) return;
      resizeRef.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startResize = useCallback((event, { enabled = true, startWidth } = {}) => {
    if (!enabled) return;
    resizeRef.current = {
      active: true,
      startX: event.clientX,
      startWidth: startWidth ?? width,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  return { width, setWidth, resizeRef, startResize };
}

import { useEffect } from "react";
import { openExternalUrl } from "../platform/external";
import { isTauri } from "../platform/runtime";

export default function DesktopExternalLinks() {
  useEffect(() => {
    if (!isTauri()) return undefined;
    const handleClick = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.href;
      if (!/^https?:\/\//i.test(href)) return;
      event.preventDefault();
      openExternalUrl(href).catch(() => {});
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

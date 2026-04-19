import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

const STORAGE_KEY = "pv.gate.override.v1";
const BREAKPOINT = 900;

const CSS = `
.pv-gate {
  --bg: #FBFAF7;
  --bg-2: #F3F1EA;
  --surface: #FFFFFF;
  --ink: #0E0E0C;
  --ink-2: #2B2A26;
  --mut: #6B6960;
  --mut-2: #9A9789;
  --line: #E7E4DB;
  --line-2: #D8D3C6;
  --accent: oklch(0.52 0.08 145);
  --accent-ink: oklch(0.35 0.07 145);
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --serif: "Instrument Serif", "Times New Roman", serif;
  --sans: "Inter", -apple-system, system-ui, sans-serif;

  position: fixed; inset: 0;
  z-index: 999;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  display: flex; flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 28px 22px 36px;
}
.pv-gate * { box-sizing: border-box; }

.pv-gate-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: auto;
  padding-bottom: 24px;
}
.pv-gate-logo {
  display: flex; align-items: center; gap: 10px;
  font-weight: 600; font-size: 15px; letter-spacing: -0.01em;
  color: var(--ink);
  text-decoration: none;
  background: none; border: 0; cursor: pointer;
  font-family: inherit; padding: 0;
}
.pv-gate-logo-mark {
  width: 22px; height: 22px; border-radius: 5px;
  background: var(--ink);
  position: relative;
}
.pv-gate-logo-mark::before, .pv-gate-logo-mark::after{
  content:""; position:absolute; inset:4px 5px;
  border-radius: 1px;
  background: #fff;
}
.pv-gate-logo-mark::after{
  inset: 7px 7px auto 7px; height: 1px;
  background: var(--ink); box-shadow: 0 3px 0 0 var(--ink), 0 6px 0 0 var(--ink);
}

.pv-gate-status {
  font-family: var(--mono); font-size: 10.5px;
  color: var(--mut); letter-spacing: 0.14em;
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 8px;
}
.pv-gate-status .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #D88B6A;
  box-shadow: 0 0 0 3px color-mix(in srgb, #D88B6A 20%, transparent);
  animation: pv-gate-pulse 2.4s ease-in-out infinite;
}
@keyframes pv-gate-pulse {
  0%, 100% { opacity: .5; }
  50%      { opacity: 1; }
}

.pv-gate-main {
  display: flex; flex-direction: column; align-items: flex-start;
  max-width: 480px; width: 100%; margin: 0 auto;
  padding: 0;
  animation: pv-gate-in .6s cubic-bezier(.2,.7,.3,1) both;
}
@keyframes pv-gate-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.pv-gate-eyebrow {
  font-family: var(--mono); font-size: 10.5px;
  color: var(--mut); letter-spacing: 0.16em;
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 10px;
  margin-bottom: 28px;
}
.pv-gate-eyebrow::before {
  content: ""; width: 22px; height: 1px; background: var(--mut-2);
}

.pv-gate-stack {
  position: relative;
  width: 120px; height: 90px;
  margin-bottom: 28px;
  align-self: flex-start;
}
.pv-gate-stack .paper {
  position: absolute;
  width: 70px; height: 88px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 9px 7px;
  display: flex; flex-direction: column; gap: 4px;
  box-shadow: 0 8px 18px -12px rgba(20,20,10,.22);
}
.pv-gate-stack .paper::before {
  content: ""; display: block; height: 5px; width: 60%;
  background: var(--ink); border-radius: 1px; margin-bottom: 2px;
}
.pv-gate-stack .paper i {
  display: block; height: 2px; border-radius: 1px;
  background: var(--line-2);
}
.pv-gate-stack .paper i:nth-child(2) { width: 94%; }
.pv-gate-stack .paper i:nth-child(3) { width: 82%; }
.pv-gate-stack .paper i:nth-child(4) { width: 88%; }
.pv-gate-stack .paper i:nth-child(5) { width: 64%; }
.pv-gate-stack .p1 { top: 8px; left: 0; transform: rotate(-8deg); }
.pv-gate-stack .p2 { top: 2px; left: 22px; transform: rotate(-1deg); opacity: .92; }
.pv-gate-stack .p3 { top: 12px; left: 46px; transform: rotate(7deg); }

.pv-gate h1 {
  font-family: var(--serif); font-weight: 400;
  font-size: clamp(34px, 9vw, 46px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin: 0 0 18px;
  color: var(--ink);
  text-wrap: balance;
}
.pv-gate h1 em {
  font-style: italic; color: var(--accent-ink);
}

.pv-gate-lead {
  font-size: 15.5px; line-height: 1.55;
  color: var(--mut); font-weight: 450;
  margin: 0 0 10px;
  max-width: 38ch;
  text-wrap: pretty;
}
.pv-gate-lead strong { color: var(--ink-2); font-weight: 500; }

.pv-gate-sub {
  font-size: 14px; line-height: 1.55;
  color: var(--mut); font-weight: 450;
  margin: 0 0 32px;
  max-width: 40ch;
}

.pv-gate-specs {
  width: 100%;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 16px 0;
  margin-bottom: 28px;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
}
.pv-gate-spec {
  display: flex; flex-direction: column; gap: 3px;
}
.pv-gate-spec-label {
  font-family: var(--mono); font-size: 9.5px;
  color: var(--mut-2); letter-spacing: 0.14em;
  text-transform: uppercase;
}
.pv-gate-spec-value {
  font-family: var(--mono); font-size: 12px;
  color: var(--ink-2); font-weight: 500;
  letter-spacing: -.005em;
}
.pv-gate-spec-value.ok { color: var(--accent-ink); }

.pv-gate-actions {
  display: flex; flex-direction: column; gap: 10px;
  width: 100%;
  margin-bottom: 18px;
}
.pv-gate-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px 20px;
  background: var(--ink); color: #fff;
  border: 1px solid var(--ink);
  border-radius: 999px;
  font-family: inherit; font-size: 14.5px; font-weight: 500;
  letter-spacing: -.005em;
  cursor: pointer; text-decoration: none;
  transition: background .15s ease, transform .15s ease;
}
.pv-gate-btn:hover { background: #222; }
.pv-gate-btn:active { transform: translateY(1px); }
.pv-gate-btn .arr { transition: transform .2s ease; }
.pv-gate-btn:hover .arr { transform: translateX(2px); }

.pv-gate-proceed {
  background: none; border: 0; cursor: pointer;
  font-family: var(--mono); font-size: 11.5px;
  color: var(--mut); letter-spacing: 0.04em;
  padding: 10px 0 2px;
  text-align: left;
  display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none;
  transition: color .15s ease;
  align-self: flex-start;
}
.pv-gate-proceed:hover { color: var(--ink-2); }
.pv-gate-proceed u {
  text-decoration: underline;
  text-decoration-color: var(--mut-2);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.pv-gate-foot {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-family: var(--mono); font-size: 10.5px;
  color: var(--mut); letter-spacing: 0.06em;
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; flex-wrap: wrap;
}
.pv-gate-foot .left { color: var(--mut-2); }
.pv-gate-foot a { color: var(--mut); text-decoration: none; }
.pv-gate-foot a:hover { color: var(--ink-2); }

@media (min-width: 480px) {
  .pv-gate { padding: 36px 32px 44px; }
  .pv-gate-stack { width: 160px; height: 110px; }
  .pv-gate-stack .paper { width: 88px; height: 108px; padding: 11px 9px; }
  .pv-gate-stack .p2 { left: 30px; }
  .pv-gate-stack .p3 { left: 60px; }
  .pv-gate-actions { flex-direction: row; flex-wrap: wrap; align-items: center; }
  .pv-gate-actions .pv-gate-btn { flex: 0 1 auto; }
}
`;

function useInjectStyles() {
  useEffect(() => {
    if (!document.querySelector('link[data-paperview-font]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_URL;
      link.setAttribute("data-paperview-font", "1");
      document.head.appendChild(link);
    }
    if (!document.querySelector('style[data-paperview-gate]')) {
      const style = document.createElement("style");
      style.setAttribute("data-paperview-gate", "1");
      style.textContent = CSS;
      document.head.appendChild(style);
    }
  }, []);
}

function isNarrowViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < BREAKPOINT;
}

function readOverride() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function DesktopGate({ children }) {
  const navigate = useNavigate();
  const [narrow, setNarrow] = useState(isNarrowViewport);
  const [override, setOverride] = useState(readOverride);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = (e) => setNarrow(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  const shouldGate = narrow && !override;
  useInjectStyles();

  if (!shouldGate) return children;

  return <Gate onProceed={() => {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOverride(true);
  }} onHome={() => navigate("/")} />;
}

function Gate({ onProceed, onHome }) {
  const width = typeof window !== "undefined" ? window.innerWidth : 0;

  return (
    <div className="pv-gate" role="dialog" aria-labelledby="pv-gate-title">
      <div className="pv-gate-top">
        <button className="pv-gate-logo" onClick={onHome} aria-label="Back to Paperview home">
          <div className="pv-gate-logo-mark" aria-hidden="true" />
          <span>Paperview</span>
        </button>
        <span className="pv-gate-status">
          <span className="dot" aria-hidden="true" />
          Desk closed
        </span>
      </div>

      <div className="pv-gate-main">
        <span className="pv-gate-eyebrow">Viewport notice</span>

        <div className="pv-gate-stack" aria-hidden="true">
          <div className="paper p1"><i /><i /><i /><i /><i /></div>
          <div className="paper p2"><i /><i /><i /><i /><i /></div>
          <div className="paper p3"><i /><i /><i /><i /><i /></div>
        </div>

        <h1 id="pv-gate-title">
          Paperview is a <em>desk</em>,<br />not a pocket.
        </h1>
        <p className="pv-gate-lead">
          Reading PDFs, margin notes, and cited chat side-by-side needs real
          screen real estate. <strong>Open this on a laptop or desktop.</strong>
        </p>
        <p className="pv-gate-sub">
          Everything stays local — just bookmark the page and come back when
          you're at a bigger screen.
        </p>

        <div className="pv-gate-specs">
          <div className="pv-gate-spec">
            <span className="pv-gate-spec-label">Your viewport</span>
            <span className="pv-gate-spec-value">{width || "—"}px wide</span>
          </div>
          <div className="pv-gate-spec">
            <span className="pv-gate-spec-label">Recommended</span>
            <span className="pv-gate-spec-value ok">≥ {BREAKPOINT}px</span>
          </div>
        </div>

        <div className="pv-gate-actions">
          <button className="pv-gate-btn" onClick={onHome}>
            Back to home <span className="arr">→</span>
          </button>
        </div>

        <button className="pv-gate-proceed" onClick={onProceed}>
          <u>Continue anyway</u> &nbsp;— I know it will be cramped
        </button>
      </div>

      <div className="pv-gate-foot">
        <span className="left">© {new Date().getFullYear()} Paperview</span>
        <a href="https://github.com/Carstenhanekamp/Paperview/" target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

const GITHUB_URL = "https://github.com/Carstenhanekamp/Paperview/";
const GITHUB_REPO = "Carstenhanekamp/paperview";
const OPENAI_KEY_URL = "https://platform.openai.com/api-keys";
const STAR_CACHE_KEY = "pv.gh.stars.v1";
const STAR_CACHE_TTL = 60 * 60 * 1000;

const CSS = `
:root {
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
  --accent-2: oklch(0.92 0.03 145);
  --accent-ink: oklch(0.35 0.07 145);
  --radius: 14px;
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --serif: "Instrument Serif", "Times New Roman", serif;
  --sans: "Inter", -apple-system, system-ui, sans-serif;
}

.pv-landing, .pv-landing * { box-sizing: border-box; }
.pv-landing {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01", "cv11";
  line-height: 1.5;
  min-height: 100vh;
}
.pv-landing a { color: inherit; }

.pv-landing .nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 32px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: saturate(140%) blur(10px);
  -webkit-backdrop-filter: saturate(140%) blur(10px);
  border-bottom: 1px solid transparent;
  gap: 12px;
}
@media (max-width: 640px) {
  .pv-landing .nav { padding: 14px 18px; gap: 10px; }
  .pv-landing .nav-right { gap: 10px; }
  .pv-landing .nav-right .nav-link { display: none; }
  .pv-landing .nav-cta { padding: 8px 13px; font-size: 13px; }
}
.pv-landing .nav.scrolled { border-bottom-color: var(--line); }
.pv-landing .logo {
  display: flex; align-items: center; gap: 10px;
  font-weight: 600; font-size: 16px; letter-spacing: -0.01em;
}
.pv-landing .logo-mark {
  width: 22px; height: 22px; border-radius: 5px;
  background: var(--ink);
  display: grid; place-items: center;
  position: relative;
}
.pv-landing .logo-mark::before, .pv-landing .logo-mark::after{
  content:""; position:absolute; inset:4px 5px;
  border-radius: 1px;
  background: #fff;
}
.pv-landing .logo-mark::after{
  inset: 7px 7px auto 7px; height: 1px;
  background: var(--ink); box-shadow: 0 3px 0 0 var(--ink), 0 6px 0 0 var(--ink);
}
.pv-landing .nav-right { display: flex; align-items: center; gap: 22px; }
.pv-landing .nav-link {
  font-size: 14px; color: var(--ink-2); text-decoration: none; font-weight: 450;
  background: none; border: 0; cursor: pointer; font-family: inherit; padding: 0;
}
.pv-landing .nav-link:hover { color: var(--ink); }
.pv-landing .nav-cta {
  background: var(--ink); color: #fff; border: 0;
  padding: 9px 16px; font-size: 13.5px; font-weight: 500;
  border-radius: 999px; cursor: pointer; font-family: inherit;
  letter-spacing: -0.005em;
  transition: transform .15s ease, background .15s ease;
}
.pv-landing .nav-cta:hover { background: #222; }

/* GitHub star pill — editorial, split-face design */
.pv-landing .gh-star {
  display: inline-flex; align-items: stretch;
  height: 30px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  text-decoration: none;
  background: var(--surface);
  overflow: hidden;
  transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
  position: relative;
}
.pv-landing .gh-star:hover {
  border-color: var(--ink-2);
  box-shadow: 0 4px 14px -8px rgba(20,20,10,.22);
}
.pv-landing .gh-star-face {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 0 11px 0 12px;
  font-size: 12.5px; color: var(--ink-2); font-weight: 500;
  letter-spacing: -0.003em;
  transition: color .2s ease;
}
.pv-landing .gh-star:hover .gh-star-face { color: var(--ink); }
.pv-landing .gh-star-face svg { width: 13px; height: 13px; display: block; }
.pv-landing .gh-star-sep {
  width: 1px; background: var(--line-2);
  align-self: stretch;
}
.pv-landing .gh-star-count {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 13px 0 11px;
  font-family: var(--mono);
  font-size: 12px; color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  position: relative;
  transition: color .2s ease;
}
.pv-landing .gh-star:hover .gh-star-count { color: var(--accent-ink); }
.pv-landing .gh-star-icon {
  width: 11px; height: 11px;
  color: var(--mut-2);
  transition: color .25s ease, transform .4s cubic-bezier(.3,1.4,.5,1);
}
.pv-landing .gh-star:hover .gh-star-icon {
  color: #D9A43A;
  transform: rotate(72deg) scale(1.12);
}
.pv-landing .gh-star-count .num {
  display: inline-block;
  transition: opacity .18s ease;
}
.pv-landing .gh-star-count.is-loading .num { opacity: .35; }
.pv-landing .gh-star-count.is-loading .gh-star-icon {
  animation: gh-star-pulse 1.4s ease-in-out infinite;
}
@keyframes gh-star-pulse {
  0%, 100% { opacity: .45; }
  50%      { opacity: 1; }
}
.pv-landing .gh-star-reveal {
  animation: gh-star-fade .5s ease both;
}
@keyframes gh-star-fade {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Footer variant — quieter, inline */
.pv-landing .gh-star-inline {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 12px;
  color: var(--mut);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  transition: color .2s ease, border-color .2s ease;
}
.pv-landing .gh-star-inline:hover {
  color: var(--ink); border-color: var(--line-2);
}
.pv-landing .gh-star-inline svg { width: 11px; height: 11px; color: var(--mut-2); }
.pv-landing .gh-star-inline:hover svg { color: #D9A43A; }

@media (max-width: 640px) {
  .pv-landing .gh-star-face .lbl { display: none; }
  .pv-landing .gh-star-face { padding: 0 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .pv-landing .gh-star-count.is-loading .gh-star-icon { animation: none; }
  .pv-landing .gh-star-reveal { animation: none; }
  .pv-landing .gh-star:hover .gh-star-icon { transform: none; }
}
.pv-landing .nav-cta .arr,
.pv-landing .btn .arr { display: inline-block; transition: transform .2s ease; margin-left: 4px; }
.pv-landing .nav-cta:hover .arr,
.pv-landing .btn:hover .arr { transform: translateX(2px); }

.pv-landing .hero {
  position: relative;
  padding: 72px 24px 0;
  text-align: center;
  overflow: hidden;
}
@media (max-width: 640px) {
  .pv-landing .hero { padding: 48px 18px 0; }
  .pv-landing .hero-sub { font-size: 16px; margin-bottom: 28px; }
  .pv-landing .hero-spacer { height: 48px; }
  .pv-landing h1.hero-title { margin-bottom: 32px; }
  .pv-landing .cta-row { width: 100%; }
  .pv-landing .cta-row .btn { flex: 1 1 auto; justify-content: center; }
}
.pv-landing .eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 500; color: var(--mut);
  letter-spacing: 0.02em;
  padding: 6px 12px 6px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  margin-bottom: 28px;
}
.pv-landing .eyebrow .pill-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
.pv-landing .eyebrow strong { color: var(--ink-2); font-weight: 500; }

.pv-landing h1.hero-title {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(44px, 6.8vw, 88px);
  line-height: 1.12;
  letter-spacing: -0.022em;
  margin: 0 auto 48px;
  max-width: 15ch;
  color: var(--ink);
  padding-bottom: 0.12em;
}
.pv-landing h1.hero-title .ital { font-style: italic; color: var(--accent-ink); }

.pv-landing .hero-sub {
  max-width: 58ch;
  margin: 0 auto 36px;
  font-size: 17.5px;
  line-height: 1.55;
  color: var(--mut);
  font-weight: 450;
  text-wrap: balance;
}
.pv-landing .hero-sub strong { color: var(--ink-2); font-weight: 500; }

.pv-landing .cta-row {
  display: inline-flex; gap: 10px; flex-wrap: wrap; justify-content: center;
  margin-bottom: 18px;
}
.pv-landing .btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: inherit; font-size: 14.5px; font-weight: 500;
  padding: 12px 20px;
  border-radius: 999px; border: 1px solid transparent; cursor: pointer;
  letter-spacing: -0.005em;
  text-decoration: none;
  transition: transform .15s ease, background .15s ease, border-color .15s ease;
}
.pv-landing .btn-primary { background: var(--ink); color: #fff; }
.pv-landing .btn-primary:hover { background: #222; }
.pv-landing .btn-ghost {
  background: transparent; color: var(--ink-2); border-color: var(--line-2);
}
.pv-landing .btn-ghost:hover { border-color: var(--ink-2); color: var(--ink); }
.pv-landing .btn-github {
  background: #0E0E0C; color: #F6F4ED; border-color: #0E0E0C;
}
.pv-landing .btn-github:hover { background: #1c1c19; border-color: #1c1c19; }
.pv-landing .btn-github svg { width: 15px; height: 15px; }
.pv-landing .btn-github .gh-count {
  display: inline-flex; align-items: center; gap: 4px;
  margin-left: 4px; padding-left: 10px;
  border-left: 1px solid rgba(246,244,237,.22);
  font-family: var(--mono); font-size: 12.5px;
  color: rgba(246,244,237,.82);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.pv-landing .btn-github .gh-count svg {
  width: 11px; height: 11px; color: #E9B766;
}

.pv-landing .hero-spacer { height: 72px; }

.pv-landing .hero-art {
  position: absolute; inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.pv-landing .hero-art .grid-bg {
  position: absolute; inset: -20% -10% auto -10%; height: 90%;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at 50% 35%, #000 0%, transparent 65%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 35%, #000 0%, transparent 65%);
  opacity: 0.6;
}
.pv-landing .hero > * { position: relative; z-index: 1; }

.pv-landing .paper {
  position: absolute;
  width: 150px; height: 200px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: 0 18px 40px -20px rgba(20,20,10,.18), 0 2px 6px -2px rgba(20,20,10,.08);
  padding: 14px 12px;
  display: flex; flex-direction: column; gap: 6px;
  overflow: hidden;
}
.pv-landing .paper::before {
  content:""; display:block; height: 8px; width: 60%;
  background: var(--ink); border-radius: 2px; margin-bottom: 4px;
}
.pv-landing .paper i {
  display: block; height: 3px; border-radius: 2px; background: var(--line-2);
}
.pv-landing .paper i:nth-child(2) { width: 94%; }
.pv-landing .paper i:nth-child(3) { width: 88%; }
.pv-landing .paper i:nth-child(4) { width: 76%; }
.pv-landing .paper i:nth-child(5) { width: 92%; }
.pv-landing .paper i:nth-child(6) { width: 64%; }
.pv-landing .paper i:nth-child(7) { width: 84%; }
.pv-landing .paper i:nth-child(8) { width: 48%; opacity: .5; }

.pv-landing .paper.p1 { top: 60px;  left: 7%;  transform: rotate(-9deg); }
.pv-landing .paper.p2 { top: 110px; left: 16%; transform: rotate(-3deg); opacity: .85; }
.pv-landing .paper.p3 { top: 80px;  right: 8%; transform: rotate(8deg); }
.pv-landing .paper.p4 { top: 160px; right: 17%; transform: rotate(2deg); opacity: .85; }

@media (max-width: 900px) {
  .pv-landing .paper.p2, .pv-landing .paper.p4 { display: none; }
  .pv-landing .paper.p1 { left: -4%; top: 30px; }
  .pv-landing .paper.p3 { right: -4%; top: 40px; }
}
@media (max-width: 640px) {
  .pv-landing .paper { display: none; }
}

.pv-landing .mockup-wrap {
  max-width: 1180px; margin: 0 auto; padding: 0 24px 96px;
  position: relative;
}
.pv-landing .mockup-wrap::before {
  content: "";
  position: absolute; left: 10%; right: 10%; top: 70%; bottom: -20px;
  background: radial-gradient(ellipse at center, rgba(20,20,10,.18), transparent 70%);
  filter: blur(30px);
  z-index: 0;
}
.pv-landing .mockup {
  position: relative; z-index: 1;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 1px 0 rgba(255,255,255,.5) inset,
    0 40px 80px -40px rgba(20,20,10,.28),
    0 8px 20px -8px rgba(20,20,10,.08);
}
.pv-landing .win-bar {
  height: 34px;
  background: #F6F4EF;
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; padding: 0 14px;
  gap: 7px;
}
.pv-landing .win-dot { width: 11px; height: 11px; border-radius: 50%; background: #D9D4C7; }
.pv-landing .win-dot.r { background: #E87C6E; }
.pv-landing .win-dot.y { background: #E9B766; }
.pv-landing .win-dot.g { background: #7DB08A; }
.pv-landing .win-title {
  margin-left: 14px; font-family: var(--mono); font-size: 11px; color: var(--mut);
  letter-spacing: 0.01em;
}

.pv-landing .app {
  display: grid;
  grid-template-columns: 232px 1fr 300px;
  height: 520px;
  font-size: 12px;
}

.pv-landing .side {
  border-right: 1px solid var(--line);
  background: #FAF8F3;
  display: flex; flex-direction: column;
}
.pv-landing .side-head {
  padding: 14px 14px 8px;
  display: flex; align-items: center; justify-content: space-between;
}
.pv-landing .side-brand {
  display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;
}
.pv-landing .side-brand .mini {
  width: 16px; height: 16px; border-radius: 4px; background: var(--ink);
}
.pv-landing .side-close { color: var(--mut); font-size: 14px; }
.pv-landing .side-nav { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.pv-landing .side-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 6px;
  color: var(--ink-2); font-weight: 450;
}
.pv-landing .side-item .ico { width: 14px; height: 14px; color: var(--mut); }
.pv-landing .side-item.active { background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--ink); font-weight: 500; }

.pv-landing .side-search {
  margin: 10px 12px 6px;
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--mut-2); font-size: 11.5px;
}

.pv-landing .side-folders-head {
  padding: 10px 16px 6px; font-size: 10.5px; color: var(--mut);
  text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;
}
.pv-landing .folder {
  padding: 5px 12px 5px 14px;
  color: var(--ink-2); font-weight: 500;
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px;
}
.pv-landing .folder .chev { color: var(--mut); font-size: 9px; }
.pv-landing .folder .count { margin-left: auto; color: var(--mut-2); font-size: 10.5px; }
.pv-landing .files { padding: 0 12px 6px 28px; display: flex; flex-direction: column; }
.pv-landing .file {
  font-size: 11px; color: var(--mut); padding: 4px 8px;
  border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv-landing .file.active {
  background: var(--accent-2); color: var(--accent-ink); font-weight: 500;
}
.pv-landing .side-foot {
  margin-top: auto; border-top: 1px solid var(--line);
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
  background: #0E0E0C; color: #EDEAE0;
}
.pv-landing .side-api {
  display: flex; align-items: center; gap: 8px; font-family: var(--mono);
  font-size: 10.5px;
}
.pv-landing .side-api .gdot { width:6px; height:6px; border-radius: 50%; background: #6FCF97; }
.pv-landing .side-btn {
  display:flex; align-items:center; gap: 8px;
  padding: 7px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 500;
  background: rgba(255,255,255,.06); color: #fff;
}
.pv-landing .side-btn.ghost { background: transparent; color: rgba(255,255,255,.72); font-weight: 450;}

.pv-landing .reader { display: flex; flex-direction: column; background: #EEEBE3; }
.pv-landing .reader-top {
  display: flex; align-items: center; padding: 10px 14px;
  background: var(--surface); border-bottom: 1px solid var(--line);
  gap: 10px;
}
.pv-landing .doc-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; background: var(--bg-2); border-radius: 6px;
  font-size: 11.5px; color: var(--ink-2); font-weight: 500;
}
.pv-landing .doc-chip .x { color: var(--mut); margin-left: 4px; }
.pv-landing .reader-tools { margin-left: auto; display: flex; align-items: center; gap: 10px; color: var(--mut); font-size: 11px; }
.pv-landing .reader-tools .tool { padding: 4px 6px; border-radius: 5px; }
.pv-landing .pages { padding: 18px 20px; font-size: 11px; color: var(--mut-2); text-align: center; }
.pv-landing .reader-canvas { flex: 1; padding: 0 16px 16px; display: flex; align-items: stretch; justify-content: center; overflow: hidden; }
.pv-landing .page {
  width: 100%;
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.03), 0 18px 40px -20px rgba(0,0,0,.15);
  padding: 32px 44px;
  font-size: 10.5px;
  line-height: 1.5;
  color: #2B2A26;
  position: relative;
  display: flex; flex-direction: column;
}
.pv-landing .page-meta {
  text-align:center; font-size: 8px; letter-spacing: .12em;
  color: var(--mut); text-transform: uppercase;
  border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-bottom: 14px;
}
.pv-landing .page-title {
  font-family: var(--serif); font-size: 22px; line-height: 1.12;
  font-weight: 400; margin: 10px 0 12px; letter-spacing: -0.012em;
}
.pv-landing .page-authors { font-size: 10px; color: var(--mut); margin-bottom: 18px; }
.pv-landing .page-section {
  font-size: 9.5px; letter-spacing: .22em; text-align: center; color: var(--ink-2);
  font-weight: 600; margin: 14px 0 10px;
}
.pv-landing .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; flex: 1; }
.pv-landing .lines i { display:block; height: 4px; background: #E3DFD5; border-radius: 1px; margin-bottom: 5px; }
.pv-landing .lines i:nth-child(5n) { width: 72%; }
.pv-landing .lines i:nth-child(3n) { width: 88%; }
.pv-landing .lines i:nth-child(7n) { width: 95%; }
.pv-landing .hl {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--accent) 55%, transparent);
  padding: 0 2px; border-radius: 1px;
  height: 4px; display:block; margin-bottom: 5px;
}

.pv-landing .chat {
  border-left: 1px solid var(--line);
  background: var(--surface);
  display: flex; flex-direction: column;
}
.pv-landing .chat-head {
  padding: 12px 14px; border-bottom: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 2px;
}
.pv-landing .chat-title { font-size: 12.5px; font-weight: 600; letter-spacing: -.01em; }
.pv-landing .chat-sub { font-size: 10.5px; color: var(--mut); }
.pv-landing .chat-body {
  flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 10px;
  overflow: hidden;
}
.pv-landing .msg-user {
  align-self: flex-end; background: var(--ink); color: #fff;
  padding: 8px 11px; border-radius: 12px 12px 4px 12px;
  font-size: 11px; max-width: 85%;
}
.pv-landing .msg-ai {
  align-self: flex-start; background: var(--bg-2);
  padding: 10px 12px; border-radius: 12px 12px 12px 4px;
  font-size: 11px; max-width: 92%; color: var(--ink-2); line-height: 1.5;
}
.pv-landing .cite {
  display: inline-flex; align-items: center;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-ink);
  font-family: var(--mono); font-size: 9.5px; font-weight: 500;
  padding: 0 5px; border-radius: 4px; margin: 0 1px;
  vertical-align: 1px;
}
.pv-landing .msg-ai .src-row {
  margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;
}
.pv-landing .src-chip {
  display:inline-flex; align-items:center; gap: 6px;
  padding: 3px 7px; border: 1px solid var(--line); border-radius: 999px;
  font-size: 10px; color: var(--mut); background: var(--surface);
}
.pv-landing .src-chip .pg { color: var(--accent-ink); font-family: var(--mono); }
.pv-landing .chat-input-form {
  margin: 8px 12px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.pv-landing .chat-input-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 6px 6px 12px;
  border: 1px solid var(--line); border-radius: 12px;
  background: var(--surface);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.pv-landing .chat-input-bar:focus-within {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}
.pv-landing .chat-input-bar input {
  flex: 1; border: 0; outline: 0; background: transparent;
  font-family: inherit; font-size: 11.5px; color: var(--ink);
  padding: 4px 0;
}
.pv-landing .chat-input-bar input::placeholder { color: var(--mut-2); }
.pv-landing .send-btn {
  width: 24px; height: 24px; border-radius: 8px; border: 0;
  background: var(--ink); color: #fff; font-size: 13px; line-height: 1;
  cursor: pointer; display: grid; place-items: center;
  font-family: inherit;
}
.pv-landing .chat-input-meta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px;
}
.pv-landing .chat-input-meta .model {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10px; color: var(--mut);
  padding: 2px 7px; border: 1px solid var(--line); border-radius: 6px;
  background: var(--bg);
}
.pv-landing .chat-input-meta .ctx {
  font-size: 10.5px; color: var(--mut);
}

@media (max-width: 1080px) {
  .pv-landing .app { grid-template-columns: 200px 1fr 260px; height: 460px; }
}
@media (max-width: 860px) {
  .pv-landing .app { grid-template-columns: 1fr; height: auto; }
  .pv-landing .side, .pv-landing .chat { display: none; }
  .pv-landing .reader-canvas { padding: 0 12px 12px; }
  .pv-landing .page { padding: 24px 22px; }
}
@media (max-width: 640px) {
  .pv-landing .mockup-wrap { padding: 0 14px 56px; }
  .pv-landing .cols { grid-template-columns: 1fr; gap: 10px; }
  .pv-landing .page { padding: 20px 18px; }
  .pv-landing .page-title { font-size: 18px; }
  .pv-landing .reader-top { padding: 8px 10px; flex-wrap: wrap; gap: 8px; }
  .pv-landing .reader-tools { font-size: 10px; gap: 6px; }
  .pv-landing .win-title { font-size: 10px; margin-left: 8px; }
}

.pv-landing .rule {
  max-width: 1180px; margin: 0 auto;
  border-top: 1px solid var(--line);
}

/* ── Repo strip ── editorial section-divider with live GitHub data */
.pv-landing .repo-strip {
  max-width: 1180px; margin: 0 auto;
  padding: 28px 24px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 32px;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.pv-landing .repo-strip::before {
  content: "";
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: -1px -1px;
  mask-image: radial-gradient(ellipse 60% 120% at 85% 50%, #000 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 60% 120% at 85% 50%, #000 0%, transparent 70%);
  opacity: 0.5;
  pointer-events: none;
}
.pv-landing .repo-strip > * { position: relative; z-index: 1; }

.pv-landing .repo-strip-left {
  display: flex; align-items: center; gap: 18px;
}
.pv-landing .repo-mark {
  width: 44px; height: 44px; border-radius: 10px;
  background: var(--ink); color: #F6F4ED;
  display: grid; place-items: center;
  flex-shrink: 0;
  box-shadow: 0 6px 14px -8px rgba(20,20,10,.3);
}
.pv-landing .repo-mark svg { width: 22px; height: 22px; }

.pv-landing .repo-path {
  display: flex; flex-direction: column; gap: 3px;
  min-width: 0;
}
.pv-landing .repo-path-label {
  font-family: var(--mono); font-size: 10.5px;
  color: var(--mut); letter-spacing: 0.14em;
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 8px;
}
.pv-landing .repo-path-label::after {
  content: ""; width: 14px; height: 1px; background: var(--mut-2);
}
.pv-landing .repo-path-name {
  font-family: var(--mono); font-size: 14.5px;
  color: var(--ink); font-weight: 500;
  letter-spacing: -0.005em;
}
.pv-landing .repo-path-name .owner { color: var(--mut); }
.pv-landing .repo-path-name .slash { color: var(--mut-2); margin: 0 1px; }

.pv-landing .repo-strip-center {
  display: flex; align-items: center; gap: 22px;
  justify-content: center;
  flex-wrap: wrap;
}
.pv-landing .repo-stat {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
  padding: 0 18px;
  border-left: 1px solid var(--line);
  min-width: 0;
}
.pv-landing .repo-stat:first-child { border-left: 0; padding-left: 0; }
.pv-landing .repo-stat-num {
  font-family: var(--serif); font-weight: 400;
  font-size: 34px; line-height: 1; color: var(--ink);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  display: inline-flex; align-items: baseline; gap: 5px;
}
.pv-landing .repo-stat-num .k {
  font-size: 18px; color: var(--mut); font-style: italic;
  letter-spacing: -0.01em;
}
.pv-landing .repo-stat-num.is-star { color: var(--accent-ink); }
.pv-landing .repo-stat-num.is-loading {
  color: var(--mut); font-style: italic; opacity: .7;
}
.pv-landing .repo-stat-label {
  font-family: var(--mono); font-size: 10px;
  color: var(--mut); letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-top: 2px;
}

.pv-landing .repo-strip-right {
  display: flex; align-items: center;
}
.pv-landing .repo-cta {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 11px 18px;
  background: var(--ink); color: #F6F4ED;
  border-radius: 999px;
  font-size: 13.5px; font-weight: 500;
  letter-spacing: -0.005em;
  text-decoration: none;
  transition: background .2s ease, transform .2s ease;
}
.pv-landing .repo-cta:hover { background: #1c1c19; }
.pv-landing .repo-cta svg { width: 14px; height: 14px; }
.pv-landing .repo-cta .arr {
  display: inline-block; transition: transform .2s ease;
}
.pv-landing .repo-cta:hover .arr { transform: translate(2px, -2px); }

.pv-landing .repo-meta-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-family: var(--mono); font-size: 10.5px;
  color: var(--mut); letter-spacing: 0.01em;
}
.pv-landing .repo-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
}
.pv-landing .repo-chip .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}
.pv-landing .repo-chip.lang .dot { background: #F1E05A; box-shadow: 0 0 0 2px rgba(241,224,90,0.2); }

@media (max-width: 900px) {
  .pv-landing .repo-strip {
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 28px 24px;
    text-align: left;
  }
  .pv-landing .repo-strip-center { justify-content: flex-start; gap: 14px; }
  .pv-landing .repo-stat { padding: 0 14px; }
  .pv-landing .repo-stat:first-child { padding-left: 0; }
  .pv-landing .repo-strip-right { justify-content: flex-start; }
  .pv-landing .repo-strip::before {
    mask-image: radial-gradient(ellipse 90% 100% at 100% 100%, #000 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 90% 100% at 100% 100%, #000 0%, transparent 70%);
  }
}
@media (max-width: 640px) {
  .pv-landing .repo-strip { padding: 22px 18px; gap: 16px; }
  .pv-landing .repo-strip-center {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 18px;
    align-items: start;
  }
  .pv-landing .repo-stat { padding: 0; border-left: 0; }
  .pv-landing .repo-stat:nth-child(3) {
    grid-column: 1 / -1;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .pv-landing .repo-meta-row { gap: 6px; }
  .pv-landing .repo-mark { width: 38px; height: 38px; }
  .pv-landing .repo-mark svg { width: 18px; height: 18px; }
}
@media (max-width: 520px) {
  .pv-landing .repo-stat-num { font-size: 28px; }
  .pv-landing .repo-mark { width: 40px; height: 40px; }
  .pv-landing .repo-path-name { font-size: 13px; }
  .pv-landing .repo-cta { padding: 10px 16px; font-size: 13px; }
}
.pv-landing .section {
  max-width: 1180px; margin: 0 auto;
  padding: 96px 24px;
}
@media (max-width: 820px) {
  .pv-landing .section { padding: 64px 20px; }
  .pv-landing .section-head { margin-bottom: 36px; }
}
@media (max-width: 640px) {
  .pv-landing .section { padding: 52px 18px; }
  .pv-landing .section-head { margin-bottom: 28px; }
}
.pv-landing .section-head {
  display: grid; grid-template-columns: 1fr 2fr; gap: 48px;
  align-items: end; margin-bottom: 56px;
}
@media (max-width: 820px) { .pv-landing .section-head { grid-template-columns: 1fr; gap: 20px; align-items: start;} }

.pv-landing .section-label {
  font-family: var(--mono);
  font-size: 11px; color: var(--mut);
  letter-spacing: 0.14em; text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 10px;
}
.pv-landing .section-label::before {
  content: ""; width: 18px; height: 1px; background: var(--mut-2);
}

.pv-landing h2 {
  font-family: var(--serif); font-weight: 400;
  font-size: clamp(34px, 4.2vw, 52px);
  line-height: 1.02;
  letter-spacing: -0.018em;
  margin: 14px 0 0; color: var(--ink);
  max-width: 20ch;
  text-wrap: balance;
}
.pv-landing h2 em { color: var(--accent-ink); font-style: italic; }

.pv-landing .section-sub {
  font-size: 16px; color: var(--mut); line-height: 1.55; font-weight: 450;
  max-width: 46ch; text-wrap: pretty;
}

.pv-landing .features {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 16px; overflow: hidden;
}
.pv-landing .feat {
  grid-column: span 2;
  background: var(--surface);
  padding: 32px 28px 32px;
  position: relative;
  min-height: 280px;
  display: flex; flex-direction: column;
}
.pv-landing .feat.wide { grid-column: span 3; }
.pv-landing .feat.lead { grid-column: span 3; background: #0E0E0C; color: #F6F4ED; }
.pv-landing .feat.lead .feat-label { color: rgba(246,244,237,.55); }
.pv-landing .feat.lead h3 { color: #F6F4ED; }
.pv-landing .feat.lead p { color: rgba(246,244,237,.72); }

.pv-landing .feat-label {
  font-family: var(--mono); font-size: 10.5px; color: var(--mut);
  text-transform: uppercase; letter-spacing: 0.14em;
  display: inline-flex; align-items: center; gap: 8px;
  margin-bottom: 16px;
}
.pv-landing .feat-num { font-variant-numeric: tabular-nums; }
.pv-landing .feat h3 {
  font-family: var(--serif); font-weight: 400;
  font-size: 28px; line-height: 1.16; letter-spacing: -0.012em;
  margin: 0 0 16px;
  color: var(--ink);
  max-width: 18ch;
}
.pv-landing .feat p {
  font-size: 14px; color: var(--mut); line-height: 1.55;
  margin: 0; font-weight: 450; max-width: 42ch;
}
.pv-landing .feat-visual { margin-top: auto; padding-top: 24px; }

.pv-landing .key-vis {
  font-family: var(--mono); font-size: 11px;
  display: flex; flex-direction: column; gap: 8px;
  color: rgba(246,244,237,.85);
}
.pv-landing .key-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
}
.pv-landing .key-row .lbl { color: rgba(246,244,237,.5); }
.pv-landing .key-row .val { margin-left: auto; color: #C9E4CE; }

.pv-landing .priv-vis {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px;
  align-items: center;
}
.pv-landing .priv-col {
  border: 1px solid var(--line); border-radius: 10px;
  padding: 14px 12px; background: var(--bg);
  display: flex; flex-direction: column; gap: 7px;
}
.pv-landing .priv-col .head { font-size: 10.5px; font-weight: 600; color: var(--ink-2); margin-bottom: 2px; letter-spacing: -.005em;}
.pv-landing .priv-col .itm {
  font-size: 11px; color: var(--mut); display: flex; gap: 6px; align-items: flex-start;
}
.pv-landing .priv-col .itm::before {
  content: ""; width: 6px; height: 6px; margin-top: 5px;
  border-radius: 50%; background: var(--accent);
  flex-shrink: 0;
}
.pv-landing .priv-col.off .itm::before { background: #D88B6A; }
.pv-landing .priv-arrow {
  font-family: var(--mono); color: var(--mut-2); font-size: 10px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.pv-landing .priv-arrow .line { width: 24px; height: 1px; background: var(--mut-2); }
@media (max-width: 640px) {
  .pv-landing .priv-vis { grid-template-columns: 1fr; gap: 10px; }
  .pv-landing .priv-arrow { flex-direction: row; gap: 8px; padding: 4px 0; }
  .pv-landing .priv-arrow .line { width: 40px; }
}

.pv-landing .chat-vis {
  border: 1px solid var(--line); border-radius: 10px;
  padding: 12px; background: var(--bg);
  display: flex; flex-direction: column; gap: 8px;
  font-size: 11px;
}
.pv-landing .chat-vis .q {
  align-self: flex-end; background: var(--ink); color: #fff;
  padding: 6px 10px; border-radius: 10px 10px 3px 10px;
  max-width: 80%;
}
.pv-landing .chat-vis .a {
  background: var(--surface); border: 1px solid var(--line);
  padding: 8px 10px; border-radius: 10px 10px 10px 3px;
  color: var(--ink-2); max-width: 92%;
  line-height: 1.45;
}

.pv-landing .search-vis {
  border: 1px solid var(--line); border-radius: 10px; background: var(--bg);
  padding: 10px 12px; font-family: var(--mono); font-size: 11px; color: var(--ink-2);
  display: flex; flex-direction: column; gap: 6px;
}
.pv-landing .search-vis .q { color: var(--mut); }
.pv-landing .search-vis .hit {
  display:flex; gap: 8px; font-size: 10.5px; align-items: baseline;
}
.pv-landing .search-vis .hit .p { color: var(--accent-ink); }
.pv-landing .search-vis .hit mark {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--ink); padding: 0 3px; border-radius: 2px;
}

.pv-landing .ann-vis {
  border: 1px solid var(--line); border-radius: 10px; background: var(--surface);
  padding: 14px; display: flex; flex-direction: column; gap: 6px;
  position: relative;
}
.pv-landing .ann-vis .tl { display: block; height: 4px; border-radius: 2px; background: var(--bg-2);}
.pv-landing .ann-vis .tl.w1 { width: 94%; }
.pv-landing .ann-vis .tl.w2 { width: 82%; }
.pv-landing .ann-vis .tl.w3 { width: 90%; }
.pv-landing .ann-vis .tl.hl {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  position: relative;
}
.pv-landing .ann-vis .note {
  margin-top: 8px;
  align-self: flex-end; max-width: 60%;
  background: #FFF9E8; border: 1px solid #EBDFAF;
  font-size: 10.5px; color: #6A5A1F;
  padding: 6px 8px; border-radius: 6px;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.08);
}
.pv-landing .ann-vis .note::before {
  content: ""; position: absolute; width: 1px; height: 14px;
  background: color-mix(in srgb, var(--accent) 55%, transparent);
  right: 44%; top: 28px;
}

.pv-landing .folder-vis {
  display: flex; gap: 10px;
  border: 1px solid var(--line); border-radius: 10px; padding: 12px;
  background: var(--bg);
}
.pv-landing .folder-tree { flex: 1; font-family: var(--mono); font-size: 11px; color: var(--ink-2); display:flex; flex-direction: column; gap: 3px; }
.pv-landing .folder-tree .dir { color: var(--ink); font-weight: 500; }
.pv-landing .folder-tree .f { color: var(--mut); padding-left: 14px; }
.pv-landing .folder-tree .f.active { color: var(--accent-ink); }
.pv-landing .folder-badge {
  align-self: flex-start; padding: 4px 8px; border-radius: 6px;
  font-family: var(--mono); font-size: 10px; letter-spacing: .04em;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent-ink);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.pv-landing .feat.cta-card {
  grid-column: span 4;
  background:
    radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 55%),
    var(--surface);
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px;
  padding: 36px 36px;
  align-items: stretch;
}
.pv-landing .cta-card-inner { display: flex; flex-direction: column; }
.pv-landing .cta-eyebrow {
  font-family: var(--mono); font-size: 10.5px; color: var(--mut);
  text-transform: uppercase; letter-spacing: .14em;
  margin-bottom: 14px;
}
.pv-landing .feat.cta-card h3 { font-size: 32px; max-width: 22ch; margin-bottom: 12px; }
.pv-landing .feat.cta-card p { max-width: 40ch; margin-bottom: auto; }
.pv-landing .cta-card-actions {
  display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px;
}
.pv-landing .cta-card-art {
  display: flex; flex-wrap: wrap; gap: 8px; align-content: center; justify-content: flex-end;
  padding-left: 8px;
}
.pv-landing .cta-card-art .chip {
  font-family: var(--mono); font-size: 11px;
  color: var(--ink-2);
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  letter-spacing: -.005em;
}
.pv-landing .cta-card-art .chip:nth-child(odd) {
  color: var(--accent-ink);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

@media (max-width: 980px) {
  .pv-landing .features { grid-template-columns: repeat(2, 1fr); }
  .pv-landing .feat, .pv-landing .feat.wide, .pv-landing .feat.lead, .pv-landing .feat.cta-card { grid-column: span 2; }
  .pv-landing .feat.cta-card { grid-template-columns: 1fr; padding: 32px 28px; }
  .pv-landing .feat.cta-card .cta-card-art {
    flex-direction: row; flex-wrap: wrap;
    justify-content: flex-start;
    padding-left: 0;
    order: -1;
    margin-bottom: 4px;
  }
}
@media (max-width: 820px) {
  .pv-landing .features { grid-template-columns: 1fr; }
  .pv-landing .feat,
  .pv-landing .feat.wide,
  .pv-landing .feat.lead,
  .pv-landing .feat.cta-card {
    grid-column: 1 / -1;
    min-height: 0;
  }
}
@media (max-width: 640px) {
  .pv-landing .feat, .pv-landing .feat.wide, .pv-landing .feat.lead, .pv-landing .feat.cta-card {
    padding: 26px 22px;
  }
  .pv-landing .feat h3 { font-size: 24px; }
  .pv-landing .feat.cta-card { padding: 28px 22px; }
  .pv-landing .feat.cta-card h3 { font-size: 26px; max-width: none; }
  .pv-landing .feat-visual { padding-top: 18px; }
  .pv-landing .cta-card-actions { flex-direction: column; align-items: stretch; gap: 8px; }
  .pv-landing .cta-card-actions .btn { justify-content: center; }
  .pv-landing .feat.cta-card .cta-card-art .chip { font-size: 10.5px; padding: 5px 10px; }
}

.pv-landing .empathy-grid {
  display: grid; grid-template-columns: 1fr 64px 1fr; gap: 0;
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
  background: var(--surface);
}
.pv-landing .empathy-col {
  padding: 36px 32px;
  display: flex; flex-direction: column; gap: 14px;
}
.pv-landing .empathy-col.before { background: #F7F4ED; }
.pv-landing .empathy-col.after { background: var(--surface); }
.pv-landing .empathy-tag {
  font-family: var(--mono); font-size: 10.5px; color: var(--mut);
  text-transform: uppercase; letter-spacing: .14em;
  margin-bottom: 8px;
}
.pv-landing .empathy-col ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 14px; }
.pv-landing .empathy-col li {
  font-size: 15px; line-height: 1.5; color: var(--ink-2);
  padding-left: 22px; position: relative;
  text-wrap: pretty;
}
.pv-landing .empathy-col.before li::before {
  content: "✕"; position: absolute; left: 0; top: 1px;
  color: #B86B5A; font-size: 12px; font-weight: 600;
}
.pv-landing .empathy-col.after li::before {
  content: "✓"; position: absolute; left: 0; top: 1px;
  color: var(--accent); font-size: 12px; font-weight: 700;
}
.pv-landing .empathy-divider {
  display: grid; place-items: center;
  color: var(--mut-2); font-size: 18px;
  background: var(--bg);
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
}
@media (max-width: 820px) {
  .pv-landing .empathy-grid { grid-template-columns: 1fr; }
  .pv-landing .empathy-divider { border: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 12px 0; }
}
@media (max-width: 640px) {
  .pv-landing .empathy-col { padding: 26px 22px; }
  .pv-landing .empathy-col li { font-size: 14.5px; }
}

.pv-landing .steps {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
  background: var(--line);
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
}
.pv-landing .step {
  background: var(--surface);
  padding: 32px 28px;
  display: flex; flex-direction: column;
  min-height: 280px;
}
.pv-landing .step-num {
  font-family: var(--serif); font-size: 44px; line-height: 1;
  color: var(--accent-ink); margin-bottom: 18px; letter-spacing: -.02em;
}
.pv-landing .step h3 {
  font-family: var(--serif); font-weight: 400;
  font-size: 24px; line-height: 1.1; letter-spacing: -.012em;
  margin: 0 0 10px; color: var(--ink); max-width: 18ch;
}
.pv-landing .step p {
  font-size: 14px; color: var(--mut); line-height: 1.55; margin: 0; max-width: 38ch;
}
.pv-landing .step-vis {
  margin-top: auto; padding-top: 24px;
  font-family: var(--mono); font-size: 11.5px;
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
}
.pv-landing .step-vis .prefix, .pv-landing .step-vis .tail { color: var(--ink-2); }
.pv-landing .step-vis .dots { color: var(--mut-2); }
.pv-landing .step-vis .step-ok {
  margin-left: auto; padding: 3px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-ink); font-size: 10.5px;
}
.pv-landing .folder-step .path { color: var(--ink); }
.pv-landing .folder-step .meta { margin-left: auto; color: var(--mut); }
.pv-landing .ask-step { flex-direction: column; align-items: flex-start; gap: 10px; }
.pv-landing .ask-step .q {
  font-family: var(--serif); font-style: italic; font-size: 16px; color: var(--ink-2);
  line-height: 1.4;
}
.pv-landing .ask-step .cites { display: flex; gap: 6px; }
.pv-landing .step-note {
  margin-top: 10px;
  font-size: 11.5px; line-height: 1.5; color: var(--mut);
  padding: 8px 10px;
  border: 1px dashed var(--line-2); border-radius: 8px;
  background: var(--bg);
  font-family: var(--mono);
}
@media (max-width: 820px) { .pv-landing .steps { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .pv-landing .step { padding: 26px 22px; min-height: 0; }
  .pv-landing .step-num { font-size: 36px; margin-bottom: 12px; }
}

.pv-landing .faq {
  border-top: 1px solid var(--line);
  max-width: 820px;
}
.pv-landing .faq-item {
  border-bottom: 1px solid var(--line);
  padding: 22px 4px;
}
.pv-landing .faq-item summary {
  list-style: none; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
  font-family: var(--serif); font-size: 22px; line-height: 1.2; color: var(--ink);
  letter-spacing: -.01em;
}
.pv-landing .faq-item summary::-webkit-details-marker { display: none; }
.pv-landing .faq-toggle {
  font-family: var(--sans); font-size: 22px; color: var(--mut);
  width: 28px; height: 28px; display: grid; place-items: center;
  border: 1px solid var(--line); border-radius: 50%;
  transition: transform .2s ease, background .2s ease;
  flex-shrink: 0;
}
.pv-landing .faq-item[open] .faq-toggle { transform: rotate(45deg); background: var(--bg-2); }
.pv-landing .faq-item p {
  margin: 14px 0 0; max-width: 64ch;
  font-size: 15px; line-height: 1.6; color: var(--mut);
  text-wrap: pretty;
}
.pv-landing .faq-item p + p { margin-top: 10px; }
.pv-landing .faq-item code,
.pv-landing .feat p code {
  font-family: var(--mono); font-size: 12.5px;
  background: var(--bg-2); padding: 1px 6px; border-radius: 4px;
  color: var(--accent-ink);
}

.pv-landing .final-cta {
  background: #0E0E0C; color: #F6F4ED;
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  max-width: 1180px;
  margin: 72px auto 40px;
}
.pv-landing .final-cta-inner {
  padding: 96px 48px;
  text-align: center;
  position: relative; z-index: 1;
  max-width: 720px; margin: 0 auto;
}
@media (max-width: 820px) {
  .pv-landing .final-cta { border-radius: 18px; margin: 48px 18px 32px; }
  .pv-landing .final-cta-inner { padding: 72px 28px; }
}
@media (max-width: 640px) {
  .pv-landing .final-cta { border-radius: 16px; margin: 32px 14px 24px; }
  .pv-landing .final-cta-inner { padding: 56px 22px; }
  .pv-landing .final-sub { font-size: 15.5px; }
}
.pv-landing .final-cta .section-label { color: rgba(246,244,237,.55); }
.pv-landing .final-cta .section-label::before { background: rgba(246,244,237,.4); }
.pv-landing .final-title {
  font-family: var(--serif); font-weight: 400;
  font-size: clamp(36px, 4.6vw, 60px); line-height: 1.04;
  letter-spacing: -.02em;
  color: #F6F4ED; max-width: none; margin: 16px auto 18px;
  text-wrap: balance;
}
.pv-landing .final-title em { color: #C9E4CE; font-style: italic; }
.pv-landing .final-sub {
  color: rgba(246,244,237,.7); font-size: 17px; line-height: 1.55;
  max-width: 50ch; margin: 0 auto 32px;
}
.pv-landing .btn-light { background: #F6F4ED; color: var(--ink); }
.pv-landing .btn-light:hover { background: #fff; }
.pv-landing .btn-ghost-dark { background: transparent; color: rgba(246,244,237,.85); border: 1px solid rgba(246,244,237,.25); text-decoration: none; }
.pv-landing .btn-ghost-dark:hover { border-color: rgba(246,244,237,.55); color: #F6F4ED; }
.pv-landing .final-cta-art {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  overflow: hidden;
  opacity: .14;
}
.pv-landing .final-cta-art .paper {
  background: #1F1E1A; border-color: rgba(255,255,255,.08);
  box-shadow: none;
}
.pv-landing .final-cta-art .paper::before { background: rgba(255,255,255,.6); }
.pv-landing .final-cta-art .paper i { background: rgba(255,255,255,.18); }
.pv-landing .final-cta-art .paper.p1 { top: 24px; left: 4%; transform: rotate(-12deg); }
.pv-landing .final-cta-art .paper.p2 { bottom: 24px; right: 8%; transform: rotate(7deg); }
.pv-landing .final-cta-art .paper.p3 { top: 50%; right: 4%; transform: translateY(-50%) rotate(-3deg); }

.pv-landing footer {
  max-width: 1180px; margin: 0 auto;
  padding: 40px 24px 60px;
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 14px;
  font-size: 13px; color: var(--mut);
  border-top: 1px solid var(--line);
}
.pv-landing footer .f-right { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
@media (max-width: 640px) {
  .pv-landing footer {
    padding: 28px 18px 40px;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    font-size: 12.5px;
    text-align: left;
  }
  .pv-landing footer .f-right { gap: 14px 18px; row-gap: 10px; }
}
.pv-landing footer a, .pv-landing footer button {
  text-decoration: none; color: var(--mut);
  background: none; border: 0; cursor: pointer; font-family: inherit; font-size: 13px; padding: 0;
}
.pv-landing footer a:hover, .pv-landing footer button:hover { color: var(--ink); }
`;

function Paper({ className }) {
  return (
    <div className={`paper ${className}`}>
      <i /><i /><i /><i /><i /><i /><i />
    </div>
  );
}

function formatStars(n) {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n / 1000) + "k";
}

const BUILD_TIME_REPO_SNAPSHOT =
  typeof __GH_REPO_SNAPSHOT__ !== "undefined" ? __GH_REPO_SNAPSHOT__ : null;

function useGitHubRepo(repo) {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STAR_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.repo === repo && Date.now() - parsed.ts < STAR_CACHE_TTL) {
          return parsed.data;
        }
      }
    } catch {}
    if (BUILD_TIME_REPO_SNAPSHOT && BUILD_TIME_REPO_SNAPSHOT.stars != null) {
      return BUILD_TIME_REPO_SNAPSHOT;
    }
    return null;
  });
  const [loading, setLoading] = useState(data == null);

  useEffect(() => {
    if (data && data.stars != null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gh " + r.status))))
      .then((json) => {
        if (cancelled) return;
        const next = {
          stars: typeof json.stargazers_count === "number" ? json.stargazers_count : null,
          forks: typeof json.forks_count === "number" ? json.forks_count : null,
          language: json.language || null,
          license: json.license?.spdx_id || null,
          updatedAt: json.pushed_at || json.updated_at || null,
        };
        setData(next);
        setLoading(false);
        try {
          localStorage.setItem(
            STAR_CACHE_KEY,
            JSON.stringify({ repo, data: next, ts: Date.now() })
          );
        } catch {}
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [repo]);

  return { data, loading };
}

function useGitHubStars(repo) {
  const { data, loading } = useGitHubRepo(repo);
  return { stars: data?.stars ?? null, loading };
}

function formatRelativeTime(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const day = 86400000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`;
  return `${Math.floor(diff / (365 * day))}y ago`;
}

function StarIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
    </svg>
  );
}

function GhMarkIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GhStar() {
  const { stars, loading } = useGitHubStars(GITHUB_REPO);
  const display = loading && stars == null ? "…" : formatStars(stars);
  const showCount = stars != null || loading;

  return (
    <a
      className="gh-star gh-star-reveal"
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Star Paperview on GitHub${stars != null ? ` — ${stars.toLocaleString()} stars` : ""}`}
    >
      <span className="gh-star-face">
        <GhMarkIcon />
        <span className="lbl">Star</span>
      </span>
      {showCount && (
        <>
          <span className="gh-star-sep" aria-hidden="true" />
          <span className={`gh-star-count${loading ? " is-loading" : ""}`}>
            <StarIcon className="gh-star-icon" />
            <span className="num">{display}</span>
          </span>
        </>
      )}
    </a>
  );
}

function GhStarInline() {
  const { stars } = useGitHubStars(GITHUB_REPO);
  if (stars == null) return null;
  return (
    <a
      className="gh-star-inline"
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${stars.toLocaleString()} GitHub stars`}
    >
      <StarIcon />
      <span>{formatStars(stars)}</span>
    </a>
  );
}

function GhHeroButton() {
  const { stars } = useGitHubStars(GITHUB_REPO);
  return (
    <a
      className="btn btn-github"
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <GhMarkIcon />
      <span>View on GitHub</span>
      {stars != null && (
        <span className="gh-count">
          <StarIcon />
          <span>{formatStars(stars)}</span>
        </span>
      )}
    </a>
  );
}

function RepoStrip() {
  const { data, loading } = useGitHubRepo(GITHUB_REPO);
  const [owner, name] = GITHUB_REPO.split("/");
  const stars = data?.stars;
  const forks = data?.forks;
  const relative = formatRelativeTime(data?.updatedAt);

  const renderStars = () => {
    if (loading && stars == null) return <span className="repo-stat-num is-loading">…</span>;
    if (stars == null) return <span className="repo-stat-num is-loading">—</span>;
    if (stars >= 1000) {
      const value = (stars / 1000).toFixed(1).replace(/\.0$/, "");
      return (
        <span className="repo-stat-num is-star">
          {value}<span className="k">k</span>
        </span>
      );
    }
    return <span className="repo-stat-num is-star">{stars}</span>;
  };

  return (
    <section className="repo-strip" aria-label="Open-source repository">
      <div className="repo-strip-left">
        <div className="repo-mark">
          <GhMarkIcon />
        </div>
        <div className="repo-path">
          <span className="repo-path-label">Open source</span>
          <span className="repo-path-name">
            <span className="owner">{owner}</span>
            <span className="slash">/</span>
            <span>{name}</span>
          </span>
        </div>
      </div>

      <div className="repo-strip-center">
        <div className="repo-stat">
          {renderStars()}
          <span className="repo-stat-label">Stars</span>
        </div>
        <div className="repo-stat">
          <span className="repo-stat-num">
            {forks == null ? (loading ? "…" : "—") : forks}
          </span>
          <span className="repo-stat-label">Forks</span>
        </div>
        <div className="repo-stat">
          <div className="repo-meta-row">
            {data?.language && (
              <span className="repo-chip lang"><span className="dot" />{data.language}</span>
            )}
            {data?.license && (
              <span className="repo-chip">{data.license}</span>
            )}
            {relative && (
              <span className="repo-chip"><span className="dot" />updated {relative}</span>
            )}
            {!data?.language && !data?.license && !relative && (
              <span className="repo-chip">MIT · React + Vite</span>
            )}
          </div>
          <span className="repo-stat-label">Repository</span>
        </div>
      </div>

      <div className="repo-strip-right">
        <a
          className="repo-cta"
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <GhMarkIcon />
          <span>View repository</span>
          <span className="arr">↗</span>
        </a>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!document.querySelector('link[data-paperview-font]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_URL;
      link.setAttribute("data-paperview-font", "1");
      document.head.appendChild(link);
    }
    if (!document.querySelector('style[data-paperview-landing]')) {
      const style = document.createElement("style");
      style.setAttribute("data-paperview-landing", "1");
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.body.style.background = "#FBFAF7";

    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const openApp = () => navigate("/app");

  const scrollToFeatures = (e) => {
    e.preventDefault();
    const el = document.getElementById("features");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="pv-landing">
      <nav className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="logo">
          <div className="logo-mark" />
          <span>Paperview</span>
        </div>
        <div className="nav-right">
          <a className="nav-link" href="#features" onClick={scrollToFeatures}>Features</a>
          <GhStar />
          <button className="nav-cta" onClick={openApp}>
            Open app <span className="arr">→</span>
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-art" aria-hidden="true">
          <div className="grid-bg" />
          <Paper className="p1" />
          <Paper className="p2" />
          <Paper className="p3" />
          <Paper className="p4" />
        </div>

        <span className="eyebrow">
          <span className="pill-dot" />
          <strong>v1.0</strong>
          <span>·&nbsp; Free, open, &amp; local-first</span>
        </span>

        <h1 className="hero-title">
          The AI research desk<br />
          that <span className="ital">never leaves</span> your browser.
        </h1>

        <p className="hero-sub">
          Paperview reads, annotates, and answers questions about your PDFs —
          with citations back to the source page. <strong>Bring your own OpenAI key.</strong>{" "}
          Your files, chats, and notes never touch our servers.
        </p>

        <div className="cta-row">
          <button className="btn btn-primary" onClick={openApp}>
            Open Paperview <span className="arr">→</span>
          </button>
          <GhHeroButton />
          <a className="btn btn-ghost" href="#features" onClick={scrollToFeatures} style={{ lineHeight: 1.5 }}>
            See how it works
          </a>
        </div>

        <div className="hero-spacer" />
      </header>

      <section className="mockup-wrap">
        <div className="mockup">
          <div className="win-bar">
            <div className="win-dot r" />
            <div className="win-dot y" />
            <div className="win-dot g" />
            <span className="win-title">paperview.app  —  Climate Tipping Points</span>
          </div>
          <div className="app">
            <aside className="side">
              <div className="side-head">
                <div className="side-brand"><div className="mini" />Paperview</div>
                <span className="side-close">‹</span>
              </div>
              <div className="side-nav">
                <div className="side-item"><span className="ico">📖</span>Reader</div>
                <div className="side-item active"><span className="ico">▦</span>Library</div>
                <div className="side-item"><span className="ico">✦</span>Agent</div>
              </div>
              <div className="side-search">
                <span>⌕</span> Search…
              </div>
              <div className="side-folders-head">Folders</div>
              <div className="folder"><span className="chev">▾</span>Climate Tipping Points<span className="count">12</span></div>
              <div className="files">
                <div className="file active">Lenton-2008-tipping-elements.pdf</div>
                <div className="file">Armstrong-McKay-2022-Science.pdf</div>
                <div className="file">IPCC-AR6-WG1-Ch4.pdf</div>
                <div className="file">Steffen-2018-Hothouse-Earth.pdf</div>
                <div className="file">Boers-2021-AMOC-decline.pdf</div>
                <div className="file">Wang-2023-Amazon-dieback.pdf</div>
                <div className="file">Notz-Stroeve-2018-sea-ice.pdf</div>
                <div className="file">Rockstrom-2009-boundaries.pdf</div>
                <div className="file">Lenton-2019-Nature-comment.pdf</div>
                <div className="file">Ritchie-2021-overshoot…</div>
              </div>
              <div className="side-foot">
                <div className="side-api"><span className="gdot" />API key · • • • • – 15UA</div>
                <div className="side-btn">📁 Open Folder</div>
                <div className="side-btn ghost">⬆ Upload PDF</div>
                <div className="side-btn ghost">+ New Folder</div>
              </div>
            </aside>

            <main className="reader">
              <div className="reader-top">
                <div className="doc-chip">📄 Lenton-2008-tipping-elements.pdf <span className="x">×</span></div>
                <div className="reader-tools">
                  <span className="tool">⌕</span>
                  <span className="tool">−</span>
                  <span>140%</span>
                  <span className="tool">＋</span>
                  <span className="tool">⟲</span>
                </div>
              </div>
              <div className="pages">2 of 14  ›</div>
              <div className="reader-canvas">
                <article className="page">
                  <div className="page-meta">Proceedings of the National Academy of Sciences · 105 (6) · 1786–1793</div>
                  <h3 className="page-title">Tipping elements in the Earth's climate system</h3>
                  <div className="page-authors">Timothy M. Lenton<sup>a,*</sup>, Hermann Held<sup>b</sup>, Elmar Kriegler<sup>b</sup>, Hans Joachim Schellnhuber<sup>b,c</sup></div>
                  <div className="page-section">A B S T R A C T</div>
                  <div className="cols">
                    <div className="lines">
                      <i /><i /><i /><i /><i /><i />
                      <span className="hl" />
                      <i /><i /><i /><i /><i /><i /><i /><i /><i />
                    </div>
                    <div className="lines">
                      <i /><i /><i /><i /><i />
                      <span className="hl" />
                      <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                    </div>
                  </div>
                </article>
              </div>
            </main>

            <aside className="chat">
              <div className="chat-head">
                <div className="chat-title">Which tipping elements does Lenton identify?</div>
                <div className="chat-sub">3 messages · 2 apr</div>
              </div>
              <div className="chat-body">
                <div className="msg-user">Which tipping elements does Lenton identify?</div>
                <div className="msg-ai">
                  Lenton et&nbsp;al. flag nine policy-relevant tipping elements, including the Greenland ice sheet, AMOC, Amazon rainforest, and Arctic sea-ice <span className="cite">p.3</span>, ranked by proximity to threshold <span className="cite">p.5</span>.
                  <div className="src-row">
                    <span className="src-chip"><span className="pg">p.3</span> Introduction</span>
                    <span className="src-chip"><span className="pg">p.5</span> Table&nbsp;1</span>
                  </div>
                </div>
                <div className="msg-user">What temperature thresholds do they give?</div>
                <div className="msg-ai">
                  Most elements have estimated thresholds in the 1–2 °C range above pre-industrial; the Greenland ice sheet sits near 1–2 °C, AMOC at 3–5 °C <span className="cite">p.7</span>.
                </div>
              </div>
              <form className="chat-input-form" onSubmit={(e) => e.preventDefault()}>
                <div className="chat-input-bar">
                  <input type="text" placeholder="Ask about this PDF…" readOnly />
                  <button type="submit" className="send-btn" aria-label="Send">↑</button>
                </div>
                <div className="chat-input-meta">
                  <span className="model">gpt-5 · mini</span>
                  <span className="ctx">📎 1 file in context</span>
                </div>
              </form>
            </aside>
          </div>
        </div>
      </section>

      <RepoStrip />

      <section className="section" id="features">
        <div className="section-head">
          <span className="section-label">§ 01 &nbsp; Features</span>
          <div>
            <h2>Built for <em>serious</em> research, not locked behind a paywall.</h2>
          </div>
        </div>

        <div className="features">
          <div className="feat lead">
            <div className="feat-label"><span className="feat-num">01</span>· &nbsp;THE USP</div>
            <h3>Bring your own key.<br />Pay only for what you actually use.</h3>
            <p>Paperview plugs directly into your OpenAI account. Every request goes from your browser to OpenAI — we never proxy, log, or meter it. No subscription, no seat tiers, no rate limits from us.</p>
            <div className="feat-visual">
              <div className="key-vis">
                <div className="key-row"><span className="lbl">provider</span><span className="val">openai.com</span></div>
                <div className="key-row"><span className="lbl">sk-proj-</span><span className="val">••••••••••••15UA</span></div>
                <div className="key-row"><span className="lbl">stored in</span><span className="val">browser localStorage</span></div>
              </div>
            </div>
          </div>

          <div className="feat wide">
            <div className="feat-label"><span className="feat-num">02</span>· &nbsp;LOCAL-FIRST</div>
            <h3>Your files stay on your machine.</h3>
            <p>PDFs are rendered, indexed, and OCR'd entirely in your browser. Annotations and chats live in IndexedDB — and in an optional <code>.paperview.json</code> that travels with your folder. There is literally no backend to breach.</p>
            <div className="feat-visual">
              <div className="priv-vis">
                <div className="priv-col">
                  <div className="head">On your device</div>
                  <div className="itm">PDFs &amp; folder contents</div>
                  <div className="itm">Highlights &amp; notes</div>
                  <div className="itm">Chat history</div>
                  <div className="itm">Your API key</div>
                </div>
                <div className="priv-arrow">
                  <div className="line" />
                  <span>HTTPS</span>
                  <div className="line" />
                </div>
                <div className="priv-col off">
                  <div className="head">Sent to OpenAI only</div>
                  <div className="itm">Selected passage text</div>
                  <div className="itm">Your question</div>
                  <div className="itm">Your key in headers</div>
                </div>
              </div>
            </div>
          </div>

          <div className="feat">
            <div className="feat-label"><span className="feat-num">03</span>· &nbsp;CITATIONS</div>
            <h3>Every answer, sourced to a page.</h3>
            <p>Click any citation to jump straight to the highlighted passage in the PDF.</p>
            <div className="feat-visual">
              <div className="chat-vis">
                <div className="q">What does Lenton 2008 conclude?</div>
                <div className="a">Nine policy-relevant climate tipping elements are identified <span className="cite">p.3</span>; thresholds for several are within reach this century <span className="cite">p.7</span>.</div>
              </div>
            </div>
          </div>

          <div className="feat">
            <div className="feat-label"><span className="feat-num">04</span>· &nbsp;FULL-TEXT SEARCH</div>
            <h3>Grep your entire library — including scans.</h3>
            <p>Built-in OCR for scanned PDFs. Search across every paper in milliseconds.</p>
            <div className="feat-visual">
              <div className="search-vis">
                <div className="q">⌕ "sample size"</div>
                <div className="hit"><span className="p">p.3</span> &nbsp;Larson 2022: insufficient <mark>sample size</mark> in 78%…</div>
                <div className="hit"><span className="p">p.11</span>&nbsp;Carbine 2019: a priori <mark>sample size</mark> calc…</div>
                <div className="hit"><span className="p">p.2</span> &nbsp;Baker 2020: reporting of <mark>sample size</mark>…</div>
              </div>
            </div>
          </div>

          <div className="feat">
            <div className="feat-label"><span className="feat-num">05</span>· &nbsp;ANNOTATIONS</div>
            <h3>Highlight, margin-note, done.</h3>
            <p>Saved per PDF with text, page, position, color, comment, and timestamp. Reopen a paper and every highlight is exactly where you left it.</p>
            <div className="feat-visual">
              <div className="ann-vis">
                <span className="tl w1" />
                <span className="tl hl w2" />
                <span className="tl w3" />
                <span className="tl w1" />
                <div className="note">← check for pre-reg</div>
              </div>
            </div>
          </div>

          <div className="feat">
            <div className="feat-label"><span className="feat-num">06</span>· &nbsp;PORTABLE NOTES</div>
            <h3>Your notes travel with the folder.</h3>
            <p>Link a writable folder and Paperview drops a tiny <code>.paperview.json</code> alongside your PDFs — chats and annotations follow the folder across sessions, machines, or a Dropbox sync.</p>
            <div className="feat-visual">
              <div className="folder-vis">
                <div className="folder-tree">
                  <div className="dir">▾ ~/Research/Climate</div>
                  <div className="f">Lenton-2008.pdf</div>
                  <div className="f active">McKay-2022.pdf</div>
                  <div className="f">Steffen-2018.pdf</div>
                  <div className="f" style={{ color: "var(--accent-ink)" }}>.paperview.json</div>
                </div>
                <span className="folder-badge">syncs</span>
              </div>
            </div>
          </div>

          <div className="feat cta-card">
            <div className="cta-card-inner">
              <span className="cta-eyebrow">— Ready when you are</span>
              <h3>Start reading <em>smarter</em>.<br />It takes thirty seconds.</h3>
              <p>Open Paperview, paste your OpenAI key, drop in a folder. That's the whole onboarding.</p>
              <div className="cta-card-actions">
                <button className="btn btn-primary" onClick={openApp}>
                  Open Paperview <span className="arr">→</span>
                </button>
                <a className="btn btn-ghost" href={OPENAI_KEY_URL} target="_blank" rel="noopener noreferrer">
                  Get an OpenAI key ↗
                </a>
              </div>
            </div>
            <div className="cta-card-art" aria-hidden="true">
              <span className="chip">no account</span>
              <span className="chip">no subscription</span>
              <span className="chip">no telemetry</span>
              <span className="chip">no servers</span>
              <span className="chip">no lock-in</span>
            </div>
          </div>
        </div>
      </section>

      <div className="rule" />

      <section className="section empathy">
        <div className="section-head">
          <span className="section-label">§ 02 &nbsp; Why Paperview</span>
          <div>
            <h2>Now you actually know <em>where</em> the answer came from.</h2>
          </div>
        </div>

        <div className="empathy-grid">
          <div className="empathy-col before">
            <div className="empathy-tag">Before</div>
            <ul>
              <li>Twelve PDFs open across three windows. The one you need is, of course, in window two.</li>
              <li>An AI confidently summarises a paper it has clearly never read.</li>
              <li>You paste the same passage into a chat for the eighth time today.</li>
              <li>A subscription quietly renews. You used the tool twice this month.</li>
              <li>You wonder, briefly, whether your unpublished draft is now training data.</li>
            </ul>
          </div>
          <div className="empathy-divider" aria-hidden="true">
            <span>→</span>
          </div>
          <div className="empathy-col after">
            <div className="empathy-tag">With Paperview</div>
            <ul>
              <li>Point it at your folder. Every paper, every page, indexed in the browser.</li>
              <li>Every claim links back to the exact passage. Click to verify in one second.</li>
              <li>Your key, your call. Pay OpenAI cents per question, not us $20 a month.</li>
              <li>Nothing leaves your machine except the question and the passage you chose to send.</li>
              <li>Open it offline tomorrow. Your annotations are still there — they never went anywhere.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="rule" />

      <section className="section how">
        <div className="section-head">
          <span className="section-label">§ 03 &nbsp; How it works</span>
          <div>
            <h2>From folder to <em>cited</em> answer in three steps.</h2>
          </div>
        </div>

        <ol className="steps">
          <li className="step">
            <div className="step-num">01</div>
            <h3>Paste your OpenAI key</h3>
            <p>Stored only in your browser's localStorage. Never sent to us. Rotate or revoke from the OpenAI dashboard any time.</p>
            <div className="step-vis key-step">
              <span className="prefix">sk-proj-</span><span className="dots">••••••••••••</span><span className="tail">15UA</span>
              <span className="step-ok">✓ valid</span>
            </div>
          </li>
          <li className="step">
            <div className="step-num">02</div>
            <h3>Open a folder of PDFs</h3>
            <p>Link any local folder via the File System Access API. Paperview reads the files in-place — no copies, no uploads, fully sandboxed.</p>
            <div className="step-vis folder-step">
              <span className="path">~/Research/Climate</span>
              <span className="meta">12 PDFs · read-only</span>
            </div>
            <div className="step-note">Folder access requires Chrome, Edge, Arc, or Brave. Firefox/Safari users can still upload individual PDFs.</div>
          </li>
          <li className="step">
            <div className="step-num">03</div>
            <h3>Ask. Verify. Repeat.</h3>
            <p>Pick the papers to include as context, ask in plain language, and click any citation to jump to the exact passage in the PDF.</p>
            <div className="step-vis ask-step">
              <span className="q">“Which tipping elements are closest to threshold?”</span>
              <span className="cites"><span className="cite">p.3</span> <span className="cite">p.5</span> <span className="cite">p.7</span></span>
            </div>
          </li>
        </ol>
      </section>

      <div className="rule" />

      <section className="section faq-section">
        <div className="section-head">
          <span className="section-label">§ 04 &nbsp; FAQ</span>
          <div>
            <h2>Honest answers to the questions you'd actually ask.</h2>
          </div>
        </div>

        <div className="faq">
          <details className="faq-item" open>
            <summary><span>Is Paperview really free?</span><span className="faq-toggle">+</span></summary>
            <p>Yes. The app itself is free and open. You'll pay OpenAI directly for the questions you ask — typically a fraction of a cent per query. We never take a cut and we never see your usage.</p>
          </details>
          <details className="faq-item">
            <summary><span>Where is my data stored?</span><span className="faq-toggle">+</span></summary>
            <p>Paperview stores everything locally in your browser first.</p>
            <p><strong>Annotations</strong> are saved per PDF with the selected text, page number, highlight position, color, optional comment, and timestamp. When you reopen the same paper, Paperview reloads those annotations and places the highlights back on the PDF.</p>
            <p><strong>Chat history</strong> is saved as conversation threads. Each thread stores its title, messages, the related paper or folder, and the last updated time, so you can close the app and continue later.</p>
            <p>If you open a <strong>writable folder</strong>, Paperview also writes a small <code>.paperview.json</code> file into that folder. It contains the saved chats and annotations for the papers in that folder, so your notes and history can travel with the folder across sessions or devices.</p>
            <p>The PDFs themselves are processed locally in the browser and never uploaded. Only the text needed for an AI question is sent to OpenAI when you ask something.</p>
          </details>
          <details className="faq-item">
            <summary><span>What gets sent to OpenAI?</span><span className="faq-toggle">+</span></summary>
            <p>Only the passages you choose to include as context, plus your question and your API key in the request headers. Everything else — file lists, folder names, annotations — stays on your machine.</p>
          </details>
          <details className="faq-item">
            <summary><span>Which browsers does it work in?</span><span className="faq-toggle">+</span></summary>
            <p>Folder linking requires the File System Access API — Chrome, Edge, Arc, and Brave. Firefox and Safari users can still upload individual PDFs.</p>
          </details>
          <details className="faq-item">
            <summary><span>Can I use a model other than OpenAI?</span><span className="faq-toggle">+</span></summary>
            <p>Today, OpenAI only — the chat is built around its tool-calling API. Anthropic and local model support is on the roadmap.</p>
          </details>
          <details className="faq-item">
            <summary><span>What about scanned PDFs?</span><span className="faq-toggle">+</span></summary>
            <p>Built-in OCR runs in a Web Worker. Scanned papers are searchable and citable just like native PDFs.</p>
          </details>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta-art" aria-hidden="true">
          <Paper className="p1" />
          <Paper className="p2" />
          <Paper className="p3" />
        </div>
        <div className="final-cta-inner">
          <span className="section-label">§ 05 &nbsp; Get started</span>
          <h2 className="final-title">Read smarter, in your browser.<br /><em>Without giving up your data.</em></h2>
          <p className="final-sub">Open Paperview, paste your OpenAI key, link a folder. The whole setup takes under a minute.</p>
          <div className="cta-row">
            <button className="btn btn-light" onClick={openApp}>
              Open Paperview <span className="arr">→</span>
            </button>
            <a className="btn btn-ghost-dark" href={OPENAI_KEY_URL} target="_blank" rel="noopener noreferrer">
              Get an OpenAI key ↗
            </a>
          </div>
        </div>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Paperview · No account, no tracking, no backend.</span>
        <div className="f-right">
          <button onClick={openApp}>Open app</button>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <GhStarInline />
          <a href={OPENAI_KEY_URL} target="_blank" rel="noopener noreferrer">Get an OpenAI key ↗</a>
        </div>
      </footer>
    </div>
  );
}

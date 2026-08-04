import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "./AuthContext";
import FoundingSignup from "./components/FoundingSignup";
import FoundingWelcome from "./components/FoundingWelcome";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,300;0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,300;1,7..72,400;1,7..72,500;1,7..72,600;1,7..72,700&display=swap";

const GITHUB_URL = "https://github.com/Carstenhanekamp/Paperview/";
const GITHUB_REPO = "Carstenhanekamp/paperview";
const OPENAI_KEY_URL = "https://platform.openai.com/api-keys";
/** Source for the hero mock PDF (Joshi 2025). */
const MOCK_PAPER_URL =
  "https://www.researchgate.net/publication/391978285_Comprehensive_Review_of_AI_Hallucinations_Impacts_and_Mitigation_Strategies_for_Financial_and_Business_Applications";
const STAR_CACHE_KEY = "pv.gh.stars.v1";
const STAR_CACHE_TTL = 60 * 60 * 1000;

const CSS = `
:root {
  --ink: #17181A;
  --ink-2: #23262B;
  --ink-3: #33353A;
  --text-2: #5D616A;
  --text-3: #6E7178;
  --text-4: #9095A0;
  --text-5: #9CA0A7;
  --hairline: rgba(20,22,28,.10);
  --surface: #FFFFFF;
  --field: #F2F2F4;
  --desk: #EFEFF1;
  --fill-1: #F4F5F7;
  --fill-2: #F7F8F9;
  --accent: #55697F;
  --accent-hover: #3F5063;
  --accent-tint: #E3E9EF;
  --accent-on: #2F4056;
  --highlight: #D5DEE7;
  --page-bg: #FAFAFA;
  --rule: #E6E7EA;
  --display: 'Literata', Georgia, serif;
  --sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
  --sh-window: 0 0 0 .5px rgba(20,22,28,.16), 0 30px 70px -20px rgba(12,16,28,.55);
}

.pv-landing, .pv-landing * { box-sizing: border-box; }
.pv-landing {
  font-family: var(--sans);
  background: var(--page-bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
  min-height: 100vh;
}
.pv-landing a { color: inherit; text-decoration: none; }
.pv-landing button { font-family: inherit; }

/* ── Hero ── */
.pv-landing .hero {
  position: relative;
  min-height: 792px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pv-landing .hero-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.pv-landing .hero-overlay {
  position: absolute; inset: 0;
  background:
    radial-gradient(130% 95% at 0% 100%, rgba(14,20,27,.70), rgba(14,20,27,.34) 38%, transparent 72%),
    linear-gradient(100deg, rgba(16,23,30,.72), rgba(16,23,30,.48) 34%, rgba(16,23,30,.14) 62%, transparent 90%);
  pointer-events: none;
}
.pv-landing .hero-fade {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: 150px;
  background: linear-gradient(180deg, rgba(250,250,250,0) 0%, rgba(250,250,250,.55) 62%, #FAFAFA 100%);
  pointer-events: none;
}

.pv-landing .nav-wrap {
  position: relative;
  padding: 22px 24px 0;
  z-index: 2;
}
.pv-landing .nav-pill {
  display: flex; align-items: center;
  height: 52px;
  padding: 0 10px 0 18px;
  border-radius: 999px;
  background: rgba(16,20,26,.55);
  backdrop-filter: blur(26px) saturate(160%);
  -webkit-backdrop-filter: blur(26px) saturate(160%);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.16);
  gap: 10px;
  transition: background .15s ease;
}
.pv-landing .nav-pill.scrolled {
  background: rgba(16,20,26,.68);
}
.pv-landing .nav-brand {
  display: flex; align-items: center; gap: 9px;
  flex-shrink: 0;
}
.pv-landing .nav-glyph {
  width: 24px; height: 24px; border-radius: 7px;
  background: #FAFAFA;
  display: grid; place-items: center;
}
.pv-landing .nav-name {
  font-family: var(--display); font-weight: 600;
  font-size: 16px; color: #fff; letter-spacing: -.01em;
}
.pv-landing .nav-links {
  margin-left: 32px;
  display: flex; align-items: center; gap: 26px;
}
.pv-landing .nav-link {
  font-size: 13.5px; color: rgba(255,255,255,.78);
  background: none; border: 0; cursor: pointer; padding: 0;
  font-family: inherit;
  transition: color .12s ease;
}
.pv-landing .nav-link:hover { color: #fff; }
.pv-landing .nav-right {
  margin-left: auto;
  display: flex; align-items: center; gap: 8px;
}
.pv-landing .gh-glass {
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 13px;
  border-radius: 999px;
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,.85);
  text-decoration: none;
  transition: background .12s ease;
}
.pv-landing .gh-glass:hover { background: rgba(255,255,255,.08); }
.pv-landing .gh-glass svg { width: 14px; height: 14px; display: block; }
.pv-landing .gh-glass .num {
  font-variant-numeric: tabular-nums;
}
.pv-landing .nav-cta {
  height: 36px; padding: 0 17px;
  border-radius: 999px; border: none;
  background: #FAFAFA; color: var(--ink);
  font-size: 13.5px; font-weight: 600;
  cursor: pointer;
  transition: background .12s ease;
}
.pv-landing .nav-cta:hover { background: #fff; }

.pv-landing .hero-row {
  position: relative; z-index: 1;
  flex: 1;
  display: flex;
  align-items: flex-start;
  padding: 44px 0 0 42px;
  width: 100%;
  min-height: 580px;
}
.pv-landing .hero-text {
  position: relative; z-index: 1;
  width: 430px; flex-shrink: 0;
  display: flex; flex-direction: column;
  padding-bottom: 60px;
}
.pv-landing .hero-badge {
  display: inline-flex; align-self: flex-start;
  align-items: center; gap: 8px;
  height: 30px; padding: 0 13px 0 11px;
  border-radius: 999px;
  background: rgba(255,255,255,.16);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.28);
  margin-bottom: 24px;
  letter-spacing: .02em;
}
.pv-landing .hero-badge .dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: #B9C7D6;
  box-shadow: 0 0 0 3px rgba(185,199,214,.22);
}
.pv-landing .hero-badge span {
  font-size: 12.5px; font-weight: 500;
  color: rgba(255,255,255,.92);
}
.pv-landing .hero-title {
  font-family: var(--display); font-weight: 700;
  font-size: 48px; line-height: 1.08;
  letter-spacing: -.035em;
  color: #fff;
  margin: 0 0 22px;
  text-shadow: 0 2px 20px rgba(12,18,26,.35);
}
.pv-landing .hero-copy {
  font-size: 16.5px; line-height: 1.62;
  color: rgba(255,255,255,.88);
  max-width: 42ch;
  margin: 0 0 28px;
}
.pv-landing .hero-ctas {
  display: flex; gap: 10px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.pv-landing .btn-primary {
  height: 48px; padding: 0 8px 0 22px;
  border-radius: 999px; border: none;
  background: #FAFAFA; color: var(--ink);
  font-size: 15px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 12px;
  cursor: pointer;
  box-shadow: 0 10px 28px -12px rgba(12,18,26,.45);
  transition:
    background .22s cubic-bezier(0.32,0.72,0,1),
    transform .22s cubic-bezier(0.32,0.72,0,1),
    box-shadow .22s cubic-bezier(0.32,0.72,0,1);
}
.pv-landing .btn-primary:hover {
  background: #fff;
  box-shadow: 0 14px 32px -12px rgba(12,18,26,.5);
}
.pv-landing .btn-primary:active { transform: scale(.98); }
.pv-landing .btn-primary-ico {
  width: 32px; height: 32px; border-radius: 999px;
  background: rgba(23,24,26,.07);
  display: grid; place-items: center;
  flex-shrink: 0;
  transition: transform .28s cubic-bezier(0.32,0.72,0,1), background .22s cubic-bezier(0.32,0.72,0,1);
}
.pv-landing .btn-primary:hover .btn-primary-ico {
  background: rgba(23,24,26,.1);
  transform: translate(2px, -1px) scale(1.05);
}
.pv-landing .btn-primary-ico svg { display: block; }
.pv-landing .btn-glass {
  height: 48px; padding: 0 20px;
  border-radius: 999px; border: none;
  background: rgba(16,23,30,.46);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.34);
  color: #fff;
  font-size: 15px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition:
    background .22s cubic-bezier(0.32,0.72,0,1),
    transform .22s cubic-bezier(0.32,0.72,0,1);
}
.pv-landing .btn-glass:hover { background: rgba(16,23,30,.58); }
.pv-landing .btn-glass:active { transform: scale(.98); }
.pv-landing .hero-caption {
  font-size: 12.5px; font-weight: 500;
  color: rgba(255,255,255,.9);
  text-shadow: 0 1px 8px rgba(12,18,26,.6);
  background: none; border: 0; padding: 0;
  cursor: pointer; text-align: left;
  font-family: inherit;
  transition: color .22s cubic-bezier(0.32,0.72,0,1);
}
.pv-landing .hero-caption:hover { color: #fff; }

/* Founding band — sits under the hero, owns the conversion moment */
.pv-landing .founding-band {
  position: relative;
  z-index: 2;
  max-width: 1280px;
  margin: -36px auto 0;
  padding: 0 42px;
}
.pv-landing .founding-band-shell {
  padding: 6px;
  border-radius: 28px;
  background: rgba(20,22,28,.035);
  box-shadow: inset 0 0 0 .5px rgba(20,22,28,.08);
}
.pv-landing .founding-band-core {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
  gap: 28px 48px;
  align-items: center;
  padding: 34px 40px;
  border-radius: 22px;
  background: #fff;
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.9),
    0 24px 56px -36px rgba(12,16,28,.35);
}
.pv-landing .founding-band-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 38ch;
}
.pv-landing .founding-band-kicker {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  background: var(--accent-tint);
  color: var(--accent-on);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.pv-landing .founding-band-kicker .pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(85,105,127,.45);
  animation: pv-founding-pulse 2.4s cubic-bezier(0.32,0.72,0,1) infinite;
}
.pv-landing .founding-band-title {
  margin: 0;
  font-family: var(--display);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -.03em;
  color: var(--ink);
}
.pv-landing .founding-band-lead {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.55;
  color: var(--text-2);
}
.pv-landing .founding-band-form {
  min-width: 0;
}
@keyframes pv-founding-pulse {
  0% { box-shadow: 0 0 0 0 rgba(85,105,127,.4); }
  70% { box-shadow: 0 0 0 8px rgba(85,105,127,0); }
  100% { box-shadow: 0 0 0 0 rgba(85,105,127,0); }
}
@media (prefers-reduced-motion: reduce) {
  .pv-landing .founding-band-kicker .pulse { animation: none; }
}

/* Right-anchored mock: 24px bleed matches 1280 handoff arithmetic;
   on wider viewports the gap to the copy grows instead of centering the window. */
.pv-landing .hero-mock-wrap {
  position: absolute;
  top: 50px;
  right: -24px;
  flex-shrink: 0;
  padding: 5px;
  border-radius: 18px;
  background: rgba(255,255,255,.07);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.18);
}

/* ── Product window mock ── */
.pv-landing .win {
  width: 810px; height: 524px;
  flex-shrink: 0;
  border-radius: 13px;
  overflow: hidden;
  background: transparent;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    0 0 0 .5px rgba(20,22,28,.14),
    0 36px 80px -28px rgba(12,16,28,.55);
  display: flex;
  font-family: var(--sans);
  font-size: 11px;
}
.pv-landing .win-side {
  width: 142px; flex-shrink: 0;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, rgba(240,243,246,.82) 0%, rgba(228,232,237,.86) 100%);
  backdrop-filter: blur(34px) saturate(180%);
  -webkit-backdrop-filter: blur(34px) saturate(180%);
}
.pv-landing .win-lights {
  height: 38px; display: flex; align-items: center;
  padding: 0 12px; gap: 6px;
}
.pv-landing .win-light {
  width: 9px; height: 9px; border-radius: 999px;
}
.pv-landing .win-light.r { background: #FF5F57; }
.pv-landing .win-light.y { background: #FEBC2E; }
.pv-landing .win-light.g { background: #28C840; }
.pv-landing .win-workspace {
  padding: 4px 8px 8px;
  display: flex; align-items: center; gap: 8px; height: 34px;
}
.pv-landing .win-ws-icon {
  width: 22px; height: 22px; border-radius: 6px;
  background: #fff;
  box-shadow: 0 0 0 .5px var(--hairline);
  display: grid; place-items: center;
}
.pv-landing .win-ws-label { font-size: 12px; font-weight: 600; color: var(--ink); }
.pv-landing .win-nav { padding: 0 8px; display: flex; flex-direction: column; gap: 1px; }
.pv-landing .win-nav-item {
  display: flex; align-items: center; gap: 8px;
  height: 26px; padding: 0 8px; border-radius: 7px;
  color: var(--ink-3);
}
.pv-landing .win-nav-item.active {
  background: rgba(20,22,28,.075);
}
.pv-landing .win-nav-item.active span { font-weight: 600; color: var(--ink); }
.pv-landing .win-nav-item .count {
  margin-left: auto; font-size: 10.5px; color: var(--text-4);
  font-variant-numeric: tabular-nums;
}
.pv-landing .win-folders-hd {
  padding: 14px 14px 4px;
  font-size: 10.5px; font-weight: 600; color: #8A8E96;
}
.pv-landing .win-folder {
  display: flex; align-items: center; gap: 8px;
  height: 25px; padding: 0 8px; border-radius: 7px;
}
.pv-landing .win-swatch {
  width: 11px; height: 11px; border-radius: 3px; flex-shrink: 0;
}
.pv-landing .win-folder-name { flex: 1; font-size: 11.5px; color: var(--ink-3); }
.pv-landing .win-folder-count { font-size: 10.5px; color: var(--text-4); }
.pv-landing .win-files { padding-left: 14px; display: flex; flex-direction: column; gap: 1px; }
.pv-landing .win-file {
  display: flex; align-items: center;
  height: 24px; padding: 0 8px; border-radius: 6px;
  font-size: 11px; color: var(--ink-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv-landing .win-file.active {
  background: #fff;
  box-shadow: 0 0 0 .5px var(--hairline);
  font-weight: 600; color: var(--ink);
}

.pv-landing .win-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  background: var(--field);
  box-shadow: -.5px 0 0 var(--hairline);
}
.pv-landing .win-tabs {
  height: 38px; display: flex; align-items: center;
  gap: 8px; padding: 0 10px;
}
.pv-landing .win-tab {
  display: flex; align-items: center; gap: 7px;
  height: 24px; padding: 0 8px; border-radius: 6px;
  background: #fff;
  box-shadow: 0 0 0 .5px rgba(20,22,28,.11);
  max-width: 230px;
}
.pv-landing .win-tab-dot {
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--accent); flex-shrink: 0;
}
.pv-landing .win-tab-title {
  font-size: 11px; font-weight: 600; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv-landing .win-tab-inactive {
  font-size: 11px; color: var(--text-3);
  padding: 0 6px; white-space: nowrap;
}
.pv-landing .win-ask {
  margin-left: auto;
  height: 22px; padding: 0 9px; border-radius: 6px;
  background: var(--accent); color: #fff;
  font-size: 11px; font-weight: 600;
  display: flex; align-items: center;
}
.pv-landing .win-body {
  flex: 1; display: flex; gap: 9px;
  padding: 0 9px 9px; min-height: 0;
}
.pv-landing .win-reader {
  flex: 1; min-width: 0;
  border-radius: 9px;
  background: var(--desk);
  box-shadow: 0 0 0 .5px var(--hairline);
  overflow: hidden;
  display: flex; justify-content: center; align-items: flex-start;
  padding-top: 14px;
  position: relative;
}
.pv-landing .win-sheet {
  /* Size from the page image; never force a mismatched box + object-fit:cover
     (that was cropping the left margin of the PDF). Reader clips the bottom. */
  position: relative;
  width: min(100%, 344px);
  max-height: 100%;
  background: #fff; border-radius: 3px;
  box-shadow: 0 0 0 .5px var(--hairline), 0 10px 24px -14px rgba(20,22,28,.32);
  overflow: hidden;
  align-self: flex-start;
  flex-shrink: 0;
}
.pv-landing .win-sheet-page {
  position: relative;
  width: 100%;
}
.pv-landing .win-sheet-img {
  display: block;
  width: 100%;
  height: auto;
}
/* Citation band — PDF coords for the chat quote on page 1 (A4). */
.pv-landing .win-sheet-hl {
  position: absolute;
  left: 8.57%;
  top: 61.45%;
  width: 38.89%;
  height: 4%;
  border-radius: 2px;
  background: var(--highlight);
  mix-blend-mode: multiply;
  box-shadow: inset 0 0 0 .5px rgba(85,105,127,.22);
  pointer-events: none;
  animation: pv-win-hl-in .55s cubic-bezier(0.32, 0.72, 0, 1) .35s both;
}
@keyframes pv-win-hl-in {
  from { opacity: 0; transform: scaleY(.85); }
  to { opacity: 1; transform: scaleY(1); }
}
.pv-landing .win-sheet-open {
  position: absolute;
  left: 50%; top: 42%;
  z-index: 2;
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 12px;
  border-radius: 8px;
  background: rgba(252,252,253,.94);
  color: var(--ink);
  font-size: 11px; font-weight: 600; letter-spacing: -.01em;
  text-decoration: none;
  box-shadow:
    0 0 0 .5px rgba(20,22,28,.16),
    0 10px 28px -10px rgba(12,16,28,.45);
  backdrop-filter: blur(12px);
  opacity: 0;
  transform: translate(-50%, 6px);
  pointer-events: none;
  transition: opacity .22s cubic-bezier(0.32, 0.72, 0, 1),
    transform .22s cubic-bezier(0.32, 0.72, 0, 1),
    background .15s ease;
}
.pv-landing .win-sheet-open svg { opacity: .7; }
.pv-landing .win-sheet::after {
  content: "";
  position: absolute; inset: 0;
  background: rgba(16, 20, 28, .0);
  pointer-events: none;
  transition: background .22s ease;
  z-index: 1;
}
.pv-landing .win-sheet:hover::after,
.pv-landing .win-sheet:focus-within::after {
  background: rgba(16, 20, 28, .18);
}
.pv-landing .win-sheet:hover .win-sheet-open,
.pv-landing .win-sheet:focus-within .win-sheet-open {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}
.pv-landing .win-sheet-open:hover {
  background: #fff;
}
.pv-landing .win-sheet-open:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.pv-landing .win-toolbar {
  position: absolute; left: 50%; bottom: 11px;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  height: 26px; padding: 0 10px;
  border-radius: 8px;
  background: rgba(252,252,253,.86);
  backdrop-filter: blur(20px);
  box-shadow: 0 0 0 .5px rgba(20,22,28,.14), 0 6px 16px -6px rgba(20,22,28,.3);
}
.pv-landing .win-toolbar span { font-size: 10.5px; font-weight: 600; color: var(--ink); }
.pv-landing .win-toolbar .muted { color: var(--text-4); font-weight: 400; }
.pv-landing .win-toolbar .sep { width: .5px; height: 12px; background: rgba(20,22,28,.14); }
.pv-landing .win-hl-btn {
  height: 19px; padding: 0 8px; border-radius: 6px;
  background: var(--accent); color: #fff;
  font-size: 10px; font-weight: 600;
  display: flex; align-items: center;
}

.pv-landing .win-chat {
  width: 214px; flex-shrink: 0;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 0 0 .5px var(--hairline), 0 2px 6px rgba(20,22,28,.06);
  display: flex; flex-direction: column;
  padding: 11px; gap: 10px;
  overflow: hidden;
}
.pv-landing .win-chat-hd { font-size: 11.5px; font-weight: 600; color: var(--ink); }
.pv-landing .win-user {
  align-self: flex-end; max-width: 88%;
  background: #2B2C30; color: #fff;
  border-radius: 11px; padding: 6px 9px;
  font-size: 9.5px; line-height: 1.45;
}
.pv-landing .win-answer {
  font-family: Georgia, serif;
  font-size: 11px; line-height: 1.55; color: var(--ink-2);
}
.pv-landing .win-cite {
  display: inline-flex; vertical-align: super; margin-left: 2px;
  min-width: 13px; height: 13px; padding: 0 3px;
  border-radius: 4px; background: var(--accent-tint);
  color: var(--accent-on);
  font-family: var(--sans); font-size: 7.5px; font-weight: 700;
  align-items: center; justify-content: center;
}
.pv-landing .win-src {
  border-radius: 8px; background: var(--fill-2);
  padding: 8px 9px; display: flex; gap: 7px;
}
.pv-landing .win-src-num {
  width: 13px; height: 13px; flex-shrink: 0;
  border-radius: 4px; background: var(--accent-tint);
  color: var(--accent-on); font-size: 7.5px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
}
.pv-landing .win-src-quote {
  font-family: Georgia, serif;
  font-size: 9.5px; line-height: 1.45;
  color: var(--text-2); font-style: italic;
}
.pv-landing .win-src-meta {
  font-size: 8.5px; color: var(--text-4); margin-top: 3px;
}
.pv-landing .win-src-meta strong { color: var(--text-2); }
.pv-landing .win-src-meta .jump { font-weight: 600; color: var(--accent); }
.pv-landing .win-composer {
  margin-top: auto;
  border-radius: 10px;
  box-shadow: 0 0 0 .5px rgba(20,22,28,.13);
  padding: 8px 9px;
  display: flex; flex-direction: column; gap: 8px;
}
.pv-landing .win-composer-ph { font-size: 10px; color: #A6AAB3; }
.pv-landing .win-composer-row {
  display: flex; align-items: center; gap: 5px;
}
.pv-landing .win-model {
  height: 20px; padding: 0 7px; border-radius: 6px;
  background: var(--fill-1); font-size: 9.5px; font-weight: 600;
  color: var(--ink-3); display: flex; align-items: center;
}
.pv-landing .win-send {
  margin-left: auto;
  width: 22px; height: 20px; border-radius: 6px;
  background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
}

/* ── Feature row ── */
.pv-landing .features-row {
  padding: 56px 42px 0;
  max-width: 1280px; margin: 0 auto;
}
.pv-landing .features-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--rule);
}
.pv-landing .feat-col {
  padding: 26px 24px 34px;
  border-right: 1px solid var(--rule);
  display: flex; flex-direction: column; gap: 11px;
}
.pv-landing .feat-col:last-child { border-right: none; }
.pv-landing .feat-col svg { color: var(--accent); }
.pv-landing .feat-col h4 {
  font-family: var(--display); font-weight: 600;
  font-size: 19px; line-height: 1.2; margin: 0;
}
.pv-landing .feat-col p {
  font-size: 14px; line-height: 1.6; color: var(--text-2); margin: 0;
}

/* ── Section shared ── */
.pv-landing .section {
  padding: 82px 42px 0;
  max-width: 1280px; margin: 0 auto;
}
.pv-landing .eyebrow {
  font-size: 11px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--accent);
  font-weight: 700;
  display: block; margin-bottom: 12px;
}
.pv-landing .section-title {
  font-family: var(--display); font-weight: 700;
  font-size: 38px; line-height: 1.1;
  letter-spacing: -.03em;
  margin: 0;
}

/* ── How it works ── */
.pv-landing .how-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 52px; align-items: center;
}
.pv-landing .how-img {
  position: relative; height: 420px;
  border-radius: 18px; overflow: hidden;
  box-shadow: 0 1px 2px rgba(20,22,28,.06), 0 24px 50px -30px rgba(20,22,28,.4);
}
.pv-landing .how-img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.pv-landing .how-steps { display: flex; flex-direction: column; }
.pv-landing .how-step {
  display: flex; gap: 18px;
  padding: 20px 0;
  border-top: 1px solid var(--rule);
}
.pv-landing .how-step:last-child { border-bottom: 1px solid var(--rule); }
.pv-landing .how-num {
  font-family: var(--display); font-weight: 600;
  font-size: 14px; color: var(--accent);
  padding-top: 2px;
}
.pv-landing .how-step h4 {
  font-family: var(--display); font-weight: 600;
  font-size: 19px; margin: 0 0 5px;
}
.pv-landing .how-step p {
  font-size: 14.5px; line-height: 1.6;
  color: var(--text-2); max-width: 42ch; margin: 0;
}

/* ── Privacy ── */
.pv-landing .privacy-wrap {
  position: relative;
  border-radius: 20px; overflow: hidden;
  min-height: 420px; display: flex;
}
.pv-landing .privacy-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: cover;
}
.pv-landing .privacy-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(96deg, rgba(14,20,26,.92), rgba(14,20,26,.78) 46%, rgba(14,20,26,.34));
}
.pv-landing .privacy-inner {
  position: relative;
  padding: 52px 44px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 44px; align-items: center;
  width: 100%;
}
.pv-landing .privacy-text { display: flex; flex-direction: column; gap: 18px; }
.pv-landing .privacy-eyebrow {
  font-size: 11px; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.5);
  font-weight: 700;
}
.pv-landing .privacy-title {
  font-family: var(--display); font-weight: 700;
  font-size: 38px; line-height: 1.1;
  letter-spacing: -.03em; color: #fff;
  max-width: 18ch; margin: 0;
}
.pv-landing .privacy-copy {
  font-size: 15.5px; line-height: 1.65;
  color: rgba(255,255,255,.72); max-width: 44ch; margin: 0;
}
.pv-landing .privacy-stats {
  display: flex; gap: 32px; margin-top: 4px;
}
.pv-landing .privacy-stat-val {
  font-family: var(--display); font-weight: 700;
  font-size: 30px; line-height: 1; color: #fff;
}
.pv-landing .privacy-stat-label {
  font-size: 12px; color: rgba(255,255,255,.55);
}
.pv-landing .privacy-cols {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px; align-items: center;
}
.pv-landing .privacy-glass {
  border-radius: 16px;
  background: rgba(255,255,255,.10);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.18);
  padding: 18px 16px;
  display: flex; flex-direction: column; gap: 9px;
}
.pv-landing .privacy-glass-hd {
  font-size: 10.5px; letter-spacing: .1em;
  text-transform: uppercase; font-weight: 700;
  color: #C4D2E0;
}
.pv-landing .privacy-glass.off .privacy-glass-hd { color: rgba(255,255,255,.5); }
.pv-landing .privacy-glass span {
  font-size: 13px; color: rgba(255,255,255,.82);
}
.pv-landing .privacy-glass-note {
  margin-top: 4px; padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,.16);
  font-size: 12px; color: rgba(255,255,255,.55);
  line-height: 1.55;
}
.pv-landing .privacy-divider {
  display: flex; flex-direction: column;
  align-items: center; gap: 6px;
  color: rgba(255,255,255,.4);
}
.pv-landing .privacy-divider .line {
  width: 24px; height: 1px; background: currentColor;
}
.pv-landing .privacy-divider span {
  font-size: 9.5px; letter-spacing: .08em; font-weight: 700;
}

/* ── Pricing ── */
.pv-landing .pricing-head {
  display: flex; flex-direction: column;
  align-items: center; text-align: center;
  gap: 13px; margin-bottom: 34px;
}
.pv-landing .pricing-head .section-title {
  font-size: 40px; max-width: 22ch;
}
.pv-landing .pricing-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 16px;
}
.pv-landing .price-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 0 0 .5px var(--hairline), 0 2px 8px rgba(20,22,28,.05);
  padding: 34px 32px;
  display: flex; flex-direction: column; gap: 17px;
}
.pv-landing .price-card.muted {
  background: var(--fill-1);
  box-shadow: none;
}
.pv-landing .price-badge {
  height: 26px; padding: 0 11px;
  border-radius: 999px;
  background: var(--accent-tint); color: var(--accent-on);
  font-size: 11.5px; font-weight: 700;
  display: inline-flex; align-items: center;
  align-self: flex-start;
}
.pv-landing .price-badge.grey {
  background: var(--rule); color: var(--text-2);
}
.pv-landing .price-row {
  display: flex; align-items: baseline; gap: 10px;
}
.pv-landing .price-amount {
  font-family: var(--display); font-weight: 700;
  font-size: 56px; line-height: 1;
  letter-spacing: -.04em;
}
.pv-landing .price-sub { font-size: 15.5px; color: var(--text-2); }
.pv-landing .price-copy {
  font-size: 15px; line-height: 1.65;
  color: var(--text-2); max-width: 46ch; margin: 0;
}
.pv-landing .price-stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.pv-landing .price-stat {
  background: var(--fill-1); border-radius: 12px;
  padding: 14px; display: flex; flex-direction: column; gap: 3px;
}
.pv-landing .price-stat-val { font-size: 19px; font-weight: 700; }
.pv-landing .price-stat-label { font-size: 12px; color: var(--text-4); }
.pv-landing .btn-accent {
  align-self: flex-start; margin-top: 2px;
  height: 46px; padding: 0 22px;
  border-radius: 12px; border: none;
  background: var(--accent); color: #fff;
  font-size: 14.5px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 9px;
  cursor: pointer;
  transition: background .12s ease;
}
.pv-landing .btn-accent:hover { background: var(--accent-hover); }
.pv-landing .price-later-title {
  font-family: var(--display); font-weight: 600;
  font-size: 27px; line-height: 1.14; margin: 0;
}
.pv-landing .price-bullets {
  display: flex; flex-direction: column; gap: 8px;
}
.pv-landing .price-bullet {
  display: flex; align-items: center; gap: 9px;
  font-size: 14px; color: var(--text-2);
}
.pv-landing .price-bullet .dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: #B9BEC6; flex-shrink: 0;
}
.pv-landing .notify-row {
  margin-top: auto;
  background: #fff; border-radius: 12px;
  box-shadow: 0 0 0 .5px var(--hairline);
  padding: 12px 13px;
  display: flex; align-items: center; gap: 9px;
}
.pv-landing .notify-row input {
  flex: 1; border: 0; outline: 0; background: transparent;
  font-family: inherit; font-size: 13px; color: var(--ink);
}
.pv-landing .notify-row input::placeholder { color: var(--text-4); }
.pv-landing .notify-btn {
  font-size: 13px; font-weight: 700; color: var(--accent);
  background: none; border: 0; cursor: pointer; padding: 0;
}

/* ── FAQ ── */
.pv-landing .faq-section {
  padding-bottom: 90px;
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 52px; align-items: start;
}
.pv-landing .faq-title {
  font-family: var(--display); font-weight: 700;
  font-size: 34px; line-height: 1.12;
  letter-spacing: -.03em; margin: 0;
}
.pv-landing .faq-list { display: flex; flex-direction: column; }
.pv-landing .faq-item {
  border-top: 1px solid var(--rule);
  padding: 20px 0;
}
.pv-landing .faq-item:last-child {
  border-bottom: 1px solid var(--rule);
}
.pv-landing .faq-item summary {
  list-style: none;
  display: flex; align-items: center; gap: 16px;
  cursor: pointer;
  font-family: var(--display); font-weight: 600;
  font-size: 17px; flex: 1;
}
.pv-landing .faq-item summary::-webkit-details-marker { display: none; }
.pv-landing .faq-icon {
  width: 17px; height: 17px; flex-shrink: 0;
  color: var(--text-4);
}
.pv-landing .faq-item[open] .faq-icon-minus { display: block; }
.pv-landing .faq-item:not([open]) .faq-icon-plus { display: block; }
.pv-landing .faq-item[open] .faq-icon-plus { display: none; }
.pv-landing .faq-item:not([open]) .faq-icon-minus { display: none; }
.pv-landing .faq-item p {
  font-size: 14.5px; line-height: 1.65;
  color: var(--text-2); max-width: 58ch;
  margin: 9px 0 0;
}

/* ── Footer ── */
.pv-landing .site-footer {
  position: relative; overflow: hidden;
}
.pv-landing .footer-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: cover;
}
.pv-landing .footer-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(16,22,20,.80), rgba(16,22,20,.96));
}
.pv-landing .footer-inner {
  position: relative;
  padding: 64px 42px 34px;
  display: flex; flex-direction: column; gap: 44px;
  max-width: 1280px; margin: 0 auto;
}
.pv-landing .footer-cta-row {
  display: flex; align-items: flex-end;
  justify-content: space-between; gap: 40px;
}
.pv-landing .footer-cta-title {
  font-family: var(--display); font-weight: 700;
  font-size: 42px; line-height: 1.08;
  letter-spacing: -.03em; color: #fff;
  max-width: 16ch; margin: 0;
}
.pv-landing .footer-email-pill {
  display: flex; align-items: center; gap: 10px;
  height: 54px; padding: 0 6px 0 18px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.22);
  flex-shrink: 0;
}
.pv-landing .footer-email-pill input {
  width: 190px; border: 0; outline: 0; background: transparent;
  font-family: inherit; font-size: 14.5px;
  color: #fff;
}
.pv-landing .footer-email-pill input::placeholder { color: rgba(255,255,255,.6); }
.pv-landing .footer-email-btn {
  height: 42px; padding: 0 20px;
  border-radius: 999px; border: none;
  background: #FAFAFA; color: var(--ink);
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: background .12s ease;
}
.pv-landing .footer-email-btn:hover { background: #fff; }
.pv-landing .footer-rule {
  height: 1px; background: rgba(255,255,255,.14);
}
.pv-landing .footer-mid {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 40px;
}
.pv-landing .footer-brand { max-width: 34ch; }
.pv-landing .footer-brand-row {
  display: flex; align-items: center; gap: 9px;
  margin-bottom: 13px;
}
.pv-landing .footer-glyph {
  width: 24px; height: 24px; border-radius: 7px;
  background: #FAFAFA;
  display: grid; place-items: center;
}
.pv-landing .footer-brand-name {
  font-family: var(--display); font-weight: 600;
  font-size: 17px; color: #fff;
}
.pv-landing .footer-brand p {
  font-size: 13.5px; line-height: 1.6;
  color: rgba(255,255,255,.55); margin: 0;
}
.pv-landing .footer-cols {
  display: flex; gap: 52px;
}
.pv-landing .footer-col {
  display: flex; flex-direction: column; gap: 9px;
}
.pv-landing .footer-col-hd {
  font-size: 10.5px; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.4);
  font-weight: 700;
}
.pv-landing .footer-col a,
.pv-landing .footer-col button {
  font-size: 14px; color: rgba(255,255,255,.75);
  background: none; border: 0; cursor: pointer;
  padding: 0; font-family: inherit;
  text-align: left;
  transition: color .12s ease;
}
.pv-landing .footer-col a:hover,
.pv-landing .footer-col button:hover { color: #fff; }
.pv-landing .footer-bottom {
  display: flex; align-items: center;
  justify-content: space-between; gap: 20px;
  padding-top: 8px;
  font-size: 12.5px; color: rgba(255,255,255,.4);
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .pv-landing .hero-row {
    flex-direction: column;
    padding: 32px 24px 48px;
    align-items: center;
    min-height: 0;
  }
  .pv-landing .hero-text { width: 100%; max-width: 520px; }
  .pv-landing .hero-mock-wrap {
    position: relative;
    top: auto;
    right: auto;
    margin-top: 32px;
    transform: scale(.85); transform-origin: top center;
  }
  .pv-landing .nav-links { display: none; }
  .pv-landing .founding-band { margin-top: -12px; padding: 0 24px; }
  .pv-landing .founding-band-core {
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 28px 24px;
  }
}
@media (max-width: 900px) {
  .pv-landing .features-grid { grid-template-columns: 1fr 1fr; }
  .pv-landing .feat-col { border-right: none; border-bottom: 1px solid var(--rule); }
  .pv-landing .feat-col:nth-child(odd) { border-right: 1px solid var(--rule); }
  .pv-landing .how-grid { grid-template-columns: 1fr; gap: 32px; }
  .pv-landing .how-img { height: 280px; }
  .pv-landing .privacy-inner { grid-template-columns: 1fr; gap: 32px; }
  .pv-landing .pricing-grid { grid-template-columns: 1fr; }
  .pv-landing .faq-section { grid-template-columns: 1fr; gap: 28px; }
  .pv-landing .footer-cta-row { flex-direction: column; align-items: flex-start; }
  .pv-landing .footer-mid { flex-direction: column; }
  .pv-landing .footer-cols { flex-wrap: wrap; gap: 32px; }
}
@media (max-width: 640px) {
  .pv-landing .nav-wrap { padding: 16px 16px 0; }
  .pv-landing .nav-pill { padding: 0 8px 0 14px; }
  .pv-landing .nav-name { font-size: 15px; }
  .pv-landing .gh-glass .lbl { display: none; }
  .pv-landing .hero { min-height: auto; }
  .pv-landing .hero-title { font-size: 36px; }
  .pv-landing .hero-mock-wrap { transform: scale(.62); width: 100%; }
  .pv-landing .founding-band { padding: 0 16px; margin-top: 8px; }
  .pv-landing .founding-band-title { font-size: 26px; }
  .pv-landing .founding-band-core { padding: 22px 18px; border-radius: 18px; }
  .pv-landing .founding-band-shell { border-radius: 22px; }
  .pv-landing .win { width: 810px; }
  .pv-landing .features-row,
  .pv-landing .section { padding-left: 20px; padding-right: 20px; }
  .pv-landing .features-grid { grid-template-columns: 1fr; }
  .pv-landing .feat-col,
  .pv-landing .feat-col:nth-child(odd) { border-right: none; }
  .pv-landing .privacy-inner { padding: 36px 24px; }
  .pv-landing .privacy-cols { grid-template-columns: 1fr; }
  .pv-landing .privacy-divider { flex-direction: row; padding: 8px 0; }
  .pv-landing .footer-inner { padding: 48px 20px 28px; }
  .pv-landing .footer-email-pill { width: 100%; }
  .pv-landing .footer-email-pill input { width: auto; flex: 1; min-width: 0; }
}
`;

function formatStars(n) {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n / 1000) + "k";
}

const BUILD_TIME_REPO_SNAPSHOT =
  typeof __GH_REPO_SNAPSHOT__ !== "undefined" ? __GH_REPO_SNAPSHOT__ : null;

function useGitHubStars(repo) {
  const [stars, setStars] = useState(() => {
    try {
      const raw = localStorage.getItem(STAR_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.repo === repo && Date.now() - parsed.ts < STAR_CACHE_TTL) {
          return parsed.data?.stars ?? null;
        }
      }
    } catch {}
    if (BUILD_TIME_REPO_SNAPSHOT?.stars != null) return BUILD_TIME_REPO_SNAPSHOT.stars;
    return null;
  });

  useEffect(() => {
    if (stars != null) return;
    let cancelled = false;
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (cancelled) return;
        const next = typeof json.stargazers_count === "number" ? json.stargazers_count : null;
        setStars(next);
        try {
          localStorage.setItem(
            STAR_CACHE_KEY,
            JSON.stringify({ repo, data: { stars: next }, ts: Date.now() })
          );
        } catch {}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [repo, stars]);

  return stars;
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

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#17181A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 4h9l4 4v12H6z" /><path d="M9 11h7M9 15h5" />
    </svg>
  );
}

function GhGlassStar() {
  const stars = useGitHubStars(GITHUB_REPO);
  return (
    <a
      className="gh-glass"
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Star on GitHub${stars != null ? ` — ${stars.toLocaleString()} stars` : ""}`}
    >
      <GhMarkIcon />
      <span className="lbl">Star</span>
      {stars != null && (
        <>
          <StarIcon style={{ width: 11, height: 11, opacity: 0.7 }} />
          <span className="num">{formatStars(stars)}</span>
        </>
      )}
    </a>
  );
}

function ProductWindow() {
  return (
    <div className="win">
      <div className="win-side" aria-hidden="true">
        <div className="win-lights">
          <span className="win-light r" /><span className="win-light y" /><span className="win-light g" />
        </div>
        <div className="win-workspace">
          <div className="win-ws-icon"><DocIcon /></div>
          <span className="win-ws-label">Thesis library</span>
        </div>
        <div className="win-nav">
          <div className="win-nav-item active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#55697F" strokeWidth="1.8" strokeLinecap="round"><path d="M6 4h9l4 4v12H6z" /></svg>
            <span>Reading</span>
          </div>
          <div className="win-nav-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E7178" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7.5a2 2 0 0 1 2-2h4l1.8 2h6.2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></svg>
            <span>Library</span><span className="count">21</span>
          </div>
          <div className="win-nav-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E7178" strokeWidth="1.8" strokeLinecap="round"><path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1z" /></svg>
            <span>Research agent</span>
          </div>
        </div>
        <div className="win-folders-hd">Folders</div>
        <div className="win-folder">
          <span className="win-swatch" style={{ background: "#55697F" }} />
          <span className="win-folder-name">Reliability</span>
          <span className="win-folder-count">7</span>
        </div>
        <div className="win-files">
          <div className="win-file active">AI Hallucinations…</div>
          <div className="win-file">Survey of RAG methods</div>
          <div className="win-file">Truthful QA</div>
        </div>
        <div className="win-folder">
          <span className="win-swatch" style={{ background: "#7C8B9C" }} />
          <span className="win-folder-name">Transformers</span>
          <span className="win-folder-count">6</span>
        </div>
        <div className="win-folder">
          <span className="win-swatch" style={{ background: "#B3BDC8" }} />
          <span className="win-folder-name">Thesis — ch. 3</span>
          <span className="win-folder-count">4</span>
        </div>
      </div>

      <div className="win-main">
        <div className="win-tabs" aria-hidden="true">
          <div className="win-tab">
            <span className="win-tab-dot" />
            <span className="win-tab-title">Comprehensive Review of AI Hallucinations</span>
          </div>
          <span className="win-tab-inactive">Survey of RAG methods</span>
          <span className="win-ask">Ask</span>
        </div>
        <div className="win-body">
          <div className="win-reader">
            <div className="win-sheet">
              <div className="win-sheet-page" aria-hidden="true">
                <img
                  className="win-sheet-img"
                  src="/media/mock-paper-hallucinations-p1.jpg"
                  alt=""
                  width="720"
                  height="1018"
                  decoding="async"
                />
                <div className="win-sheet-hl" />
              </div>
              <a
                className="win-sheet-open"
                href={MOCK_PAPER_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read paper
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </a>
            </div>
            <div className="win-toolbar" aria-hidden="true">
              <span>1 <span className="muted">/ 13</span></span>
              <span className="sep" />
              <span>100%</span>
              <span className="win-hl-btn">Highlight</span>
            </div>
          </div>
          <div className="win-chat" aria-hidden="true">
            <div className="win-chat-hd">Why models hallucinate</div>
            <div className="win-user">What makes hallucinations so hard to spot?</div>
            <div className="win-answer">
              They arrive with high confidence and fluency, so nothing in the text signals that it is fabricated.<span className="win-cite">1</span>
            </div>
            <div className="win-answer">
              The model predicts likely next words rather than verifying facts.<span className="win-cite">2</span>
            </div>
            <div className="win-src">
              <span className="win-src-num">1</span>
              <div>
                <div className="win-src-quote">"These hallucinations are often presented with high confidence and fluency, making them difficult for users to detect."</div>
                <div className="win-src-meta"><strong>§1 Introduction</strong> · page 1 &nbsp;<span className="jump">Jump →</span></div>
              </div>
            </div>
            <div className="win-composer">
              <span className="win-composer-ph">Ask about this paper…</span>
              <div className="win-composer-row">
                <span className="win-model">gpt-5.4-mini</span>
                <span className="win-send">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "Which browsers work?",
    open: true,
    a: "Chrome and Edge, because Paperview uses the File System Access API to read your folders directly. Safari and Firefox can still open uploaded PDFs, just not a folder in place.",
  },
  {
    q: "Where is my API key stored?",
    a: "In your browser's localStorage, or encrypted behind a passphrase you choose. It never touches Paperview servers — there are none.",
  },
  {
    q: "Can I self-host it?",
    a: "Yes. Paperview is AGPL-3.0. Clone the repo, build with Vite, and serve the static dist folder anywhere.",
  },
  {
    q: "Does it work with Zotero or BibTeX?",
    a: "Paperview reads PDFs from any folder. Export BibTeX from the library view; Zotero integration is on the roadmap.",
  },
  {
    q: "What happens to my notes if I stop using it?",
    a: "They stay in IndexedDB and in .paperview.json if you linked a writable folder. Uninstalling the browser clears local data unless you exported or synced the folder file.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const auth = useAuthContext();
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
      document.head.appendChild(style);
    }
    document.querySelector('style[data-paperview-landing]').textContent = CSS;
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.body.style.background = "#FAFAFA";

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const openApp = () => navigate("/app");

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="pv-landing">
      <header className="hero">
        <img className="hero-bg" src="/media/hero-wildflower-hills.png" alt="" />
        <div className="hero-overlay" />
        <div className="hero-fade" />

        <div className="nav-wrap">
          <nav className={`nav-pill${scrolled ? " scrolled" : ""}`}>
            <div className="nav-brand">
              <div className="nav-glyph"><DocIcon /></div>
              <span className="nav-name">Paperview</span>
            </div>
            <div className="nav-links">
              <button type="button" className="nav-link" onClick={() => scrollTo("how")}>How it works</button>
              <button type="button" className="nav-link" onClick={() => scrollTo("features")}>Features</button>
              <button type="button" className="nav-link" onClick={() => scrollTo("privacy")}>Privacy</button>
              <button type="button" className="nav-link" onClick={() => scrollTo("pricing")}>Pricing</button>
              <button type="button" className="nav-link" onClick={() => scrollTo("founding")}>Founding</button>
              <a className="nav-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Docs</a>
            </div>
            <div className="nav-right">
              {auth.profile?.founding ? (
                <button type="button" className="nav-link" onClick={() => scrollTo("founding")} title="Founding member">
                  #{auth.profile.founder_number}
                </button>
              ) : auth.user ? (
                <button type="button" className="nav-link" onClick={() => scrollTo("founding")}>Waitlist</button>
              ) : null}
              <GhGlassStar />
              <button type="button" className="nav-cta" onClick={openApp}>Open Paperview</button>
            </div>
          </nav>
        </div>

        <div className="hero-row">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="dot" />
              <span>Open source · AGPL-3.0 · local-first</span>
            </div>
            <h1 className="hero-title">Every answer walks you back to the page it came from</h1>
            <p className="hero-copy">
              Paperview reads a folder of PDFs straight off your disk and answers with citations that jump to the exact paragraph. No upload, no subscription — bring your own API key and pay cents per question.
            </p>
            <div className="hero-ctas">
              <button type="button" className="btn-primary" onClick={openApp}>
                Open a folder of papers
                <span className="btn-primary-ico" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13m0 0-5-5m5 5-5 5" /></svg>
                </span>
              </button>
              <a className="btn-glass" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Read the source</a>
            </div>
            <button
              type="button"
              className="hero-caption"
              onClick={() => scrollTo("founding")}
            >
              Founding members — €2 when credits launch ↓
            </button>
          </div>
          <div className="hero-mock-wrap">
            <ProductWindow />
          </div>
        </div>
      </header>

      <section className="founding-band" id="founding" aria-labelledby="founding-band-title">
        <div className="founding-band-shell">
          <div className="founding-band-core">
            <div className="founding-band-copy">
              <span className="founding-band-kicker">
                <span className="pulse" aria-hidden="true" />
                Founding launch
              </span>
              <h2 className="founding-band-title" id="founding-band-title">
                First 100 get €2 credits when pay-per-use ships
              </h2>
              <p className="founding-band-lead">
                Magic-link signup now. Founding spots get the grant at launch; after 100, you join the waitlist. BYOK stays free forever either way.
              </p>
            </div>
            <div className="founding-band-form">
              <FoundingSignup auth={auth} />
            </div>
          </div>
        </div>
      </section>

      <section className="features-row" id="features">
        <div className="features-grid">
          <div className="feat-col">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" /></svg>
            <h4>Clickable citations</h4>
            <p>Every claim carries a numbered anchor. Open it and the reader scrolls to that sentence, highlighted.</p>
          </div>
          <div className="feat-col">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
            <h4>Ask across the library</h4>
            <p>Scope a question to one paper, a chapter&apos;s folder, or all 21 — retrieval ranks and cites by file.</p>
          </div>
          <div className="feat-col">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            <h4>Nothing is uploaded</h4>
            <p>Indexing, OCR, notes and chat history all stay in your browser, against your filesystem.</p>
          </div>
          <div className="feat-col">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 3v18M7 7h8.5a3 3 0 0 1 0 6H7" /></svg>
            <h4>Cents, not a plan</h4>
            <p>Your own API key, billed to you at cost. Paperview shows the price of each answer inline.</p>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="how-grid">
          <div className="how-img">
            <img src="/media/hero-misty-valley.png" alt="" />
          </div>
          <div>
            <span className="eyebrow">How it works</span>
            <h2 className="section-title" style={{ marginBottom: 26 }}>From a messy folder to a cited answer</h2>
            <div className="how-steps">
              <div className="how-step">
                <span className="how-num">01</span>
                <div>
                  <h4>Point it at a folder</h4>
                  <p>Grant read access to a directory of PDFs. Paperview indexes them in place — no copying, no import wizard.</p>
                </div>
              </div>
              <div className="how-step">
                <span className="how-num">02</span>
                <div>
                  <h4>Paste your own key</h4>
                  <p>Held in memory, or encrypted behind a passphrase only you know. Every request is billed to you, at cost.</p>
                </div>
              </div>
              <div className="how-step">
                <span className="how-num">03</span>
                <div>
                  <h4>Ask, then verify</h4>
                  <p>Answers arrive with numbered citations. Click one and the reader jumps to that paragraph, on that page.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="privacy">
        <div className="privacy-wrap">
          <img className="privacy-bg" src="/media/photo-forest.jpg" alt="" />
          <div className="privacy-overlay" />
          <div className="privacy-inner">
            <div className="privacy-text">
              <span className="privacy-eyebrow">Privacy is architecture</span>
              <h3 className="privacy-title">Your unpublished work never touches our servers</h3>
              <p className="privacy-copy">
                There is no Paperview account and no Paperview database. The only thing that leaves your machine is the text you deliberately send to OpenAI, on your key.
              </p>
              <div className="privacy-stats">
                <div>
                  <div className="privacy-stat-val">0</div>
                  <div className="privacy-stat-label">accounts</div>
                </div>
                <div>
                  <div className="privacy-stat-val">0</div>
                  <div className="privacy-stat-label">PDFs uploaded</div>
                </div>
                <div>
                  <div className="privacy-stat-val">1</div>
                  <div className="privacy-stat-label">call, made by you</div>
                </div>
              </div>
            </div>
            <div className="privacy-cols">
              <div className="privacy-glass">
                <span className="privacy-glass-hd">Stays on disk</span>
                <span>PDF files</span>
                <span>Extracted text &amp; OCR</span>
                <span>Highlights and notes</span>
                <span>Chat threads</span>
                <span>Your API key</span>
              </div>
              <div className="privacy-divider">
                <span className="line" />
                <span>ON ASK</span>
                <span className="line" />
              </div>
              <div className="privacy-glass off">
                <span className="privacy-glass-hd">Sent to OpenAI</span>
                <span>The passages you asked about</span>
                <span>Your question</span>
                <div className="privacy-glass-note">That&apos;s the whole list. Nothing is retained by us, because there is no us to retain it.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="pricing-head">
          <span className="eyebrow">What it costs</span>
          <h2 className="section-title">No plan. No seat. No trial that expires mid-chapter.</h2>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="price-badge">Available today</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)" }}>Bring your own key</span>
            </div>
            <div className="price-row">
              <span className="price-amount">€0</span>
              <span className="price-sub">for Paperview, forever</span>
            </div>
            <p className="price-copy">
              You pay OpenAI directly for the tokens you use — typically a fraction of a cent per question. The running cost of every answer is shown inline.
            </p>
            <div className="price-stats">
              <div className="price-stat">
                <span className="price-stat-val">$0.004</span>
                <span className="price-stat-label">a typical cited answer</span>
              </div>
              <div className="price-stat">
                <span className="price-stat-val">$0.00</span>
                <span className="price-stat-label">reading &amp; annotating</span>
              </div>
            </div>
            <button type="button" className="btn-accent" onClick={openApp}>
              Open Paperview
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h13m0 0-5-5m5 5-5 5" /></svg>
            </button>
          </div>
          <div className="price-card muted">
            <span className="price-badge grey">Founding · limited</span>
            <h3 className="price-later-title">Top up credits instead</h3>
            <p className="price-copy">
              Prefer not to hold an OpenAI key? Claim one of 100 founding spots for €2 credits when pay-per-use launches — or join the waitlist after. Still pay-per-use. BYOK stays free forever.
            </p>
            <div className="price-bullets">
              <div className="price-bullet"><span className="dot" />First 100 founders get €2 at launch</div>
              <div className="price-bullet"><span className="dot" />Prepaid balance, no expiry (when live)</div>
              <div className="price-bullet"><span className="dot" />Bring your own key stays free</div>
            </div>
            <button type="button" className="btn-accent" onClick={() => scrollTo("founding")}>
              Claim a founding spot
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
            </button>
          </div>
        </div>
      </section>

      <section className="section faq-section" id="faq">
        <div>
          <span className="eyebrow">Questions</span>
          <h2 className="faq-title">Before you hand it your library</h2>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="faq-item" open={item.open || undefined}>
              <summary>
                <span>{item.q}</span>
                <svg className="faq-icon faq-icon-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
                <svg className="faq-icon faq-icon-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <FoundingWelcome
        auth={auth}
        onOpenApp={openApp}
      />

      <footer className="site-footer">
        <img className="footer-bg" src="/media/photo-nature.jpg" alt="" />
        <div className="footer-overlay" />
        <div className="footer-inner">
          <div className="footer-cta-row">
            <h3 className="footer-cta-title">Open a folder. Ask the first question.</h3>
            <div className="footer-email-pill">
              <button type="button" className="footer-email-btn" onClick={openApp} style={{ marginLeft: "auto" }}>Open Paperview</button>
            </div>
          </div>
          <div className="footer-rule" />
          <div className="footer-mid">
            <div className="footer-brand">
              <div className="footer-brand-row">
                <div className="footer-glyph"><DocIcon /></div>
                <span className="footer-brand-name">Paperview</span>
              </div>
              <p>A local-first reader and research agent for people who have to cite what they read. AGPL-3.0 · built by Carsten Hanekamp.</p>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <span className="footer-col-hd">Product</span>
                <button type="button" onClick={openApp}>Open the app</button>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>Roadmap</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>Changelog</span>
              </div>
              <div className="footer-col">
                <span className="footer-col-hd">Source</span>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>Self-hosting guide</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>Security policy</span>
              </div>
              <div className="footer-col">
                <span className="footer-col-hd">Legal</span>
                <button type="button" onClick={() => scrollTo("privacy")}>Privacy</button>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>Licence</span>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Paperview. AGPL-3.0.</span>
            <span>Made for people who read footnotes.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

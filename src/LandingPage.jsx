import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap";

const colors = {
  bg: "#f6f5f1",
  surface: "#ffffff",
  text: "#121212",
  text2: "#4e4b45",
  text3: "#8a867c",
  border: "#e8e4db",
  border2: "#d8d2c6",
  accent: "#2563eb",
};

const s = {
  page: {
    fontFamily: "'Manrope', sans-serif",
    background: colors.bg,
    color: colors.text,
    minHeight: "100vh",
    overflowX: "hidden",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 40px",
    height: 64,
    background: colors.bg,
    borderBottom: `1px solid ${colors.border}`,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  navLogo: {
    fontSize: 18,
    fontWeight: 800,
    color: colors.text,
    letterSpacing: "-0.4px",
    textDecoration: "none",
  },
  navCta: {
    background: colors.text,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.2px",
  },
  hero: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "96px 24px 80px",
    textAlign: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: colors.text2,
    marginBottom: 28,
  },
  h1: {
    fontFamily: "'Spectral', Georgia, serif",
    fontSize: "clamp(38px, 5.5vw, 62px)",
    fontWeight: 600,
    lineHeight: 1.08,
    letterSpacing: "-0.5px",
    color: colors.text,
    marginBottom: 20,
  },
  heroSub: {
    fontSize: 18,
    lineHeight: 1.6,
    color: colors.text2,
    maxWidth: 560,
    margin: "0 auto 40px",
    fontWeight: 500,
  },
  heroCtaRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btnPrimary: {
    background: colors.text,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 28px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.2px",
  },
  btnSecondary: {
    background: "transparent",
    color: colors.text,
    border: `1.5px solid ${colors.border2}`,
    borderRadius: 10,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.2px",
  },
  mockup: {
    maxWidth: 900,
    margin: "0 auto 0",
    padding: "0 24px",
  },
  mockupInner: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 32px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
  },
  mockupBar: {
    background: "#f3f2ee",
    borderBottom: `1px solid ${colors.border}`,
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: (c) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: c,
  }),
  mockupBody: {
    display: "flex",
    height: 340,
  },
  mockupSidebar: {
    width: 200,
    borderRight: `1px solid ${colors.border}`,
    background: "#faf9f6",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  mockupSidebarTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.text3,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: 4,
  },
  mockupFile: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    borderRadius: 6,
    fontSize: 12,
    color: colors.text2,
    fontWeight: 500,
  },
  mockupFileActive: {
    background: "rgba(37,99,235,0.10)",
    color: "#2563eb",
  },
  mockupPdf: {
    flex: 1,
    background: "#ece9e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 8,
    padding: 24,
  },
  mockupPage: {
    background: "#fff",
    borderRadius: 6,
    width: "100%",
    maxWidth: 220,
    padding: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  mockupLine: (w, opacity) => ({
    height: 6,
    borderRadius: 3,
    background: "#e0ddd6",
    width: w,
    marginBottom: 6,
    opacity: opacity || 1,
  }),
  mockupChat: {
    width: 240,
    borderLeft: `1px solid ${colors.border}`,
    background: colors.surface,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "hidden",
  },
  mockupChatTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.text3,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: 2,
  },
  userBubble: {
    background: "#f4f1ea",
    borderRadius: "10px 10px 3px 10px",
    padding: "8px 10px",
    fontSize: 11,
    color: colors.text,
    alignSelf: "flex-end",
    maxWidth: "85%",
    lineHeight: 1.4,
  },
  aiBubble: {
    background: "#f9f8f5",
    border: `1px solid ${colors.border}`,
    borderRadius: "10px 10px 10px 3px",
    padding: "8px 10px",
    fontSize: 11,
    color: colors.text2,
    alignSelf: "flex-start",
    maxWidth: "90%",
    lineHeight: 1.4,
  },
  citChip: {
    display: "inline",
    background: "rgba(37,99,235,0.10)",
    color: "#2563eb",
    borderRadius: 4,
    padding: "1px 4px",
    fontSize: 10,
    fontWeight: 700,
  },
  section: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "80px 24px",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.text3,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 12,
  },
  h2: {
    fontFamily: "'Spectral', Georgia, serif",
    fontSize: "clamp(26px, 3.5vw, 38px)",
    fontWeight: 600,
    letterSpacing: "-0.3px",
    lineHeight: 1.12,
    marginBottom: 16,
  },
  sectionSub: {
    fontSize: 16,
    color: colors.text2,
    lineHeight: 1.6,
    maxWidth: 520,
    marginBottom: 48,
    fontWeight: 500,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
  },
  featureCard: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: 28,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "#f3f2ee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    fontSize: 18,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 8,
    letterSpacing: "-0.2px",
  },
  featureDesc: {
    fontSize: 13,
    color: colors.text2,
    lineHeight: 1.6,
    fontWeight: 500,
  },
  stepsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 32,
    marginTop: 8,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: 800,
    color: colors.text3,
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 8,
    letterSpacing: "-0.3px",
  },
  stepDesc: {
    fontSize: 13,
    color: colors.text2,
    lineHeight: 1.6,
    fontWeight: 500,
  },
  privacyBox: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: 40,
    maxWidth: 720,
    margin: "0 auto",
  },
  privacyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginTop: 28,
  },
  privacyItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  privacyDot: (green) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: green ? "#16a34a" : "#dc2626",
    marginTop: 5,
    flexShrink: 0,
  }),
  privacyText: {
    fontSize: 13,
    color: colors.text2,
    lineHeight: 1.5,
    fontWeight: 500,
  },
  browserNotice: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: "12px 18px",
    fontSize: 13,
    color: "#92400e",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 10,
    maxWidth: 560,
    margin: "32px auto 0",
  },
  divider: {
    borderTop: `1px solid ${colors.border}`,
    margin: "0 24px",
  },
  ctaBanner: {
    textAlign: "center",
    padding: "80px 24px",
    maxWidth: 600,
    margin: "0 auto",
  },
  footer: {
    borderTop: `1px solid ${colors.border}`,
    padding: "32px 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  footerLeft: {
    fontSize: 13,
    color: colors.text3,
    fontWeight: 500,
  },
  footerRight: {
    display: "flex",
    gap: 20,
    alignItems: "center",
  },
  footerLink: {
    fontSize: 13,
    color: colors.text3,
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
    background: "none",
    border: "none",
    fontFamily: "inherit",
    padding: 0,
  },
};

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V6L9 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 1v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function AppMockup() {
  return (
    <div style={s.mockup}>
      <div style={s.mockupInner}>
        <div style={s.mockupBar}>
          <div style={s.dot("#ff5f56")} />
          <div style={s.dot("#ffbd2e")} />
          <div style={s.dot("#27c93f")} />
        </div>
        <div style={s.mockupBody}>
          {/* Sidebar */}
          <div style={s.mockupSidebar}>
            <div style={s.mockupSidebarTitle}>Library</div>
            {["Research Papers", "Clinical Trials", "Reviews"].map((name, i) => (
              <div key={name} style={{ ...s.mockupFile, ...(i === 0 ? s.mockupFileActive : {}) }}>
                <FileIcon />
                {name}
              </div>
            ))}
          </div>
          {/* PDF area */}
          <div style={s.mockupPdf}>
            <div style={s.mockupPage}>
              <div style={s.mockupLine("60%")} />
              <div style={s.mockupLine("90%")} />
              <div style={s.mockupLine("75%")} />
              <div style={s.mockupLine("40%", 0.5)} />
            </div>
            <div style={{ ...s.mockupPage, maxWidth: 220 }}>
              <div style={s.mockupLine("80%")} />
              <div style={s.mockupLine("55%")} />
              <div style={s.mockupLine("90%")} />
            </div>
          </div>
          {/* Chat area */}
          <div style={s.mockupChat}>
            <div style={s.mockupChatTitle}>AI Chat</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <div style={s.userBubble}>What does this study conclude?</div>
              <div style={s.aiBubble}>
                The study concludes that treatment X significantly reduces symptoms.{" "}
                <span style={s.citChip}>[1]</span>
              </div>
              <div style={s.userBubble}>How large was the sample?</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: "📄",
    title: "Local PDF Processing",
    desc: "PDFs are rendered and extracted entirely in your browser using PDF.js. Your files never touch our servers.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Chat",
    desc: "Ask questions across one or many papers and get answers with cited passages and page numbers.",
  },
  {
    icon: "📁",
    title: "No Account Needed",
    desc: "Link a folder on your machine or upload files directly. Everything is stored locally in your browser.",
  },
  {
    icon: "✏️",
    title: "Annotations",
    desc: "Highlight text, add comments, and save notes directly on any PDF — all stored locally.",
  },
  {
    icon: "🔍",
    title: "Full-Text Search",
    desc: "Search across all your papers at once, including scanned PDFs via built-in OCR.",
  },
  {
    icon: "🔑",
    title: "Bring Your Own Key",
    desc: "Use your own OpenAI API key. We never see it — it goes straight from your browser to OpenAI.",
  },
];

const steps = [
  {
    num: "Step 01",
    title: "Add your PDFs",
    desc: "Link a folder on your machine (Chrome/Edge) or upload individual papers. Everything stays in your browser.",
  },
  {
    num: "Step 02",
    title: "Ask questions",
    desc: "Open the AI chat and ask anything. Select which papers to include as context — one, several, or all.",
  },
  {
    num: "Step 03",
    title: "Get cited answers",
    desc: "Every answer links back to the exact page and passage in your PDFs. Click any citation to jump there.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Inject Google Fonts
    if (!document.querySelector('link[data-paperview-font]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_URL;
      link.setAttribute("data-paperview-font", "1");
      document.head.appendChild(link);
    }
    // Reset body overflow for the landing page
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.body.style.background = colors.bg;
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <span style={s.navLogo}>Paperview</span>
        <button style={s.navCta} onClick={() => navigate("/app")}>
          Open App →
        </button>
      </nav>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.badge}>
          <span>✦</span>
          <span>Free · No account required</span>
        </div>
        <h1 style={s.h1}>
          AI research assistant<br />for your PDFs
        </h1>
        <p style={s.heroSub}>
          Upload papers, link a folder, and chat with your research using AI — with automatic citations back to the source page.
        </p>
        <div style={s.heroCtaRow}>
          <button style={s.btnPrimary} onClick={() => navigate("/app")}>
            Try it free →
          </button>
          <a
            href="#how-it-works"
            style={{ ...s.btnSecondary, textDecoration: "none" }}
          >
            See how it works
          </a>
        </div>
      </div>

      {/* App mockup */}
      <AppMockup />

      <div style={{ height: 80 }} />
      <div style={s.divider} />

      {/* Features */}
      <section style={s.section}>
        <div style={s.sectionLabel}>Features</div>
        <h2 style={s.h2}>Everything you need for serious research</h2>
        <p style={s.sectionSub}>
          Built for academics, researchers, and students who want AI assistance without giving up control of their data.
        </p>
        <div style={s.featureGrid}>
          {features.map((f) => (
            <div key={f.title} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* How it works */}
      <section id="how-it-works" style={s.section}>
        <div style={s.sectionLabel}>How it works</div>
        <h2 style={s.h2}>From PDF to insight in seconds</h2>
        <div style={s.stepsRow}>
          {steps.map((step) => (
            <div key={step.num}>
              <div style={s.stepNum}>{step.num}</div>
              <div style={s.stepTitle}>{step.title}</div>
              <div style={s.stepDesc}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* Privacy/transparency */}
      <section style={{ ...s.section, textAlign: "center" }}>
        <div style={s.sectionLabel}>Privacy</div>
        <h2 style={s.h2}>Your data stays yours</h2>
        <p style={{ ...s.sectionSub, margin: "0 auto 0" }}>
          We have no backend. No servers storing your files. Here's exactly what leaves your browser — and what doesn't.
        </p>
        <div style={s.privacyBox}>
          <div style={s.privacyGrid}>
            {[
              { green: true, text: "PDF files — processed locally, never uploaded to us" },
              { green: true, text: "Folder access — read-only, sandboxed by your browser" },
              { green: true, text: "Chat history & annotations — stored in your browser's IndexedDB" },
              { green: true, text: "API key — stored in your browser's localStorage only" },
              { green: false, text: "PDF text — sent to OpenAI when you send a chat message" },
              { green: false, text: "API key — sent in request headers to OpenAI (via HTTPS)" },
            ].map((item, i) => (
              <div key={i} style={s.privacyItem}>
                <div style={s.privacyDot(item.green)} />
                <div style={s.privacyText}>{item.text}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: colors.text3, marginTop: 24, lineHeight: 1.5, fontWeight: 500 }}>
            Green = stays on your device. Red = leaves your browser (encrypted over HTTPS to OpenAI's API). We never see any of it.
          </p>
        </div>
        <div style={s.browserNotice}>
          <span>⚠️</span>
          <span>
            <strong>Folder access</strong> requires Chrome or Edge. Firefox and Safari users can still upload individual PDFs.
          </span>
        </div>
      </section>

      <div style={s.divider} />

      {/* CTA banner */}
      <div style={s.ctaBanner}>
        <h2 style={{ ...s.h2, marginBottom: 12 }}>Start reading smarter</h2>
        <p style={{ ...s.sectionSub, margin: "0 auto 32px" }}>
          Free, open, and runs entirely in your browser. Bring your own OpenAI key — no subscription required.
        </p>
        <button style={s.btnPrimary} onClick={() => navigate("/app")}>
          Open Paperview →
        </button>
      </div>

      {/* Footer */}
      <footer style={s.footer}>
        <span style={s.footerLeft}>© {new Date().getFullYear()} Paperview. No account, no tracking, no backend.</span>
        <div style={s.footerRight}>
          <button style={s.footerLink} onClick={() => navigate("/app")}>Open App</button>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            style={s.footerLink}
          >
            Get an API key
          </a>
        </div>
      </footer>
    </div>
  );
}

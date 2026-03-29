export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#ffffff;
  --bg2:#ffffff;
  --surface:#ffffff;
  --surface-strong:#ffffff;
  --surface-soft:#ffffff;
  --border:#ececec;
  --border2:#e3e3e3;
  --text:#121212;
  --text2:#4e4b45;
  --text3:#8a867c;
  --accent:#121212;
  --accent-hover:#000000;
  --chip:#ffffff;
  --shadow:0 10px 28px rgba(15,15,15,.05);
}
html,body,#root{height:100%;}
body{font-family:'Manrope',sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;}
.app{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative;background:var(--bg);}
.sb{width:260px;min-width:260px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;overflow:hidden;transition:width .2s,min-width .2s;}
.sb.closed{width:0;min-width:0;border-right:0;}
.sb-inner{width:260px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
.sb-user{padding:14px 14px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);}
.sb-avatar{width:28px;height:28px;border-radius:999px;background:#f4f6f8;color:#4a4f56;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;}
.sb-username{font-size:14px;font-weight:700;color:#1d1d1b;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-tog{background:#fff;border:1px solid var(--border);color:#53514c;cursor:pointer;padding:6px;border-radius:10px;display:flex;}
.sb-tog:hover{background:#f7f7f7;}
.sb-nav{padding:8px 8px 6px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:2px;}
.sb-nav-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;cursor:pointer;color:#47443e;font-size:14px;font-weight:500;border:none;background:none;width:100%;text-align:left;font-family:inherit;transition:background .12s ease,color .12s ease;}
.sb-nav-item:hover{background:#f3f6fb;color:#171715;}
.sb-nav-item.active{background:#e8f2ff;color:#0f4ea6;}
.sb-search-wrap{padding:12px 12px 8px;position:relative;}
.sb-search-icon{position:absolute;left:24px;top:50%;transform:translateY(-35%);color:#8f99a8;pointer-events:none;}
.sb-search-input{width:100%;background:#fff;border:1px solid #d6dbe3;color:#22211f;border-radius:8px;padding:10px 12px 10px 36px;font-size:12px;font-family:inherit;outline:none;}
.sb-search-input::placeholder{color:#939db0;}
.sb-search-input:focus{border-color:#abc7f4;background:#fff;}
.sb-section{padding:6px 10px 10px;flex:1;overflow-y:auto;}
.sb-section-label{font-size:12px;font-weight:600;letter-spacing:0;color:#7f7b73;padding:12px 8px 8px;}
.sb-folder{margin-bottom:2px;}
.sb-folder-hd{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;transition:background .12s ease;}
.sb-folder-hd:hover{background:#f3f6fb;}
.sb-folder-hd.active{background:#e8f2ff;color:#111;}
.sb-folder-hd.active .sb-folder-name{color:#161614;}
.sb-folder-hd.active .sb-folder-cnt{background:#d7e7ff;color:#1857b5;}
.sb-folder-toggle{width:18px;height:18px;border-radius:4px;border:none;background:none;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.sb-folder-toggle:hover{background:#e8eef7;}
.sb-folder-hd.active .sb-folder-toggle:hover{background:#d7e7ff;}
.sb-folder-name{font-size:13px;color:#35322d;flex:1;font-weight:500;}
.sb-folder-cnt{font-size:10px;color:#666156;padding:1px 6px;border-radius:999px;background:#eef1f5;font-weight:700;}
.sb-papers{padding:2px 0 6px 18px;display:flex;flex-direction:column;gap:1px;}
.sb-paper{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;transition:background .12s ease;}
.sb-paper:hover{background:#f4f7fb;}
.sb-paper.active{background:#cfe4ff;color:#111;}
.sb-paper-icon{color:#7e8898;display:flex;}
.sb-paper.active .sb-paper-icon{color:#1959b7;}
.sb-paper-title{font-size:12px;color:#47443e;line-height:1.3;flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.sb-paper.active .sb-paper-title{color:#181816;}
.empty-upload-btn{height:24px;border-radius:7px;border:1px solid #ddd;background:#fff;color:#111;padding:0 8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px;}
.empty-upload-btn:hover{background:#f7f7f7;}
.sb-footer{padding:10px 12px 12px;border-top:1px solid var(--border);background:var(--surface);}
.sb-upload-btn{width:100%;background:#111111;color:#fff;border:1px solid #111111;border-radius:8px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;}
.sb-upload-btn:hover{background:#000;}
.sb-new-folder{width:100%;background:#fff;color:#2e2b26;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;margin-top:6px;}
.sb-new-folder:hover{background:#fff;}
.nf-input{background:#fff;border:1px solid #111;color:#111;border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;margin:3px 0;width:100%;display:block;}
.nf-ctrl{display:flex;gap:6px;margin-top:6px;}
.nf-ctrl .lib-btn{flex:1;justify-content:center;}
.nf-error{font-size:11px;color:#b91c1c;padding:2px 2px 0;}
.main{flex:1;display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg);}
.topbar{height:58px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;gap:14px;flex-shrink:0;}
.topbar-left{display:flex;align-items:center;gap:8px;}
.topbar-title-stack{display:flex;flex-direction:column;gap:3px;}
.topbar-folder-name{font-size:15px;font-weight:700;color:var(--text);}
.topbar-subtitle{font-size:12px;color:var(--text3);}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
.topbar-count{font-size:12px;color:#3f3c37;background:#fff;border:1px solid var(--border);padding:7px 10px;border-radius:6px;font-weight:600;}
.topbar-mode{font-size:12px;color:#3f3c37;background:#fff;border:1px solid var(--border);padding:7px 10px;border-radius:6px;font-weight:600;}
.topbar-btn{background:#fff;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
.topbar-btn.active{background:#111;color:#fff;border-color:#111;}
.tb-divider{width:1px;height:20px;background:var(--border);}
.tabbar{height:42px;background:#fafafa;border-bottom:1px solid var(--border);display:flex;align-items:flex-end;padding:0 10px;overflow-x:auto;overflow-y:hidden;flex-shrink:0;}
.tabbar::-webkit-scrollbar{height:6px;}
.tabbar::-webkit-scrollbar-thumb{background:#d9d9d9;border-radius:999px;}
.tab{position:relative;display:flex;align-items:center;gap:8px;padding:0 10px 0 12px;height:33px;width:208px;min-width:208px;max-width:208px;margin-left:-1px;border:1px solid #e5e5e5;border-bottom:none;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;color:#676258;white-space:nowrap;background:#f3f3f3;transition:background .15s ease,color .15s ease,border-color .15s ease;}
.tab-first{margin-left:0;}
.tab::after{display:none;}
.tab:hover{background:#fafafa;color:#25231f;}
.tab.active{background:#fff;color:#151513;border-color:#d9d9d9;}
.tab.active::after,.tab:hover::after{opacity:0;}
.tab-icon{display:flex;color:#928d82;flex-shrink:0;}
.tab.active .tab-icon{color:#1e1d1a;}
.tab-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:1;}
.tabbar-tail{flex:1;min-width:20px;margin-left:0;height:1px;background:#d9d9d9;align-self:flex-end;}
.tab-close{display:flex;align-items:center;justify-content:center;width:18px;height:18px;border:none;background:transparent;color:#8f8a80;border-radius:4px;cursor:pointer;opacity:0;flex-shrink:0;transition:opacity .12s ease,background .12s ease,color .12s ease;}
.tab:hover .tab-close,.tab.active .tab-close{opacity:1;}
.tab-close:hover{background:#e7eef9;color:#1857b5;}
.content{flex:1;display:flex;overflow:hidden;}
.content-reader{padding:0;gap:0;background:var(--bg);}
.viewer{flex:1;display:flex;flex-direction:column;min-width:0;gap:0;}
.viewer-frame{flex:1;min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;background:var(--surface);box-shadow:none;}
.viewer-toolbar{height:42px;background:#fafafa;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:8px;flex-shrink:0;min-width:0;}
.vt-left{display:flex;align-items:center;gap:6px;flex:1;min-width:0;}
.vt-btn{background:none;border:none;color:var(--text3);cursor:pointer;padding:7px 8px;border-radius:4px;display:flex;align-items:center;font-size:12px;gap:4px;}
.vt-btn:hover{background:#e7eef9;color:#1857b5;}
.vt-btn:disabled{opacity:.35;cursor:not-allowed;}
.vt-btn:disabled:hover{background:none;color:var(--text3);}
.vt-search-wrap{display:flex;align-items:center;gap:6px;min-width:0;}
.vt-search-input{height:28px;width:180px;max-width:200px;min-width:72px;border:1px solid #d6dbe3;border-radius:4px;background:#fff;color:#111;padding:0 8px;font-size:12px;font-family:inherit;outline:none;}
.vt-search-nav{display:flex;align-items:center;gap:2px;}
.vt-search-meta{font-size:11px;color:#888277;min-width:40px;white-space:nowrap;font-weight:700;}
.vt-sep{width:1px;height:16px;background:var(--border);}
.vt-zoom{display:flex;align-items:center;gap:4px;}
.vt-zoom-val{font-size:12px;color:var(--text2);min-width:42px;text-align:center;font-weight:800;}
.vt-page{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.vt-page-total{font-size:12px;color:var(--text3);font-weight:700;}
.pdf-scroll{flex:1;overflow:auto;background:#ffffff;padding:14px;position:relative;}
.pdf-pages{display:flex;flex-direction:column;align-items:center;}
.pdf-pages > div{border-radius:4px !important;border:1px solid #d2d2d2 !important;box-shadow:0 6px 18px rgba(15,15,15,.10) !important;}
.textLayer{position:absolute;inset:0;overflow:hidden;line-height:1;-webkit-text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:2;}
.textLayer{pointer-events:auto;}
.textLayer span,.textLayer br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0;font-kerning:none;font-variant-ligatures:none;-webkit-user-modify:read-only;}
.textLayer span::selection{background:rgba(59,130,246,.35);color:transparent;}
.textLayer br::selection{background:rgba(59,130,246,.35);}
.textLayer .endOfContent{display:block;position:absolute;left:0;top:100%;right:0;bottom:0;z-index:-1;cursor:default;user-select:none;}
.textLayer .markedContent{top:0;height:0;}
.pdf-scroll.debug-text-layer .textLayer span{outline:1px solid rgba(255,0,0,.25);background:rgba(255,0,0,.08)!important;}
.ocrLayer{user-select:text;-webkit-user-select:text;}
.ocrLayer .ocr-line{pointer-events:none;user-select:none;-webkit-user-select:none;}
.ocrLayer .ocr-word{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0;font-kerning:none;font-variant-ligatures:none;pointer-events:auto;user-select:text;-webkit-user-select:text;}
.ocrLayer .ocr-word::selection{background:rgba(59,130,246,.35);color:transparent;}
.pdf-scroll.debug-text-layer .ocrLayer .ocr-line{outline:1px solid rgba(0,128,0,.35);background:rgba(0,128,0,.06)!important;}
.pdf-scroll.debug-text-layer .ocrLayer .ocr-word{outline:1px dotted rgba(0,200,0,.3);background:rgba(0,200,0,.08)!important;}
.sel-pop{position:fixed;background:white;border:1px solid var(--border);border-radius:14px;padding:6px;display:flex;gap:4px;box-shadow:0 16px 32px rgba(0,0,0,.14);z-index:1000;}
.sel-btn{background:none;border:none;color:var(--text2);padding:6px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;display:flex;align-items:center;gap:6px;white-space:nowrap;}
.sel-btn.pri{color:#111;}
.sel-btn:hover{background:#f5f5f5;}
.ann-hl{background:rgba(255,213,79,.4)!important;border-radius:2px;cursor:pointer;color:transparent!important;}
.ann-hl::selection{background:rgba(59,130,246,.35);color:transparent;}
.ann-popover{position:fixed;background:white;border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:0 16px 32px rgba(0,0,0,.14);z-index:1001;width:300px;display:flex;flex-direction:column;gap:10px;}
.ann-popover-text{font-size:12px;color:#555;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-style:italic;}
.ann-popover textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical;min-height:60px;outline:none;}
.ann-popover textarea:focus{border-color:#9ebded;}
.ann-popover-actions{display:flex;gap:6px;justify-content:flex-end;}
.ann-popover-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:white;color:#333;font-family:inherit;}
.ann-popover-btn:hover{background:#f5f5f5;}
.ann-popover-btn.primary{background:#111;color:white;border-color:#111;}
.ann-popover-btn.primary:hover{background:#333;}
.ann-popover-btn.danger{color:#dc2626;border-color:#fca5a5;}
.ann-popover-btn.danger:hover{background:#fef2f2;}
.notes-panel{flex:1;overflow-y:auto;padding:16px;}
.notes-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:32px;color:#888;}
.notes-empty-icon{font-size:28px;opacity:.3;margin-bottom:12px;}
.notes-empty h3{font-size:15px;font-weight:600;color:#555;margin:0 0 8px;}
.notes-empty p{font-size:13px;line-height:1.6;max-width:260px;}
.notes-group{margin-bottom:20px;}
.notes-group-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);}
.note-card{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:box-shadow .15s ease;}
.note-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.08);}
.note-card-text{font-size:12px;color:#555;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-style:italic;margin-bottom:4px;}
.note-card-comment{font-size:13px;color:#111;line-height:1.5;margin-bottom:4px;}
.note-card-no-comment{font-size:12px;color:#bbb;font-style:italic;}
.note-card-footer{display:flex;align-items:center;justify-content:space-between;}
.note-card-page{font-size:11px;color:#999;font-weight:500;}
.note-card-delete{background:none;border:none;color:#ccc;cursor:pointer;padding:2px;border-radius:4px;}
.note-card-delete:hover{color:#dc2626;}
.edge-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#e0e0e0;padding:14px 20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:10000;display:flex;align-items:center;gap:12px;max-width:560px;font-size:13px;line-height:1.5;animation:edgeToastIn .3s ease;}
.edge-toast b{color:#fff;}
.edge-toast button{background:rgba(255,255,255,.15);border:none;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;flex-shrink:0;}
.edge-toast button:hover{background:rgba(255,255,255,.25);}
@keyframes edgeToastIn{from{opacity:0;transform:translateX(-50%) translateY(12px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.sb-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;z-index:10;}
.sb-resize-handle:hover .sb-resize-grip,.sb-resize-handle:active .sb-resize-grip{background:#9ebded;}
.sb-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.chat-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;}
.chat-resize-handle:hover .chat-resize-grip,.chat-resize-handle:active .chat-resize-grip{background:#9ebded;}
.chat-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.chat-panel{width:min(480px,38vw);min-width:380px;background:var(--surface);display:flex;flex-direction:column;height:100%;overflow:hidden;box-shadow:none;}
.chat-topbar{height:46px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:12px;flex-shrink:0;background:#fafafa;}
.chat-topbar-copy{display:flex;flex-direction:column;gap:1px;min-width:0;}
.chat-topbar-title{font-size:13px;font-weight:600;color:#1b1b19;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-subtitle{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-actions{display:flex;align-items:center;gap:6px;}
.chat-topbar-btn{background:#fff;border:1px solid var(--border);color:#111;cursor:pointer;padding:5px;border-radius:4px;display:flex;}
.chat-topbar-btn-label{padding:5px 8px;gap:6px;align-items:center;font-size:11px;font-weight:600;font-family:inherit;}
.chat-topbar-btn:hover{background:#f3f6fb;color:#1857b5;border-color:#cbdffb;}
.chat-topbar-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-scan-banner{margin:10px 10px 0;border:1px solid #cbdffb;border-radius:10px;background:linear-gradient(180deg,#f7fbff 0%,#eef5ff 100%);padding:10px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-scan-banner-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.chat-scan-banner-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-scan-banner-title{font-size:12px;font-weight:700;color:#184a93;}
.chat-scan-banner-meta{font-size:11px;color:#5f7698;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-scan-banner-badge{min-width:44px;height:24px;padding:0 8px;border-radius:999px;border:1px solid #c9dcfb;background:#fff;color:#184a93;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.chat-scan-banner-status{font-size:12px;color:#315071;}
.chat-scan-progress{height:7px;border-radius:999px;background:rgba(36,89,168,.14);overflow:hidden;}
.chat-scan-progress-bar{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#2d6cdf 0%,#5ea0ff 100%);transition:width .2s ease;}
.chat-history-panel{border-bottom:1px solid var(--border);background:#fcfcfc;display:flex;flex-direction:column;max-height:240px;}
.chat-history-panel.chat-history-standalone{flex:1;max-height:none;border-bottom:none;}
.chat-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);background:#fafafa;}
.chat-history-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-history-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.chat-history-subtitle{font-size:11px;color:#918b82;}
.chat-history-actions{display:flex;align-items:center;gap:6px;}
.chat-history-btn{border:1px solid var(--border);background:#fff;border-radius:4px;padding:5px 8px;font-size:11px;font-weight:600;color:#37342f;cursor:pointer;font-family:inherit;}
.chat-history-btn:hover{background:#f3f6fb;color:#1857b5;border-color:#cbdffb;}
.chat-history-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-history-empty{padding:10px;font-size:12px;color:#8b867c;}
.chat-overview-shell{flex:1;overflow:auto;padding:12px;background:#fff;display:flex;flex-direction:column;gap:12px;}
.chat-overview-hero{border:1px solid var(--border);border-radius:8px;background:#fff;padding:12px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-overview-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.chat-overview-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.chat-overview-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.chat-overview-title{font-size:16px;font-weight:700;color:#1e1c18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-subtitle{font-size:12px;line-height:1.55;color:#696459;max-width:34ch;}
.chat-overview-badge{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 9px;border-radius:999px;border:1px solid #d8e6fb;background:#eff5ff;color:#2459a8;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}
.chat-overview-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.chat-overview-stat{border:1px solid var(--border);border-radius:6px;background:#fff;padding:9px 10px;display:flex;flex-direction:column;gap:3px;}
.chat-overview-stat-value{font-size:17px;font-weight:700;color:#1f1d1a;}
.chat-overview-stat-label{font-size:11px;color:#7c766d;}
.chat-overview-primary-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.chat-overview-section{border:1px solid var(--border);border-radius:8px;background:#fff;overflow:hidden;}
.chat-overview-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:#fafafa;}
.chat-overview-section-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-overview-section-title{font-size:12px;font-weight:700;color:#22201c;}
.chat-overview-section-subtitle{font-size:11px;color:#8b867c;}
.chat-overview-count{min-width:24px;height:24px;padding:0 8px;border-radius:999px;background:#fff;border:1px solid #ececec;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#5f5a50;}
.chat-overview-list{display:flex;flex-direction:column;}
.chat-overview-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border-top:1px solid var(--border);}
.chat-overview-row:first-child{border-top:none;}
.chat-overview-row-main{border:none;background:none;padding:0;min-width:0;display:flex;flex-direction:column;gap:4px;text-align:left;cursor:pointer;font-family:inherit;}
.chat-overview-row-main:hover .chat-overview-row-title{color:#1857b5;}
.chat-overview-row-top{display:flex;align-items:center;gap:8px;min-width:0;}
.chat-overview-row-title{font-size:13px;font-weight:600;color:#1f1d1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-row-meta{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-row-summary{font-size:11px;color:#696459;line-height:1.45;}
.chat-overview-row-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.chat-overview-empty-state{padding:22px 16px;display:flex;flex-direction:column;gap:5px;align-items:flex-start;background:#fff;}
.chat-overview-empty-title{font-size:13px;font-weight:700;color:#1f1d1a;}
.chat-overview-empty-copy{font-size:12px;line-height:1.55;color:#78736a;max-width:34ch;}
.chat-thread-list{display:flex;flex-direction:column;overflow:auto;}
.chat-thread-item{display:flex;align-items:stretch;border-bottom:1px solid var(--border);background:#fff;}
.chat-thread-item:last-child{border-bottom:none;}
.chat-thread-item.active{background:#eef5ff;}
.chat-thread-main{flex:1;min-width:0;border:none;background:none;text-align:left;padding:9px 10px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;}
.chat-thread-main:hover{background:#f5f8fd;}
.chat-thread-item.active .chat-thread-main:hover{background:#e8f2ff;}
.chat-thread-name{font-size:12px;font-weight:600;color:#1f1d1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-meta{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-actions{display:flex;align-items:center;gap:4px;padding:0 8px;border-left:1px solid var(--border);background:rgba(255,255,255,.5);}
.chat-thread-row-btn{border:1px solid var(--border);background:#fff;border-radius:4px;padding:4px 7px;font-size:10px;font-weight:600;color:#4a463f;cursor:pointer;font-family:inherit;}
.chat-thread-row-btn:hover{background:#f3f6fb;color:#1857b5;border-color:#cbdffb;}
.chat-thread-delete{width:28px;height:28px;border:1px solid #f0d3d3;border-radius:4px;background:#fff7f7;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b42318;flex-shrink:0;}
.chat-thread-delete:hover{background:#fff0f0;color:#912018;}
.chat-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 16px 16px;display:flex;flex-direction:column;gap:16px;}
.chat-empty{flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;text-align:left;padding:12px 12px 0;gap:12px;}
.chat-empty-intro{display:flex;gap:10px;align-items:flex-start;padding:4px 2px;}
.chat-empty-icon{width:34px;height:34px;background:#e8f2ff;border:1px solid #cbdffb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#1857b5;flex-shrink:0;}
.chat-empty-copy h3{font-size:16px;font-weight:700;color:var(--text);line-height:1.25;max-width:none;}
.chat-empty-copy p{font-size:12px;color:var(--text3);line-height:1.55;max-width:none;margin-top:4px;}
.chat-empty-sections{display:flex;flex-direction:column;gap:10px;}
.chat-empty-block{border:1px solid var(--border);border-radius:6px;background:#fff;overflow:hidden;}
.chat-empty-block-title{padding:9px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#78736a;background:#fafafa;}
.chat-empty-suggestions{display:grid;grid-template-columns:1fr;gap:0;width:100%;}
.chat-suggestion{border:none;border-bottom:1px solid var(--border);background:#fff;padding:11px 12px;font-size:12px;font-weight:600;color:#2f2c28;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;}
.chat-suggestion:last-child{border-bottom:none;}
.chat-suggestion:hover{background:#f3f6fb;color:#1857b5;}
.chat-suggestion-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#6f7786;flex-shrink:0;}
.chat-suggestion-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-suggestion-title{font-size:12px;font-weight:600;color:inherit;}
.chat-suggestion-meta{font-size:11px;color:#8d877d;}
.chat-empty-note{padding:10px 12px;font-size:12px;line-height:1.55;color:#5f5a50;background:#fff;}
.msg-u{display:flex;justify-content:flex-end;}
.msg-u-bubble-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:5px;max-width:88%;}
.msg-u-bubble{background:#fff;color:#111;border:1px solid var(--border);border-radius:16px 16px 6px 16px;padding:12px 14px;font-size:13px;line-height:1.6;max-width:100%;}
.msg-a{display:flex;flex-direction:column;gap:8px;}
.msg-a-row{display:flex;align-items:flex-start;gap:8px;}
.msg-a-avatar{width:24px;height:24px;border-radius:999px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:4px;}
.msg-a-bubble-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:5px;max-width:320px;}
.msg-a-bubble{background:#fff;border:1px solid var(--border);border-radius:16px 16px 16px 6px;padding:12px 14px;font-size:13px;line-height:1.6;color:#111;max-width:320px;overflow-wrap:anywhere;}
.chat-usage-meta{font-size:11px;line-height:1.4;color:#8a867c;padding:0 2px;white-space:normal;overflow-wrap:anywhere;}
.inline-cit-wrap{display:inline-flex;align-items:flex-start;position:relative;vertical-align:super;margin-left:4px;}
.inline-cit-anchor{border:1px solid #cbdffb;background:linear-gradient(180deg,#f8fbff 0%,#ebf3ff 100%);color:#1857b5;border-radius:999px;min-width:20px;height:20px;padding:0 7px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-weight:800;font-size:10px;line-height:1;font-family:inherit;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 1px 2px rgba(24,87,181,.10);transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease,transform .15s ease;}
.inline-cit-anchor-index{display:block;transform:translateY(-.5px);}
.inline-cit-anchor:hover{background:linear-gradient(180deg,#ffffff 0%,#edf4ff 100%);border-color:#b8d0f7;color:#13438b;box-shadow:0 1px 0 rgba(255,255,255,.95) inset,0 4px 10px rgba(24,87,181,.14);transform:translateY(-1px);}
.inline-cit-anchor.active{background:linear-gradient(180deg,#2f6fda 0%,#1c58ba 100%);border-color:#1c58ba;color:#fff;box-shadow:0 10px 20px rgba(24,87,181,.18);}
.inline-cit-anchor:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(24,87,181,.18),0 10px 20px rgba(24,87,181,.18);}
.inline-cit-popover{position:absolute;left:0;top:calc(100% + 10px);z-index:40;min-width:220px;max-width:min(320px,calc(100vw - 80px));box-sizing:border-box;}
.inline-cit-popover::before{content:"";position:absolute;top:-7px;left:18px;width:12px;height:12px;background:#fff;border-left:1px solid #d8e6fb;border-top:1px solid #d8e6fb;transform:rotate(45deg);}
.inline-cit-popover .source-card{box-shadow:0 20px 40px rgba(14,30,70,.14);background:#fff;border-color:#d8e6fb;border-radius:14px;padding:12px 13px;}
.sources-label{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}
.sources-row{display:flex;flex-direction:column;gap:6px;}
.source-card{background:linear-gradient(180deg,#fff 0%,#fbfcff 100%);border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;}
.source-card:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(14,30,70,.10);border-color:#cbdffb;}
.source-card-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
.source-card-file{font-size:11px;font-weight:700;color:#1b1b19;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.source-card-page{font-size:10px;color:#1857b5;background:#eef5ff;border:1px solid #d8e6fb;padding:2px 7px;border-radius:999px;white-space:nowrap;font-weight:700;}
.source-card-jump{font-size:10px;color:#1857b5;font-weight:700;margin-left:auto;white-space:nowrap;}
.source-card-section{font-size:10px;color:#7a8aa5;margin-bottom:6px;font-weight:600;}
.source-card-text{font-size:12px;color:#4a4f58;line-height:1.55;font-style:italic;}
.chat-thinking{display:flex;align-items:center;gap:8px;padding:8px 0;}
.typing{display:flex;gap:3px;}
.typing span{width:5px;height:5px;background:#8f8f8f;border-radius:50%;animation:bounce 1.2s infinite;}
.typing span:nth-child(2){animation-delay:.2s;} .typing span:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-4px);}}
@keyframes citHighlight{0%{opacity:1;}70%{opacity:1;}100%{opacity:0;}}
.chat-input-area{padding:10px;border-top:1px solid var(--border);background:#fafafa;}
.ctx-chip{background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 10px;margin-bottom:10px;display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#111;}
.ctx-chip-text{flex:1;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.ctx-chip-x{cursor:pointer;opacity:.6;}
.chat-composer{background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:10px;}
.chat-composer textarea{background:none;border:none;outline:none;color:#111;font-size:13px;font-family:inherit;resize:none;line-height:1.5;max-height:100px;min-height:22px;}
.chat-composer textarea::placeholder{color:#888;}
.composer-context-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}
.attach-picker-inline{margin-bottom:10px;}
.composer-context-trigger{height:24px;border:none;background:#f5f1e8;color:#5f584b;border-radius:999px;padding:0 9px;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;}
.composer-context-trigger:hover{background:#eee7da;color:#2f2a22;}
.composer-context-list{display:flex;align-items:center;gap:6px;min-width:0;flex:1;flex-wrap:wrap;}
.composer-context-pill{max-width:100%;display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;background:#f7f7f7;border:1px solid #ece7dd;color:#4a453d;font-size:11px;line-height:1.2;}
.composer-context-pill-text{display:block;min-width:0;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.composer-context-pill-more{background:#fcfbf8;color:#726b5d;}
.composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.composer-tools{display:flex;align-items:center;gap:8px;}
.icon-btn{width:32px;height:32px;border-radius:4px;border:1px solid var(--border);background:#fff;color:#302d28;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.icon-btn:hover{background:#f3f6fb;color:#1857b5;}
.send-btn{background:#111;border-color:#111;color:#fff;}
.send-btn:hover{background:#000;}
.attach-picker{position:relative;}
.attach-menu{position:absolute;left:0;top:calc(100% + 6px);width:280px;max-height:260px;overflow:auto;background:#fff;border:1px solid var(--border);border-radius:6px;padding:8px;box-shadow:0 10px 22px rgba(0,0,0,.10);z-index:30;}
.attach-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}
.attach-title{font-size:11px;color:#878277;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
.attach-mini-btn{border:none;background:none;color:#666;font-size:11px;font-weight:600;cursor:pointer;padding:2px 4px;border-radius:6px;}
.attach-mini-btn:hover{background:#f3f3f3;}
.attach-list{display:flex;flex-direction:column;gap:4px;}
.attach-item{display:flex;align-items:center;gap:8px;padding:6px 6px;border-radius:8px;cursor:pointer;}
.attach-item:hover{background:#f6f6f6;}
.attach-item input{accent-color:#111;}
.attach-name{font-size:12px;color:#222;line-height:1.3;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.attach-empty{font-size:12px;color:#888;padding:8px;}
.model-chip{height:32px;border-radius:4px;border:1px solid var(--border);background:#fff;color:#2a2a2a;display:flex;align-items:center;gap:6px;padding:0 10px;font-size:11px;font-weight:700;}
.model-picker{position:relative;}
.model-chip{cursor:pointer;}
.model-menu{position:absolute;left:0;bottom:36px;min-width:190px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:4px;box-shadow:0 10px 22px rgba(0,0,0,.10);z-index:25;}
.model-option{width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:7px 8px;font-size:12px;color:#333;cursor:pointer;font-family:inherit;}
.model-option:hover{background:#f4f4f4;}
.model-option.active{background:#111;color:#fff;}
.library-view{flex:1;overflow:auto;padding:24px;background:var(--surface);}
.library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;}
.library-title{font-size:22px;font-weight:800;color:#111;letter-spacing:-.02em;}
.library-actions{display:flex;gap:8px;}
.lib-btn{height:36px;border-radius:12px;border:1px solid var(--border);background:#fff;color:#111;padding:0 12px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit;}
.lib-btn.dark{background:#111;color:#fff;border-color:#111;}
.library-db{background:#fff;border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:none;}
.db-head,.db-row{display:grid;grid-template-columns:minmax(280px,1.7fr) 90px 90px 120px 140px;align-items:center;}
.db-head{height:40px;background:#fff;border-bottom:1px solid var(--border);}
.db-h{font-size:11px;color:#8c877d;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:0 12px;}
.db-row{min-height:46px;border-bottom:1px solid #f2f2f2;}
.db-row:last-child{border-bottom:none;}
.db-row.folder{background:#fff;cursor:pointer;}
.db-row.folder.selected{background:#fff;}
.db-cell{padding:8px 12px;font-size:12px;color:#3d3d3d;display:flex;align-items:center;gap:8px;min-width:0;}
.db-title{font-size:13px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;}
.db-meta{font-size:11px;color:#8a857a;font-weight:700;}
.db-toggle{width:20px;height:20px;border:none;background:none;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#666;cursor:pointer;}
.db-toggle:hover{background:#f0f0f0;}
.db-dot{width:7px;height:7px;border-radius:999px;background:#9a9a9a;}
.db-chip{font-size:11px;padding:4px 9px;border-radius:999px;background:#fff;color:#4a463f;font-weight:700;}
.db-actions{display:flex;justify-content:flex-end;gap:6px;width:100%;}
.lib-icon-btn{width:30px;height:30px;border-radius:10px;border:1px solid var(--border);background:#fff;color:#333;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.db-folder-files{background:#fff;border-bottom:1px solid #f2f2f2;}
.db-file-row{display:grid;grid-template-columns:minmax(280px,1.7fr) 90px 90px 120px 140px;min-height:38px;align-items:center;border-top:1px solid #f2f2f2;}
.db-file-row:first-child{border-top:none;}
.db-file-row.empty .db-cell{color:#8f8f8f;font-style:italic;}
.db-file-name{font-size:12px;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.db-file-indent{padding-left:36px;}
.db-open{height:28px;border-radius:9px;border:1px solid var(--border);background:#fff;padding:0 10px;font-size:11px;font-weight:700;cursor:pointer;}
.db-open:hover{background:#f7f7f7;}
@media (max-width:900px){
  .db-head,.db-row,.db-file-row{grid-template-columns:minmax(220px,1.4fr) 72px 72px 92px 120px;}
}
@media (max-width:1200px){
  .chat-panel{width:400px;min-width:340px;}
  .vt-search-input{width:120px;}
  .vt-search-meta{min-width:32px;}
}
@media (max-width:1100px){
  .chat-panel{width:360px;min-width:320px;}
}
@media (max-width:860px){
  .chat-resize-handle{display:none;}
  .chat-panel{display:none;}
  .topbar{padding:0 14px;}
  .topbar-subtitle{display:none;}
  .viewer-paper-title{font-size:22px;}
}
.welcome-upload{margin-top:14px;height:34px;border-radius:9px;border:1px solid #ddd;background:#fff;color:#111;padding:0 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;}
.welcome-upload:hover{background:#f7f7f7;}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;}
.modal{background:white;border-radius:12px;padding:24px;width:460px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.2);}
.m-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.m-title{font-size:16px;font-weight:700;}
.m-x{background:none;border:none;color:var(--text3);cursor:pointer;padding:4px;border-radius:5px;}
.dz{border:2px dashed var(--border2);border-radius:8px;padding:36px 24px;text-align:center;cursor:pointer;background:#fafafa;}
.dz.drag{border-color:#111;background:#f0f0f0;}
.dz h3{font-size:14px;font-weight:600;margin-bottom:4px;}
.dz p{font-size:12px;color:var(--text3);}
.fs{margin-top:14px;} .fs label{font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:5px;}
.fs select{width:100%;background:white;border:1px solid var(--border2);border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;}
.m-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
.btn-sec{background:#f2f2f2;border:1px solid var(--border);color:#333;padding:7px 14px;border-radius:7px;font-size:13px;cursor:pointer;font-family:inherit;}
.btn-pri{background:#111;border:none;color:white;padding:7px 16px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
.settings-field{margin-bottom:16px;}
.settings-label{display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:6px;}
.settings-input-wrap{display:flex;align-items:center;gap:6px;}
.settings-input{flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;background:#fafafa;color:var(--text);}
.settings-input:focus{outline:none;border-color:#2563eb;background:#fff;}
.settings-toggle-vis{background:none;border:1px solid var(--border);border-radius:5px;padding:5px 8px;cursor:pointer;font-size:11px;color:#666;font-family:inherit;}
.settings-toggle-vis:hover{background:#f5f5f5;}
.settings-info{font-size:11px;color:#888;line-height:1.55;margin-top:6px;}
.settings-select{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;background:#fafafa;color:var(--text);cursor:pointer;}
.settings-select:focus{outline:none;border-color:#2563eb;}
.sb-settings-bar{padding:8px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:12px;}
.sb-settings-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.sb-settings-label{flex:1;color:#666;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-settings-gear{background:none;border:none;color:#888;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;}
.sb-settings-gear:hover{background:#f0f0f0;color:#333;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);text-align:center;padding:48px;}
.thinking-trace{margin-bottom:6px;}
.thinking-trace-toggle{display:inline-flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;padding:4px 0;color:#6f7786;font-size:11px;font-weight:600;font-family:inherit;}
.thinking-trace-toggle:hover{color:#1857b5;}
.thinking-trace-toggle-icon{font-size:12px;}
.thinking-trace-toggle-count{background:#f0f3f8;border:1px solid #e5e9f0;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;color:#6f7786;}
.thinking-trace-chevron{font-size:9px;color:#aaa;}
.thinking-trace-steps{display:flex;flex-direction:column;gap:2px;padding:4px 0 4px 8px;border-left:2px solid #e8edf5;margin-left:4px;}
.thinking-step{animation:thinkStepIn .2s ease;}
.thinking-step-header{display:flex;align-items:flex-start;gap:6px;padding:2px 0;}
.thinking-step-icon{font-size:10px;color:#aab0bc;margin-top:1px;flex-shrink:0;}
.thinking-step-label{font-size:11px;color:#6f7786;line-height:1.45;word-break:break-word;flex:1;}
.thinking-step-chevron{font-size:9px;color:#bbb;}
.thinking-step-body{font-size:11px;color:#555;line-height:1.55;margin:4px 0 4px 16px;white-space:pre-wrap;word-break:break-word;background:#f8f9fc;border-radius:4px;padding:6px 8px;}
.thinking-step-reasoning .thinking-step-icon{color:#9b59b6;}
.thinking-step-reasoning .thinking-step-label{color:#7d3c98;font-style:italic;}
.thinking-step-search .thinking-step-icon{color:#1857b5;}
.thinking-step-search .thinking-step-label{color:#3a5a8a;}
.thinking-step-result .thinking-step-icon{color:#16a34a;}
.thinking-step-result .thinking-step-label{color:#4a7c5c;}
@keyframes thinkStepIn{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:translateY(0);}}
`;

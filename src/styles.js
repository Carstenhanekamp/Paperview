export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#ffffff;
  --bg2:#f9f9f8;
  --surface:#ffffff;
  --surface-strong:#f9f9f8;
  --surface-soft:#fcfcfc;
  --border:#e8e8e6;
  --border2:#dcdbd8;
  --text:#141413;
  --text2:#4e4b45;
  --text3:#8a867c;
  --accent:#2563eb;
  --accent-hover:#1d4ed8;
  --chip:#f4f4f2;
  --shadow:0 2px 8px rgba(20,20,19,.06),0 1px 2px rgba(20,20,19,.04);
}
html,body,#root{height:100%;}
body{font-family:'Manrope',sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;}
.app{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative;background:var(--bg);}
.sb{width:260px;min-width:260px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;overflow:hidden;transition:width .2s,min-width .2s;}
.sb.closed{width:0;min-width:0;border-right:0;}
.sb-inner{width:260px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
.sb-user{padding:10px 12px 8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);}
.sb-avatar{width:24px;height:24px;border-radius:999px;background:#f4f6f8;color:#4a4f56;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;}
.sb-username{font-size:13px;font-weight:700;color:#1d1d1b;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-tog{background:#fff;border:1px solid var(--border);color:#53514c;cursor:pointer;padding:5px;border-radius:8px;display:flex;}
.sb-tog:hover{background:#f7f7f7;}
.sb-nav{padding:6px 6px 5px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:1px;}
.sb-nav-item{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:6px;cursor:pointer;color:#47443e;font-size:13px;font-weight:500;border:none;background:none;width:100%;text-align:left;font-family:inherit;transition:background .12s ease,color .12s ease;}
.sb-nav-item:hover{background:#f3f3f2;color:#171715;}
.sb-nav-item.active{background:#ebebea;color:#141412;}
.sb-search-wrap{padding:8px 10px 6px;position:relative;}
.sb-search-icon{position:absolute;left:22px;top:50%;transform:translateY(-35%);color:#8f99a8;pointer-events:none;}
.sb-search-input{width:100%;background:#fff;border:1px solid #d6dbe3;color:#22211f;border-radius:7px;padding:8px 10px 8px 32px;font-size:11px;font-family:inherit;outline:none;}
.sb-search-input::placeholder{color:#939db0;}
.sb-search-input:focus{border-color:#c4c4c0;background:#fff;}
.sb-section{padding:4px 8px 8px;flex:1;overflow-y:auto;}
.sb-section-label{font-size:11px;font-weight:600;letter-spacing:0;color:#7f7b73;padding:10px 6px 6px;}
.sb-folder{margin-bottom:1px;}
.sb-folder-hd{display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:5px;cursor:pointer;transition:background .12s ease;}
.sb-folder-hd:hover{background:#f3f3f2;}
.sb-folder-hd.active{background:#ebebea;color:#111;}
.sb-folder-hd.active .sb-folder-name{color:#161614;}
.sb-folder-hd.active .sb-folder-cnt{background:#ddddd9;color:#444440;}
.sb-folder-toggle{width:16px;height:16px;border-radius:3px;border:none;background:none;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.sb-folder-toggle:hover{background:#e5e5e3;}
.sb-folder-hd.active .sb-folder-toggle:hover{background:#d8d8d4;}
.sb-folder-name{font-size:12px;color:#35322d;flex:1;font-weight:500;}
.sb-folder-cnt{font-size:10px;color:#666156;padding:1px 5px;border-radius:999px;background:#e8e8e5;font-weight:700;}
.sb-papers{padding:1px 0 4px 16px;display:flex;flex-direction:column;gap:0px;}
.sb-paper{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:5px;cursor:pointer;transition:background .12s ease;}
.sb-paper:hover{background:#f3f3f2;}
.sb-paper.active{background:#e8e8e5;color:#111;}
.sb-paper-icon{color:#7e8898;display:flex;}
.sb-paper.active .sb-paper-icon{color:#444440;}
.sb-paper-title{font-size:11px;color:#47443e;line-height:1.3;flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.sb-paper.active .sb-paper-title{color:#181816;}
.empty-upload-btn{height:24px;border-radius:7px;border:1px solid #ddd;background:#fff;color:#111;padding:0 8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px;}
.empty-upload-btn:hover{background:#f7f7f7;}
.sb-footer{padding:8px 10px 10px;border-top:1px solid var(--border);background:var(--surface);}
.sb-upload-btn{width:100%;background:#111111;color:#fff;border:1px solid #111111;border-radius:7px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;}
.sb-upload-btn:hover{background:#000;}
.sb-new-folder{width:100%;background:#fff;color:#2e2b26;border:1px solid var(--border);border-radius:7px;padding:8px 12px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;margin-top:5px;}
.sb-new-folder:hover{background:#f7f7f6;}
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
.tabbar{height:42px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:flex-end;padding:0 10px;overflow-x:auto;overflow-y:hidden;flex-shrink:0;}
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
.tab-close:hover{background:#f0f0ee;color:var(--text2);}
.content{flex:1;display:flex;overflow:hidden;}
.content-reader{padding:0;gap:0;background:var(--bg);}
.viewer{flex:1;display:flex;flex-direction:column;min-width:0;gap:0;}
.viewer-frame{flex:1;min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;background:var(--surface);box-shadow:none;}
.viewer-toolbar{height:42px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:8px;flex-shrink:0;min-width:0;}
.vt-left{display:flex;align-items:center;gap:6px;flex:1;min-width:0;}
.vt-btn{background:none;border:none;color:var(--text3);cursor:pointer;padding:7px 8px;border-radius:4px;display:flex;align-items:center;font-size:12px;gap:4px;}
.vt-btn:hover{background:rgba(37,99,235,.08);color:var(--accent);}
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
.chat-topbar{height:46px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:12px;flex-shrink:0;background:var(--bg2);}
.chat-topbar-copy{display:flex;flex-direction:column;gap:1px;min-width:0;}
.chat-topbar-title{font-size:13px;font-weight:600;color:#1b1b19;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-subtitle{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-actions{display:flex;align-items:center;gap:6px;}
.chat-topbar-btn{background:#fff;border:1px solid var(--border);color:#111;cursor:pointer;padding:5px;border-radius:4px;display:flex;}
.chat-topbar-btn-label{padding:5px 8px;gap:6px;align-items:center;font-size:11px;font-weight:600;font-family:inherit;}
.chat-topbar-btn:hover{background:rgba(37,99,235,.06);color:var(--accent);border-color:rgba(37,99,235,.25);}
.chat-topbar-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-scan-banner{margin:10px 10px 0;border:1px solid rgba(37,99,235,.22);border-radius:10px;background:linear-gradient(180deg,rgba(37,99,235,.04) 0%,rgba(37,99,235,.09) 100%);padding:10px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-scan-banner-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.chat-scan-banner-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-scan-banner-title{font-size:12px;font-weight:700;color:var(--accent);}
.chat-scan-banner-meta{font-size:11px;color:#5f7698;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-scan-banner-badge{min-width:44px;height:24px;padding:0 8px;border-radius:999px;border:1px solid rgba(37,99,235,.25);background:#fff;color:var(--accent);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.chat-scan-banner-status{font-size:12px;color:#315071;}
.chat-scan-progress{height:7px;border-radius:999px;background:rgba(37,99,235,.12);overflow:hidden;}
.chat-scan-progress-bar{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent) 0%,#60a5fa 100%);transition:width .2s ease;}
.chat-history-panel{border-bottom:1px solid var(--border);background:#fcfcfc;display:flex;flex-direction:column;max-height:240px;}
.chat-history-panel.chat-history-standalone{flex:1;max-height:none;border-bottom:none;}
.chat-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--bg2);}
.chat-history-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-history-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.chat-history-subtitle{font-size:11px;color:#918b82;}
.chat-history-actions{display:flex;align-items:center;gap:6px;}
.chat-history-btn{border:1px solid var(--border);background:#fff;border-radius:4px;padding:5px 8px;font-size:11px;font-weight:600;color:#37342f;cursor:pointer;font-family:inherit;}
.chat-history-btn:hover{background:rgba(37,99,235,.06);color:var(--accent);border-color:rgba(37,99,235,.25);}
.chat-history-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-history-empty{padding:10px;font-size:12px;color:#8b867c;}
.chat-overview-shell{flex:1;overflow:auto;padding:12px;background:#fff;display:flex;flex-direction:column;gap:12px;}
.chat-overview-hero{border:1px solid var(--border);border-radius:8px;background:#fff;padding:12px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-overview-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.chat-overview-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.chat-overview-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.chat-overview-title{font-size:16px;font-weight:700;color:#1e1c18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-subtitle{font-size:12px;line-height:1.55;color:#696459;max-width:34ch;}
.chat-overview-badge{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 9px;border-radius:999px;border:1px solid rgba(37,99,235,.25);background:rgba(37,99,235,.08);color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}
.chat-overview-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.chat-overview-stat{border:1px solid var(--border);border-radius:6px;background:#fff;padding:9px 10px;display:flex;flex-direction:column;gap:3px;}
.chat-overview-stat-value{font-size:17px;font-weight:700;color:#1f1d1a;}
.chat-overview-stat-label{font-size:11px;color:#7c766d;}
.chat-overview-primary-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.chat-overview-section{border:1px solid var(--border);border-radius:8px;background:#fff;overflow:hidden;}
.chat-overview-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--bg2);}
.chat-overview-section-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-overview-section-title{font-size:12px;font-weight:700;color:#22201c;}
.chat-overview-section-subtitle{font-size:11px;color:#8b867c;}
.chat-overview-count{min-width:24px;height:24px;padding:0 8px;border-radius:999px;background:#fff;border:1px solid #ececec;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#5f5a50;}
.chat-overview-list{display:flex;flex-direction:column;padding:4px 8px 8px;gap:2px;}
.chat-overview-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:0;border-top:none;border-radius:6px;}
.chat-overview-row:first-child{border-top:none;}
.chat-overview-row-main{border:none;background:none;padding:5px 8px;min-width:0;display:block;text-align:left;cursor:pointer;font-family:inherit;border-radius:6px;}
.chat-overview-row-main:hover{background:#f3f3f2;}
.chat-overview-row-title{display:block;font-size:11px;font-weight:500;color:#47443e;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.chat-overview-empty-state{padding:22px 16px;display:flex;flex-direction:column;gap:5px;align-items:flex-start;background:#fff;}
.chat-overview-empty-title{font-size:13px;font-weight:700;color:#1f1d1a;}
.chat-overview-empty-copy{font-size:12px;line-height:1.55;color:#78736a;max-width:34ch;}
.chat-thread-list{display:flex;flex-direction:column;overflow:auto;}
.chat-thread-item{display:flex;align-items:stretch;border-bottom:1px solid var(--border);background:#fff;}
.chat-thread-item:last-child{border-bottom:none;}
.chat-thread-item.active{background:rgba(37,99,235,.07);}
.chat-thread-main{flex:1;min-width:0;border:none;background:none;text-align:left;padding:9px 10px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;}
.chat-thread-main:hover{background:#f5f5f4;}
.chat-thread-item.active .chat-thread-main:hover{background:rgba(37,99,235,.10);}
.chat-thread-name{font-size:12px;font-weight:600;color:#1f1d1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-meta{font-size:11px;color:#8b867c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-actions{display:flex;align-items:center;gap:4px;padding:0 8px;border-left:1px solid var(--border);background:rgba(255,255,255,.5);}
.chat-thread-row-btn{border:1px solid var(--border);background:#fff;border-radius:4px;padding:4px 7px;font-size:10px;font-weight:600;color:#4a463f;cursor:pointer;font-family:inherit;}
.chat-thread-row-btn:hover{background:rgba(37,99,235,.06);color:var(--accent);border-color:rgba(37,99,235,.25);}
.chat-thread-delete{width:28px;height:28px;border:1px solid #f0d3d3;border-radius:4px;background:#fff7f7;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b42318;flex-shrink:0;}
.chat-thread-delete:hover{background:#fff0f0;color:#912018;}
.chat-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 16px 16px;display:flex;flex-direction:column;gap:16px;}
.chat-empty{flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;text-align:left;padding:12px 12px 0;gap:12px;}
.chat-empty-intro{display:flex;gap:10px;align-items:flex-start;padding:4px 2px;}
.chat-empty-icon{width:34px;height:34px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.20);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0;}
.chat-empty-copy h3{font-size:16px;font-weight:700;color:var(--text);line-height:1.25;max-width:none;}
.chat-empty-copy p{font-size:12px;color:var(--text3);line-height:1.55;max-width:none;margin-top:4px;}
.chat-empty-sections{display:flex;flex-direction:column;gap:10px;}
.chat-empty-block{border:1px solid var(--border);border-radius:6px;background:#fff;overflow:hidden;}
.chat-empty-block-title{padding:9px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#78736a;background:var(--bg2);}
.chat-empty-suggestions{display:grid;grid-template-columns:1fr;gap:0;width:100%;}
.chat-suggestion{border:none;border-bottom:1px solid var(--border);background:#fff;padding:11px 12px;font-size:12px;font-weight:600;color:#2f2c28;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;}
.chat-suggestion:last-child{border-bottom:none;}
.chat-suggestion:hover{background:rgba(37,99,235,.05);color:var(--accent);}
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
.citation-popover-boundary{position:relative;}
.agent-main .msg-a-bubble-wrap{max-width:min(820px,calc(100% - 40px));}
.agent-main .msg-a-bubble{max-width:min(820px,calc(100% - 40px));}
.agent-main .msg-u-bubble-wrap{max-width:min(720px,72%);}
.chat-usage-meta{font-size:11px;line-height:1.4;color:#8a867c;padding:0 2px;white-space:normal;overflow-wrap:anywhere;}
.inline-cit-wrap{display:inline-flex;align-items:flex-start;position:relative;vertical-align:super;margin-left:4px;}
.inline-cit-anchor{border:1px solid rgba(37,99,235,.28);background:linear-gradient(180deg,rgba(37,99,235,.06) 0%,rgba(37,99,235,.13) 100%);color:var(--accent);border-radius:999px;min-width:20px;height:20px;padding:0 7px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-weight:800;font-size:10px;line-height:1;font-family:inherit;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 1px 2px rgba(37,99,235,.10);transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease,transform .15s ease;}
.inline-cit-anchor-index{display:block;transform:translateY(-.5px);}
.inline-cit-anchor:hover{background:linear-gradient(180deg,rgba(37,99,235,.04) 0%,rgba(37,99,235,.10) 100%);border-color:rgba(37,99,235,.40);color:var(--accent-hover);box-shadow:0 1px 0 rgba(255,255,255,.95) inset,0 4px 10px rgba(37,99,235,.14);transform:translateY(-1px);}
.inline-cit-anchor.active{background:linear-gradient(180deg,var(--accent) 0%,var(--accent-hover) 100%);border-color:var(--accent-hover);color:#fff;box-shadow:0 10px 20px rgba(37,99,235,.20);}
.inline-cit-anchor:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(37,99,235,.18),0 10px 20px rgba(37,99,235,.18);}
.inline-cit-popover{position:absolute;left:0;top:calc(100% + 10px);z-index:40;min-width:220px;max-width:min(320px,calc(100vw - 80px));box-sizing:border-box;}
.inline-cit-popover::before{content:"";position:absolute;top:-7px;left:18px;width:12px;height:12px;background:#fff;border-left:1px solid rgba(37,99,235,.20);border-top:1px solid rgba(37,99,235,.20);transform:rotate(45deg);}
.inline-cit-popover .source-card{box-shadow:0 20px 40px rgba(14,30,70,.14);background:#fff;border-color:rgba(37,99,235,.20);border-radius:14px;padding:12px 13px;}
.cited-answer-body{display:flex;flex-direction:column;gap:8px;}.cited-answer-body ul,.cited-answer-body ol{margin:0;padding-left:1.4em;}.cited-answer-p{font-size:inherit;line-height:1.65;color:inherit;}.cited-answer-h1,.cited-answer-h2,.cited-answer-h3{font-weight:700;line-height:1.3;color:inherit;margin-top:4px;display:block;}.cited-answer-h1{font-size:1.05em;}.cited-answer-h2{font-size:1em;}.cited-answer-h3{font-size:.95em;color:#444;}.cited-answer-list{padding-left:1.4em;display:flex;flex-direction:column;gap:4px;}.cited-answer-li{font-size:inherit;line-height:1.65;color:inherit;}
.sources-label{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}
.sources-row{display:flex;flex-direction:column;gap:6px;}
.source-card{background:linear-gradient(180deg,#fff 0%,#fbfcff 100%);border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;}
.source-card:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(14,30,70,.10);border-color:rgba(37,99,235,.25);}
.source-card-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
.source-card-file{font-size:11px;font-weight:700;color:#1b1b19;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.source-card-page{font-size:10px;color:var(--accent);background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.18);padding:2px 7px;border-radius:999px;white-space:nowrap;font-weight:700;}
.source-card-jump{font-size:10px;color:var(--accent);font-weight:700;margin-left:auto;white-space:nowrap;}
.source-card-section{font-size:10px;color:#7a8aa5;margin-bottom:6px;font-weight:600;}
.source-card-note{font-size:11px;color:#6c665d;line-height:1.5;margin-bottom:6px;}
.source-card-text{font-size:12px;color:#4a4f58;line-height:1.55;font-style:italic;}
.chat-thinking{display:flex;align-items:flex-start;gap:8px;padding:8px 0;}
.typing{display:flex;gap:3px;}
.typing span{width:5px;height:5px;background:#8f8f8f;border-radius:50%;animation:bounce 1.2s infinite;}
.typing span:nth-child(2){animation-delay:.2s;} .typing span:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-4px);}}
@keyframes citHighlight{0%{opacity:1;}70%{opacity:1;}100%{opacity:0;}}
.chat-input-area{padding:10px;border-top:1px solid var(--border);background:var(--bg2);}
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
.composer-context-pill-btn{cursor:pointer;font-family:inherit;}
.composer-context-pill-btn:hover{background:#eef4ff;border-color:rgba(37,99,235,.25);color:var(--accent);}
.composer-context-pill-text{display:block;min-width:0;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.composer-context-pill-more{background:#fcfbf8;color:#726b5d;}
.composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.composer-tools{display:flex;align-items:center;gap:8px;}
.icon-btn{width:32px;height:32px;border-radius:4px;border:1px solid var(--border);background:#fff;color:#302d28;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.icon-btn:hover{background:rgba(37,99,235,.06);color:var(--accent);}
.send-btn{background:#111;border-color:#111;color:#fff;}
.send-btn:hover{background:var(--accent);border-color:var(--accent);}
.composer-stop-btn{height:32px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;color:#b42318;border-color:#f0d3d3;background:#fff7f7;}
.composer-stop-btn:hover{background:#fff0f0;color:#912018;border-color:#efb5b5;}
.attach-picker{position:relative;}
.attach-menu{position:absolute;left:0;bottom:calc(100% + 6px);width:280px;max-height:260px;overflow:auto;background:#fff;border:1px solid var(--border);border-radius:6px;padding:8px;box-shadow:0 10px 22px rgba(0,0,0,.10);z-index:30;}
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
.agent-view{flex:1;display:grid;grid-template-columns:320px minmax(0,1fr);background:linear-gradient(180deg,#fafaf9 0%,#f6f7fb 100%);overflow:hidden;}
.agent-view.sidebar-collapsed{grid-template-columns:56px minmax(0,1fr);}
.agent-sidebar{background:#fff;border-right:1px solid var(--border);display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.agent-sidebar.collapsed{align-items:stretch;}
.agent-sidebar-head{padding:18px 18px 14px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:12px;}
.agent-sidebar.collapsed .agent-sidebar-head{padding:10px 8px;border-bottom:none;}
.agent-sidebar-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.agent-sidebar.collapsed .agent-sidebar-topbar{flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;}
.agent-sidebar-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.agent-sidebar-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.agent-sidebar-title{font-size:18px;font-weight:800;color:#181713;letter-spacing:-.02em;}
.agent-sidebar-subtitle{font-size:12px;line-height:1.55;color:#777168;}
.agent-sidebar-toggle{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.agent-sidebar-chat-icon{color:#5f5a50;}
.agent-sidebar-chat-icon:hover{color:#1f1d1a;}
.agent-context-card{margin:16px 16px 14px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(180deg,#ffffff 0%,#fafbfd 100%);padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset;}
.agent-context-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.agent-context-meta{font-size:11px;color:#7d786f;font-weight:700;}
.agent-context-copy{font-size:12px;line-height:1.6;color:#5f5a50;}
.agent-thread-list{flex:1;overflow:auto;padding:4px 12px 12px;display:flex;flex-direction:column;gap:2px;}
.agent-thread-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;padding:0;border-radius:6px;background:transparent;}
.agent-thread-row.active{background:#e8e8e5;}
.agent-thread-main{width:100%;border:none;background:none;text-align:left;padding:5px 8px;cursor:pointer;font-family:inherit;display:block;border-radius:6px;min-width:0;}
.agent-thread-main:hover{background:#f3f3f2;}
.agent-thread-row.active .agent-thread-main{background:#e8e8e5;}
.agent-thread-title{display:block;font-size:11px;font-weight:500;color:#47443e;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.agent-thread-row.active .agent-thread-title{color:#181816;}
.thread-compact-delete{width:24px;height:24px;border:none;border-radius:6px;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b42318;flex-shrink:0;}
.thread-compact-delete:hover{background:#fff0f0;color:#912018;}
.thread-compact-delete:focus-visible{outline:2px solid rgba(180,35,24,.2);outline-offset:1px;}
.agent-main{display:flex;flex-direction:column;min-width:0;overflow:hidden;background:linear-gradient(180deg,#fcfcfb 0%,#f7f8fb 100%);}
.agent-main-head{padding:18px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:rgba(255,255,255,.7);backdrop-filter:blur(8px);}
.agent-main-copy{display:flex;flex-direction:column;gap:5px;min-width:0;}
.agent-main-title{font-size:21px;font-weight:800;color:#171613;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.agent-main-subtitle{font-size:12px;color:#7d786f;}
.agent-main-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
.agent-root-badge{height:28px;padding:0 12px;border-radius:999px;border:1px solid rgba(37,99,235,.18);background:rgba(37,99,235,.07);color:var(--accent);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;}
.agent-workspace-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);overflow:hidden;}
.agent-workspace-body.has-preview{grid-template-columns:minmax(0,1fr) 5px minmax(0,1fr);}
.agent-conversation-pane{min-width:0;display:flex;flex-direction:column;min-height:0;}
.agent-preview-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;z-index:2;}
.agent-preview-resize-handle:hover .agent-preview-resize-grip,.agent-preview-resize-handle:active .agent-preview-resize-grip{background:#9ebded;}
.agent-preview-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.agent-msgs{flex:1;overflow:auto;padding:22px 22px 18px;display:flex;flex-direction:column;gap:18px;}
.agent-empty{display:flex;flex-direction:column;gap:18px;max-width:960px;}
.agent-empty-hero{display:flex;align-items:flex-start;gap:14px;padding-top:4px;}
.agent-empty-copy{display:flex;flex-direction:column;gap:6px;max-width:760px;}
.agent-empty-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;}
.agent-empty-copy h2{font-size:30px;line-height:1.08;font-weight:800;letter-spacing:-.04em;color:#181713;max-width:18ch;}
.agent-empty-copy p{font-size:13px;line-height:1.7;color:#696359;max-width:58ch;}
.agent-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-width:900px;}
.agent-quick-chip{border:1px solid var(--border);border-radius:16px;background:#fff;padding:14px;text-align:left;display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;}
.agent-quick-chip:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(14,30,70,.08);border-color:rgba(37,99,235,.22);}
.agent-quick-chip.active{border-color:rgba(37,99,235,.34);background:#f8fbff;box-shadow:0 12px 24px rgba(37,99,235,.08);}
.agent-empty-block{border:1px solid var(--border);border-radius:16px;background:#fff;overflow:hidden;max-width:900px;}
.agent-empty-block-title{padding:12px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#78736a;background:var(--bg2);}
.agent-empty-note{padding:14px;font-size:13px;line-height:1.65;color:#59544c;}
.agent-input-area{padding:14px 20px 18px;border-top:1px solid var(--border);background:rgba(255,255,255,.75);}
.agent-composer{border-radius:16px;padding:12px;box-shadow:0 10px 24px rgba(15,23,42,.05);}
.agent-tool-row{position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.agent-tool-trigger{height:30px;border:none;background:#f5f1e8;color:#5f584b;border-radius:999px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}
.agent-tool-trigger:hover,.agent-tool-trigger.active{background:#eee7da;color:#2f2a22;}
.agent-tool-chip{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 10px;border-radius:999px;background:#eef4ff;border:1px solid rgba(37,99,235,.20);color:var(--accent);font-size:11px;font-weight:800;line-height:1.2;}
.agent-tool-chip-label{display:inline-flex;align-items:center;gap:6px;}
.agent-tool-chip-clear{width:24px;height:24px;border:none;background:transparent;color:inherit;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.agent-tool-chip-clear:hover{background:rgba(37,99,235,.10);}
.agent-tool-hint{font-size:11px;color:#8b867c;font-weight:700;}
.agent-tool-menu{position:absolute;left:0;bottom:calc(100% + 10px);width:300px;max-width:min(300px,calc(100vw - 48px));max-height:min(420px,calc(100vh - 140px));overflow:auto;background:#fff;border:1px solid var(--border);border-radius:18px;padding:10px;box-shadow:0 18px 40px rgba(15,23,42,.12);z-index:35;}
.agent-tool-menu-title{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7d786f;padding:2px 4px 8px;}
.agent-tool-menu-list{display:flex;flex-direction:column;gap:4px;}
.agent-tool-option{width:100%;border:none;background:none;border-radius:12px;padding:10px;text-align:left;display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-family:inherit;}
.agent-tool-option:hover{background:#f7f9fc;}
.agent-tool-option.active{background:#eef4ff;}
.agent-tool-option-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#5f6977;flex-shrink:0;margin-top:1px;}
.agent-tool-option-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.agent-tool-option-title{font-size:12px;font-weight:700;color:#1f1d1a;}
.agent-tool-option-meta{font-size:11px;color:#8b867c;}
.agent-msg-tool{display:flex;justify-content:flex-end;}
.agent-msg-tool-chip{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:#eef4ff;border:1px solid rgba(37,99,235,.18);color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.02em;}
.agent-found-sources{margin:0 0 14px;border:1px solid var(--border);border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(20,20,19,.05);}
.agent-found-sources-head{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:linear-gradient(180deg,#fefefc 0%,#faf9f4 100%);}
.agent-found-sources-title{font-size:14px;font-weight:800;color:#184747;}
.agent-found-sources-subtitle{font-size:12px;color:#7d786f;}
.agent-found-sources-list{display:flex;flex-direction:column;}
.agent-found-source-row{padding:16px;border-top:1px solid #f0efeb;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:#fff;}
.agent-found-source-row:first-child{border-top:none;}
.agent-found-source-copy{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1;}
.agent-found-source-title{font-size:14px;font-weight:800;line-height:1.45;color:#244848;}
.agent-found-source-authors{font-size:12px;color:#7c766f;line-height:1.5;}
.agent-found-source-meta{font-size:12px;color:#7f796f;line-height:1.5;}
.agent-found-source-summary{font-size:12px;color:#4f4a42;line-height:1.55;}
.agent-found-source-link{font-size:11px;color:#8b867c;overflow-wrap:anywhere;}
.agent-found-source-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;flex-shrink:0;max-width:240px;}
.agent-found-source-badge{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:999px;background:#eef6ef;border:1px solid rgba(22,101,52,.12);color:#166534;font-size:10px;font-weight:800;white-space:nowrap;}
.paper-result-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;}
.paper-result-btn{height:32px;border-radius:999px;border:1px solid var(--border);background:#fff;color:#26231e;padding:0 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}
.paper-result-btn:hover{background:#f6f8fc;border-color:rgba(37,99,235,.24);color:var(--accent);}
.paper-result-btn:disabled{opacity:.55;cursor:not-allowed;}
.paper-result-btn-primary{background:#111;color:#fff;border-color:#111;}
.paper-result-btn-primary:hover{background:var(--accent);border-color:var(--accent);color:#fff;}
.paper-result-status{font-size:11px;line-height:1.55;}
.paper-result-status.done{color:#166534;}
.paper-result-status.error{color:#b91c1c;}
.paper-result-status.loading{color:#1d4ed8;}
.agent-preview-drawer{border-left:1px solid var(--border);background:#fff;display:flex;flex-direction:column;min-width:0;min-height:0;}
.agent-preview-head{padding:16px 16px 12px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.agent-preview-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.agent-preview-title{font-size:15px;font-weight:800;color:#191815;line-height:1.4;}
.agent-preview-subtitle{font-size:12px;color:#7d786f;line-height:1.5;}
.agent-preview-toolbar{padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fcfcfb;}
.agent-preview-toolbar-meta{font-size:12px;font-weight:700;color:#5d574d;}
.agent-preview-toolbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.agent-preview-note{margin:12px 16px 0;padding:10px 12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;line-height:1.55;}
.agent-preview-viewer{flex:1;min-height:0;overflow:hidden;display:flex;}
.agent-preview-viewer .pdf-scroll{flex:1;min-height:0;padding:12px;}
.agent-gate{margin:auto;max-width:640px;border:1px solid var(--border);border-radius:24px;background:#fff;padding:28px;box-shadow:0 20px 50px rgba(15,23,42,.08);display:flex;flex-direction:column;gap:16px;align-items:flex-start;}
.agent-gate-copy{display:flex;flex-direction:column;gap:6px;}
.agent-gate-copy h2{font-size:28px;line-height:1.08;font-weight:800;color:#171613;letter-spacing:-.04em;max-width:18ch;}
.agent-gate-copy p{font-size:13px;line-height:1.7;color:#625d54;max-width:52ch;}
.agent-gate-actions{display:flex;flex-wrap:wrap;gap:10px;}
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
  .agent-view{grid-template-columns:290px minmax(0,1fr);}
  .agent-view.sidebar-collapsed{grid-template-columns:56px minmax(0,1fr);}
  .agent-workspace-body.has-preview{grid-template-columns:minmax(0,1fr) 5px minmax(0,1fr);}
}
@media (max-width:1100px){
  .chat-panel{width:360px;min-width:320px;}
  .agent-quick-grid{grid-template-columns:1fr;}
  .agent-found-source-row{flex-direction:column;}
  .agent-found-source-actions{justify-content:flex-start;max-width:none;}
}
@media (max-width:980px){
  .agent-view{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);}
  .agent-view.sidebar-collapsed{grid-template-rows:56px minmax(0,1fr);}
  .agent-sidebar{border-right:none;border-bottom:1px solid var(--border);max-height:280px;}
  .agent-sidebar.collapsed{max-height:56px;}
  .agent-thread-list{padding-bottom:14px;}
  .agent-workspace-body{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr);}
  .agent-workspace-body.has-preview{grid-template-rows:minmax(0,1fr) minmax(280px,42vh);}
  .agent-preview-resize-handle{display:none;}
  .agent-preview-drawer{border-left:none;border-top:1px solid var(--border);}
}
@media (max-width:860px){
  .chat-resize-handle{display:none;}
  .chat-panel{display:none;}
  .topbar{padding:0 14px;}
  .topbar-subtitle{display:none;}
  .viewer-paper-title{font-size:22px;}
  .agent-msgs{padding:18px 16px 14px;}
  .agent-input-area{padding:12px 14px 16px;}
  .agent-main .msg-a-bubble-wrap,.agent-main .msg-a-bubble,.agent-main .msg-u-bubble-wrap{max-width:100%;}
  .agent-empty-copy h2,.agent-gate-copy h2{font-size:24px;}
  .agent-found-sources-head{align-items:flex-start;flex-direction:column;}
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
.settings-input:focus{outline:none;border-color:var(--accent);background:#fff;}
.settings-toggle-vis{background:none;border:1px solid var(--border);border-radius:5px;padding:5px 8px;cursor:pointer;font-size:11px;color:#666;font-family:inherit;}
.settings-toggle-vis:hover{background:#f5f5f5;}
.settings-info{font-size:11px;color:#888;line-height:1.55;margin-top:6px;}
.settings-panel{margin-top:10px;border:1px solid var(--border);border-radius:8px;background:#fafafa;padding:10px;display:flex;flex-direction:column;gap:8px;}
.settings-panel-title{font-size:12px;font-weight:700;color:#333;}
.settings-option{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:12px;color:#4f4b45;line-height:1.45;font-weight:500;}
.settings-option input{margin-top:2px;accent-color:#111;flex-shrink:0;}
.settings-subfield{display:flex;flex-direction:column;gap:6px;margin-top:2px;}
.settings-inline-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.settings-error{margin-top:8px;border:1px solid #f3c4c4;background:#fff5f5;color:#9f1d1d;border-radius:7px;padding:8px 10px;font-size:12px;line-height:1.4;}
.settings-select{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;background:#fafafa;color:var(--text);cursor:pointer;}
.settings-select:focus{outline:none;border-color:var(--accent);}
.sb-settings-bar{padding:8px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:12px;}
.sb-settings-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.sb-settings-label{flex:1;color:#666;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-settings-gear{background:none;border:none;color:#888;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;}
.sb-settings-gear:hover{background:#f0f0f0;color:#333;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);text-align:center;padding:48px;}
.thinking-trace{width:100%;margin-bottom:6px;}
.thinking-trace-live{display:flex;flex-direction:column;gap:8px;}
.thinking-trace-summary,.thinking-trace-toggle{display:inline-flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;padding:4px 0;color:#6f7786;font-size:11px;font-weight:600;font-family:inherit;}
.thinking-trace-toggle:hover{color:var(--accent);}
.thinking-trace-summary-icon,.thinking-trace-toggle-icon{font-size:12px;color:#9b59b6;}
.thinking-trace-summary-label{color:#6f7786;}
.thinking-trace-toggle-count{background:#f0f3f8;border:1px solid #e5e9f0;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;color:#6f7786;}
.thinking-trace-chevron{font-size:9px;color:#aaa;}
.thinking-trace-panel{border:1px solid #e3e8f2;border-radius:18px;background:linear-gradient(180deg,#ffffff 0%,#fafbfd 100%);box-shadow:0 8px 20px rgba(15,23,42,.05);}
.thinking-trace-panel-scroll{max-height:240px;overflow-y:auto;padding:12px 14px;}
.thinking-trace-steps{display:flex;flex-direction:column;gap:10px;}
.thinking-step{animation:thinkStepIn .2s ease;}
.thinking-step-header{display:flex;align-items:flex-start;gap:8px;padding:0;}
.thinking-step-icon{font-size:11px;color:#aab0bc;line-height:1.5;flex-shrink:0;}
.thinking-step-label{font-size:12px;color:#6f7786;line-height:1.5;word-break:break-word;flex:1;}
.thinking-step-body{font-size:12px;color:#555;line-height:1.6;margin:2px 0 0 18px;white-space:pre-wrap;word-break:break-word;background:#ffffff;border:1px solid #edf1f7;border-radius:14px;padding:10px 12px;}
.thinking-step-reasoning .thinking-step-icon{color:#9b59b6;}
.thinking-step-reasoning .thinking-step-label{color:#7d3c98;font-style:italic;}
.thinking-step-reasoning .thinking-step-body{background:#fcf9ff;}
.thinking-step-search .thinking-step-icon{color:var(--accent);}
.thinking-step-search .thinking-step-label{color:var(--accent-hover);}
.thinking-step-result .thinking-step-icon{color:#16a34a;}
.thinking-step-result .thinking-step-label{color:#4a7c5c;}
@keyframes thinkStepIn{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:translateY(0);}}
`;

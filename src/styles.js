export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Literata:ital,opsz,wght@0,7..72,300;0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,400;1,7..72,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --ink:#17181A;
  --ink-2:#23262B;
  --ink-3:#33353A;
  --text-2:#5D616A;
  --text-3:#6E7178;
  --text-4:#9095A0;
  --text-5:#9CA0A7;
  --text-5-sm:#7E838C;
  --hairline:rgba(20,22,28,.10);
  --hairline-soft:#EAEBEE;
  --surface:#FFFFFF;
  --field:#F2F2F4;
  --desk:#EFEFF1;
  --fill-1:#F4F5F7;
  --fill-2:#F7F8F9;
  --fill-3:#FAFAFB;
  --hover:rgba(20,22,28,.06);
  --selected:rgba(20,22,28,.075);
  --accent:#55697F;
  --accent-hover:#3F5063;
  --accent-tint:#E3E9EF;
  --accent-on-tint:#2F4056;
  --highlight:#D5DEE7;
  --swatch-2:#7C8B9C;
  --swatch-3:#B3BDC8;
  --sh-hairline:0 0 0 .5px rgba(20,22,28,.10);
  --sh-card:0 0 0 .5px rgba(20,22,28,.10),0 2px 6px rgba(20,22,28,.06);
  --sh-raised:0 0 0 .5px rgba(20,22,28,.10),0 1px 2px rgba(20,22,28,.08);
  --sh-panel:0 0 0 .5px rgba(20,22,28,.10),0 2px 6px rgba(20,22,28,.06),0 20px 44px -30px rgba(20,22,28,.35);
  --sh-sheet:0 0 0 .5px rgba(20,22,28,.10),0 2px 5px rgba(20,22,28,.07),0 18px 40px -22px rgba(20,22,28,.32);
  --sh-float:0 0 0 .5px rgba(20,22,28,.14),0 10px 26px -10px rgba(20,22,28,.35);
  --sh-window:0 0 0 .5px rgba(20,22,28,.16),0 30px 70px -20px rgba(12,16,28,.55);
  --sans:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',system-ui,sans-serif;
  --serif:'Newsreader',Georgia,'Times New Roman',serif;
  --display:'Literata',Georgia,'Times New Roman',serif;
  /* Answer prose uses the UI sans — more readable on screen than a display serif. */
  --answer:var(--sans);
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --ease:ease-out;
  --bg:var(--field);
  --bg2:var(--fill-1);
  --surface-strong:var(--fill-1);
  --surface-soft:var(--fill-2);
  --border:var(--hairline-soft);
  --border2:#E0E1E5;
  --text:var(--ink);
  --text2:var(--text-2);
  --text3:var(--text-4);
  --accent-soft:var(--accent-tint);
  --accent-border:rgba(85,105,127,.28);
  --chip:var(--fill-1);
  --shadow:var(--sh-card);
  --shadow-lg:var(--sh-panel);
}
html,body,#root{height:100%;}
body{font-family:var(--sans);background:var(--field);color:var(--ink);height:100vh;overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
::selection{background:rgba(85,105,127,.22);}
.app{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative;background:transparent;}
.sb{width:238px;min-width:238px;background:linear-gradient(180deg,rgba(240,243,246,.74) 0%,rgba(228,232,237,.78) 100%);-webkit-backdrop-filter:blur(34px) saturate(180%);backdrop-filter:blur(34px) saturate(180%);border-right:none;box-shadow:.5px 0 0 var(--hairline);display:flex;flex-direction:column;height:100vh;overflow:hidden;transition:width .18s var(--ease),min-width .18s var(--ease);}
.sb.closed{width:0;min-width:0;box-shadow:none;}
.sb-inner{width:238px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
.sb-chrome{height:52px;padding:0 8px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:4px;flex-shrink:0;}
.sb-workspace{margin:0;height:36px;padding:0 6px 0 8px;border-radius:9px;display:flex;align-items:center;gap:9px;cursor:pointer;border:none;background:transparent;min-width:0;flex:1;width:auto;font-family:inherit;text-align:left;color:var(--ink);transition:background .12s var(--ease);}
.sb-workspace:hover{background:var(--hover);}
.sb-workspace-mark{width:28px;height:28px;border-radius:7px;background:#fff;box-shadow:var(--sh-raised);display:flex;align-items:center;justify-content:center;position:relative;flex-shrink:0;}
.sb-workspace-mark::before{content:"";position:absolute;inset:6px 7px;border-radius:1px;background:var(--ink);}
.sb-workspace-mark::after{content:"";position:absolute;inset:9px 9px auto 9px;height:1px;background:#fff;box-shadow:0 3px 0 0 #fff,0 6px 0 0 #fff;}
.sb-workspace-label{flex:1;min-width:0;font-size:14.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-workspace-chev{color:var(--text-4);display:flex;flex-shrink:0;}
.sb-user{display:flex;align-items:center;gap:8px;min-width:0;flex:1;margin:0;padding:0;border:0;background:transparent;cursor:pointer;font:inherit;text-align:left;color:inherit;}
.sb-user:hover .sb-username{color:var(--ink);}
.sb-avatar{width:24px;height:24px;border-radius:6px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;position:relative;flex-shrink:0;}
.sb-avatar::before{content:"";position:absolute;inset:5px 6px;border-radius:1px;background:#fff;}
.sb-avatar::after{content:"";position:absolute;inset:8px 8px auto 8px;height:1px;background:var(--ink);box-shadow:0 3px 0 0 var(--ink),0 6px 0 0 var(--ink);}
.sb-username{font-size:12.5px;font-weight:600;color:var(--text-2);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-account{display:flex;align-items:center;min-width:0;flex-shrink:0;max-width:42%;}
.sb-account-link{font-size:12px;font-weight:600;color:var(--accent);text-decoration:none;white-space:nowrap;padding:4px 2px;}
.sb-account-link:hover{color:var(--ink);text-decoration:underline;text-underline-offset:2px;}
.sb-account-badge{font-size:10px;font-weight:700;color:var(--accent-on,#2F4056);background:var(--accent-tint,#E3E9EF);border-radius:999px;padding:2px 6px;flex-shrink:0;}
.sb-tog{background:transparent;border:none;color:var(--text-3);cursor:pointer;padding:6px;border-radius:6px;display:flex;flex-shrink:0;transition:background .12s var(--ease);}
.sb-tog:hover{background:var(--hover);color:var(--ink);}
.sb-nav{padding:4px 8px 8px;display:flex;flex-direction:column;gap:1px;border-bottom:none;}
.sb-nav-item{display:flex;align-items:center;gap:11px;padding:0 9px;height:32px;border-radius:8px;cursor:pointer;color:var(--ink-3);font-size:13.5px;font-weight:400;border:none;background:none;width:100%;text-align:left;font-family:inherit;transition:background .12s var(--ease),color .12s var(--ease);}
.sb-nav-item svg{color:var(--text-3);flex-shrink:0;}
.sb-nav-item:hover{background:var(--hover);color:var(--ink);}
.sb-nav-item.active{background:var(--selected);color:var(--ink);font-weight:600;}
.sb-nav-item.active svg{color:var(--accent);}
.sb-nav-count{margin-left:auto;font-size:12px;color:var(--text-4);font-variant-numeric:tabular-nums;}
.sb-search-wrap{padding:8px 10px 6px;position:relative;}
.sb-search-icon{position:absolute;left:22px;top:50%;transform:translateY(-35%);color:var(--text-4);pointer-events:none;}
.sb-search-input{width:100%;background:var(--surface);border:none;box-shadow:var(--sh-hairline);color:var(--ink);border-radius:8px;padding:8px 10px 8px 32px;font-size:12px;font-family:inherit;outline:none;}
.sb-search-input::placeholder{color:var(--text-5);}
.sb-search-input:focus{box-shadow:var(--sh-hairline),0 0 0 3px var(--accent-tint);}
.sb-section{padding:4px 8px 8px;flex:1;overflow-y:auto;}
.sb-section-hd{display:flex;align-items:center;gap:6px;padding:20px 6px 6px;color:var(--text-4);}
.sb-section-label{font-size:12px;font-weight:600;color:var(--text-4);padding:0;flex:1;}
.sb-section-add{background:none;border:none;color:var(--text-4);cursor:pointer;padding:4px;border-radius:6px;display:flex;}
.sb-section-add:hover{background:var(--hover);color:var(--ink);}
.sb-folder{margin-bottom:6px;}
.sb-folder-hd{display:flex;align-items:center;gap:7px;padding:0 6px;height:31px;border-radius:8px;cursor:pointer;transition:background .12s var(--ease);}
.sb-folder-hd:hover{background:var(--hover);}
.sb-folder-hd.active{background:var(--selected);}
.sb-folder-hd.active .sb-folder-name{color:var(--ink);font-weight:600;}
.sb-folder-swatch{width:15px;height:15px;border-radius:4px;flex-shrink:0;background:var(--accent);}
.sb-folder-swatch.s2{background:var(--swatch-2);}
.sb-folder-swatch.s3{background:var(--swatch-3);}
.sb-folder-toggle{width:16px;height:16px;border-radius:3px;border:none;background:none;color:var(--text-4);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.sb-folder-toggle:hover{background:var(--hover);}
.sb-folder-name{font-size:13.5px;color:var(--ink-3);flex:1;font-weight:400;}
.sb-folder-cnt{font-size:12px;color:var(--text-4);padding:0;background:transparent;font-weight:400;font-variant-numeric:tabular-nums;}
.sb-papers{padding:4px 0 2px 18px;display:flex;flex-direction:column;gap:3px;}
.sb-paper{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:8px;cursor:pointer;transition:background .12s var(--ease);}
.sb-paper:hover{background:var(--hover);}
.sb-paper.active{background:#FFFFFF;box-shadow:var(--sh-raised);}
.sb-paper-icon{color:var(--text-4);display:flex;}
.sb-paper.active .sb-paper-icon{color:var(--accent);}
.sb-paper-title{font-size:12.5px;color:var(--ink-3);line-height:1.3;flex:1;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.sb-paper.active .sb-paper-title{color:var(--ink);font-weight:600;}
.empty-upload-btn{height:24px;border-radius:7px;border:none;box-shadow:var(--sh-hairline);background:#fff;color:var(--ink);padding:0 8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px;}
.empty-upload-btn:hover{background:var(--fill-1);}
.sb-footer{padding:12px 14px;border-top:.5px solid var(--hairline-soft);background:transparent;display:flex;align-items:center;gap:8px;}
.sb-key-status{display:flex;align-items:center;gap:8px;flex:1;min-width:0;font-size:12px;color:var(--text-3);}
.sb-key-dot{width:7px;height:7px;border-radius:50%;background:#28C840;flex-shrink:0;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.12);}
.sb-key-dot.off{background:var(--text-4);}
.sb-key-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-footer-gear{background:none;border:none;color:var(--text-3);cursor:pointer;padding:6px;border-radius:6px;display:flex;}
.sb-footer-gear:hover{background:var(--hover);color:var(--ink);}
.sb-upload-btn{width:100%;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:background .12s var(--ease);}
.sb-upload-btn:hover{background:var(--accent-hover);}
.sb-new-folder{width:100%;background:var(--fill-1);color:var(--text-2);border:none;border-radius:8px;padding:8px 12px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;margin-top:5px;}
.sb-new-folder:hover{background:var(--hover);}
.nf-input{background:#fff;border:none;box-shadow:var(--sh-hairline);color:var(--ink);border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;margin:3px 0;width:100%;display:block;}
.nf-ctrl{display:flex;gap:6px;margin-top:6px;}
.nf-ctrl .lib-btn{flex:1;justify-content:center;}
.nf-error{font-size:11px;color:#b91c1c;padding:2px 2px 0;}
.main{flex:1;display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--field);box-shadow:-.5px 0 0 var(--hairline);min-width:0;}
.topbar{height:52px;background:transparent;border-bottom:none;display:flex;align-items:center;padding:0 14px;gap:10px;flex-shrink:0;}
.topbar-left{display:flex;align-items:center;gap:6px;min-width:0;flex:1;}
.topbar-nav-btns{display:flex;align-items:center;gap:2px;flex-shrink:0;}
.topbar-icon-btn{width:28px;height:26px;border:none;background:transparent;color:var(--text-3);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.topbar-icon-btn:hover{background:var(--hover);color:var(--ink);}
.topbar-icon-btn:disabled{opacity:.35;cursor:not-allowed;}
.topbar-tabs{display:flex;align-items:center;gap:2px;min-width:0;overflow-x:auto;flex:1;}
.topbar-tabs::-webkit-scrollbar{display:none;}
.topbar-title-stack{display:flex;align-items:baseline;gap:10px;min-width:0;}
.topbar-folder-name{font-size:14.5px;font-weight:600;color:var(--ink);letter-spacing:-.01em;white-space:nowrap;}
.topbar-subtitle{font-size:12.5px;color:var(--text-5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;}
.topbar-search{height:28px;width:126px;border:none;border-radius:8px;background:#fff;box-shadow:var(--sh-hairline);padding:0 10px;font-size:12px;font-family:inherit;color:var(--ink);outline:none;}
.topbar-search.lib-wide{width:210px;}
.topbar-search::placeholder{color:var(--text-5);}
.topbar-find{
  display:flex;align-items:center;gap:2px;
  height:28px;min-width:126px;max-width:126px;
  padding:0 4px 0 8px;border-radius:8px;background:#fff;
  box-shadow:var(--sh-hairline);
  transition:max-width .22s cubic-bezier(0.32,0.72,0,1), box-shadow .18s cubic-bezier(0.32,0.72,0,1);
}
.topbar-find.open{
  max-width:320px;min-width:220px;
  box-shadow:var(--sh-hairline),0 0 0 2px color-mix(in srgb,var(--accent) 28%,transparent);
}
.topbar-find-ico{display:flex;color:var(--text-4);flex-shrink:0;}
.topbar-find-input{
  flex:1;min-width:0;height:100%;border:0;outline:none;background:transparent;
  font-size:12.5px;font-family:inherit;color:var(--ink);padding:0 4px;
}
.topbar-find-input::placeholder{color:var(--text-5);}
.topbar-find-input::-webkit-search-cancel-button{display:none;}
.topbar-find-actions{display:flex;align-items:center;gap:1px;flex-shrink:0;}
.topbar-find-meta{
  font-size:11px;font-weight:600;color:var(--text-4);
  font-variant-numeric:tabular-nums;padding:0 4px;white-space:nowrap;
}
.topbar-find-btn{
  width:22px;height:22px;border:none;border-radius:5px;background:transparent;
  color:var(--text-3);cursor:pointer;display:grid;place-items:center;padding:0;
}
.topbar-find-btn:hover{background:var(--hover);color:var(--ink);}
.topbar-find-btn:disabled{opacity:.35;cursor:not-allowed;}
.topbar-count,.topbar-mode{display:none;}
.topbar-btn{background:transparent;border:none;color:var(--text-2);border-radius:8px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
.topbar-btn:hover{background:var(--hover);color:var(--ink);}
.topbar-btn.ghost{background:var(--fill-1);color:var(--ink-3);}
.topbar-btn.primary,.topbar-btn.active{background:var(--accent);color:#fff;}
.topbar-btn.primary:hover,.topbar-btn.active:hover{background:var(--accent-hover);color:#fff;}
.tb-divider{width:1px;height:20px;background:var(--hairline-soft);}
.tabbar{display:none;}
.tab{position:relative;display:flex;align-items:center;gap:7px;padding:0 9px;height:28px;max-width:250px;min-width:0;border:none;border-radius:7px;cursor:pointer;font-size:12.5px;color:#4A4E56;white-space:nowrap;background:transparent;flex-shrink:0;}
.tab:hover{background:rgba(20,22,28,.055);color:var(--ink);}
.tab.active{background:#FFFFFF;box-shadow:var(--sh-raised);color:var(--ink);font-weight:600;}
.tab-dot{width:5px;height:5px;border-radius:50%;background:var(--accent);flex-shrink:0;display:none;}
.tab.active .tab-dot{display:block;}
.tab-icon{display:none;}
.tab-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:inherit;line-height:1;max-width:190px;}
.tab.active .tab-name{max-width:220px;font-weight:600;}
.tabbar-tail{display:none;}
.tab-add{width:26px;height:26px;border:none;background:transparent;color:var(--text-3);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
.tab-add:hover{background:var(--hover);color:var(--ink);}
.tab-close{display:flex;align-items:center;justify-content:center;width:16px;height:16px;border:none;background:transparent;color:var(--text-4);border-radius:4px;cursor:pointer;opacity:0;flex-shrink:0;}
.tab:hover .tab-close,.tab.active .tab-close{opacity:1;}
.tab-close:hover{background:var(--hover);color:var(--ink);}
.content{flex:1;display:flex;overflow:hidden;padding:0 14px 14px;gap:14px;background:var(--field);min-height:0;}
.content-reader{padding:0 14px 14px;gap:14px;background:var(--field);}
.reader-shell{flex:1;display:flex;min-width:0;min-height:0;overflow:hidden;gap:14px;}
.reader-main{flex:1;min-width:0;min-height:0;display:flex;}
.reader-shell-with-detail .lib-detail{border-radius:11px;border:none;box-shadow:var(--sh-panel);max-height:none;height:100%;width:328px;background:var(--surface);}
.viewer{flex:1;display:flex;flex-direction:column;min-width:0;gap:0;border-radius:11px;background:var(--desk);box-shadow:var(--sh-card);overflow:hidden;position:relative;}
.viewer-frame{flex:1;min-height:0;display:flex;flex-direction:column;border-right:none;overflow:hidden;background:transparent;position:relative;}
.viewer-toolbar{display:none;}
.viewer-float-toolbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);height:38px;padding:0 6px;border-radius:11px;background:rgba(252,252,253,.82);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);box-shadow:var(--sh-float);display:flex;align-items:center;gap:2px;z-index:20;white-space:nowrap;}
.vt-left{display:flex;align-items:center;gap:2px;}
.vt-btn{background:none;border:none;color:var(--text-3);cursor:pointer;padding:7px 8px;border-radius:6px;display:flex;align-items:center;font-size:12px;gap:4px;}
.vt-btn:hover{background:var(--hover);color:var(--ink);}
.vt-btn:disabled{opacity:.35;cursor:not-allowed;}
.vt-btn.hl-btn{background:var(--accent);color:#fff;border-radius:7px;height:26px;padding:0 10px;font-size:12px;font-weight:600;margin-left:4px;}
.vt-btn.hl-btn:hover{background:var(--accent-hover);color:#fff;}
.vt-search-wrap{display:none;}
.vt-sep{width:1px;height:16px;background:var(--hairline-soft);margin:0 4px;}
.vt-zoom{display:flex;align-items:center;gap:2px;}
.vt-zoom-val{font-size:12px;color:var(--text-2);min-width:46px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;}
.vt-page{display:inline-flex;align-items:baseline;gap:4px;flex-shrink:0;padding:0 6px;white-space:nowrap;font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--ink);font-weight:600;}
.vt-page-current{appearance:none;border:none;background:transparent;padding:0;margin:0;font:inherit;font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:600;color:var(--ink);cursor:text;border-radius:4px;line-height:1;}
.vt-page-current:hover{background:var(--hover);}
.vt-page-input{width:2.6ch;min-width:2.6ch;border:none;outline:none;background:var(--fill-1);border-radius:4px;padding:1px 3px;font:inherit;font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:600;color:var(--ink);text-align:center;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 35%,transparent);}
.vt-page-sep{color:var(--text-4);font-weight:500;}
.vt-page-total{font-size:12.5px;color:var(--text-4);font-weight:500;}
.pdf-scroll{flex:1;overflow:auto;background:var(--desk);padding:20px 18px 72px;position:relative;}
.pdf-pages{display:flex;flex-direction:column;align-items:center;width:100%;min-width:0;}
.pdf-pages-zoom{width:100%;min-width:0;display:flex;flex-direction:column;align-items:center;will-change:transform;}
.pdf-pages > div{border-radius:4px !important;border:none !important;box-shadow:var(--sh-sheet) !important;max-width:none;}
.textLayer{position:absolute;inset:0;overflow:hidden;line-height:1;-webkit-text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:2;pointer-events:auto;mix-blend-mode:multiply;}
.textLayer span,.textLayer br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0;font-kerning:none;font-variant-ligatures:none;-webkit-user-modify:read-only;}
.textLayer span::selection{background:rgba(85,105,127,.30);color:transparent;}
.textLayer br::selection{background:rgba(85,105,127,.30);}
.textLayer .endOfContent{display:block;position:absolute;left:0;top:100%;right:0;bottom:0;z-index:-1;cursor:default;user-select:none;}
.textLayer .markedContent{top:0;height:0;}
.pdf-scroll.debug-text-layer .textLayer span{outline:1px solid rgba(255,0,0,.25);background:rgba(255,0,0,.08)!important;}
.ocrLayer{user-select:text;-webkit-user-select:text;mix-blend-mode:multiply;}
.ocrLayer .ocr-line{pointer-events:none;user-select:none;-webkit-user-select:none;}
.ocrLayer .ocr-word{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0;font-kerning:none;font-variant-ligatures:none;pointer-events:auto;user-select:text;-webkit-user-select:text;}
.ocrLayer .ocr-word::selection{background:rgba(85,105,127,.30);color:transparent;}
.pdf-scroll.debug-text-layer .ocrLayer .ocr-line{outline:1px solid rgba(0,128,0,.35);background:rgba(0,128,0,.06)!important;}
.pdf-scroll.debug-text-layer .ocrLayer .ocr-word{outline:1px dotted rgba(0,200,0,.3);background:rgba(0,200,0,.08)!important;}
.sel-pop{position:fixed;background:rgba(252,252,253,.92);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:none;border-radius:11px;padding:5px;display:flex;gap:2px;box-shadow:var(--sh-float);z-index:1000;}
.sel-btn{background:none;border:none;color:var(--text-2);padding:6px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;display:flex;align-items:center;gap:6px;white-space:nowrap;}
.sel-btn.pri{color:var(--accent);font-weight:600;}
.sel-btn:hover{background:var(--hover);color:var(--ink);}
.sel-btn.pri:hover{background:var(--accent-tint);color:var(--accent-on-tint);}
/* Highlight wash lives on the transparent text layer above the canvas.
   .textLayer { mix-blend-mode: multiply } is what keeps glyphs readable. */
.ann-hl{
  background:color-mix(in srgb,var(--highlight) 72%,#fff)!important;
  border-radius:2px;
  cursor:pointer;
  color:transparent!important;
  box-decoration-break:clone;
  -webkit-box-decoration-break:clone;
}
.ann-hl::selection{background:rgba(85,105,127,.30);color:transparent;}
.ann-hl.cit-flash{outline:2px solid var(--accent);animation:citHighlight 1.2s ease-out forwards;}
.vt-btn.hl-btn:disabled{opacity:.4;cursor:not-allowed;}
.ann-popover{position:fixed;background:white;border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:0 16px 32px rgba(0,0,0,.14);z-index:1001;width:300px;display:flex;flex-direction:column;gap:10px;}
.ann-popover-text{font-family:var(--serif);font-size:12.5px;color:#57534e;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-style:italic;}
.ann-popover textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical;min-height:60px;outline:none;}
.ann-popover textarea:focus{border-color:var(--accent);}
.ann-popover-actions{display:flex;gap:6px;justify-content:flex-end;}
.ann-popover-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:white;color:#333;font-family:inherit;}
.ann-popover-btn:hover{background:#f5f5f5;}
.ann-popover-btn.primary{background:#111;color:white;border-color:#111;}
.ann-popover-btn.primary:hover{background:#333;}
.ann-popover-btn.danger{color:#dc2626;border-color:#fca5a5;}
.ann-popover-btn.danger:hover{background:#fef2f2;}
.explain-popover{position:fixed;background:white;border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:0 16px 32px rgba(0,0,0,.14);z-index:1001;width:360px;max-height:min(420px,70vh);display:flex;flex-direction:column;gap:10px;}
.explain-popover-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.explain-popover-label{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6b6560;}
.explain-popover-close{border:none;background:transparent;color:#888;cursor:pointer;padding:4px;border-radius:6px;display:inline-flex;}
.explain-popover-close:hover{background:#f5f5f5;color:#333;}
.explain-popover-passage{font-family:var(--serif);font-size:12.5px;color:#57534e;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-style:italic;}
.explain-popover-status{font-size:12px;color:#6b6560;}
.explain-popover-error{font-size:12px;color:#dc2626;line-height:1.4;}
.explain-popover-answer{font-size:13px;color:#222;line-height:1.55;overflow:auto;flex:1;min-height:0;}
.explain-popover-actions{display:flex;gap:6px;justify-content:flex-end;}
.explain-popover-actions .ann-popover-btn:disabled{opacity:.45;cursor:default;}
.notes-panel{flex:1;overflow-y:auto;padding:16px;}
.notes-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:32px;color:#888;}
.notes-empty-icon{font-size:28px;opacity:.3;margin-bottom:12px;}
.notes-empty h3{font-size:15px;font-weight:600;color:#555;margin:0 0 8px;}
.notes-empty p{font-size:13px;line-height:1.6;max-width:260px;}
.notes-group{margin-bottom:20px;}
.notes-group-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);}
.note-card{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:box-shadow .15s ease;}
.note-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.08);}
.note-card-text{font-family:var(--serif);font-size:13px;color:#57534e;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-style:italic;margin-bottom:4px;}
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
.sb-resize-handle:hover .sb-resize-grip,.sb-resize-handle:active .sb-resize-grip{background:var(--accent);}
.sb-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.chat-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;}
.chat-resize-handle:hover .chat-resize-grip,.chat-resize-handle:active .chat-resize-grip{background:var(--accent);}
.chat-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.chat-panel{width:412px;min-width:360px;max-width:min(480px,42vw);background:var(--surface);display:flex;flex-direction:column;height:100%;overflow:hidden;border-radius:11px;box-shadow:var(--sh-panel);}
.chat-topbar{height:46px;border-bottom:.5px solid var(--hairline-soft);display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 15px;gap:9px;flex-shrink:0;background:var(--surface);}
.chat-topbar-copy{display:flex;flex-direction:column;gap:1px;min-width:0;}
.chat-topbar-title{font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-subtitle{font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-topbar-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.chat-topbar-island{padding:2px;border-radius:10px;background:rgba(20,22,28,.04);box-shadow:inset 0 0 0 .5px rgba(20,22,28,.06);}
.chat-topbar-island-inner{display:flex;align-items:center;gap:1px;padding:1px;border-radius:8px;background:var(--surface);box-shadow:inset 0 1px 0 rgba(255,255,255,.7);}
.chat-topbar-btn{position:relative;background:transparent;border:none;color:var(--text-3);cursor:pointer;width:28px;height:26px;padding:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .45s cubic-bezier(.32,.72,0,1),color .45s cubic-bezier(.32,.72,0,1),transform .45s cubic-bezier(.32,.72,0,1);}
.chat-topbar-btn:hover{background:var(--hover);color:var(--ink);}
.chat-topbar-btn:active{transform:scale(.96);}
.chat-topbar-btn.on{background:var(--accent-tint);color:var(--accent-on-tint);}
.chat-topbar-btn.on:hover{background:var(--accent-tint);color:var(--accent-on-tint);}
.chat-topbar-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.chat-topbar-collapse{opacity:.72;}
.chat-topbar-collapse:hover{opacity:1;}
.chat-topbar-btn[data-tooltip]::after{content:attr(data-tooltip);position:absolute;top:calc(100% + 7px);left:50%;z-index:40;padding:5px 8px;border-radius:7px;background:rgba(28,30,36,.92);color:#f5f6f8;font-family:var(--sans);font-size:11px;font-weight:550;letter-spacing:.01em;line-height:1.2;white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,4px);box-shadow:0 8px 20px rgba(20,22,28,.18);transition:opacity .35s cubic-bezier(.32,.72,0,1),transform .35s cubic-bezier(.32,.72,0,1);}
.chat-topbar-btn[data-tooltip]::before{content:"";position:absolute;top:calc(100% + 3px);left:50%;z-index:40;border:4px solid transparent;border-bottom-color:rgba(28,30,36,.92);pointer-events:none;opacity:0;transform:translate(-50%,4px);transition:opacity .35s cubic-bezier(.32,.72,0,1),transform .35s cubic-bezier(.32,.72,0,1);}
.chat-topbar-btn[data-tooltip]:hover::after,.chat-topbar-btn[data-tooltip]:hover::before,.chat-topbar-btn[data-tooltip]:focus-visible::after,.chat-topbar-btn[data-tooltip]:focus-visible::before{opacity:1;transform:translate(-50%,0);}
.chat-topbar-btn[data-tooltip]:disabled:hover::after,.chat-topbar-btn[data-tooltip]:disabled:hover::before{opacity:0;}
.chat-topbar-collapse[data-tooltip]::after{left:auto;right:0;transform:translate(0,4px);}
.chat-topbar-collapse[data-tooltip]::before{left:auto;right:10px;transform:translate(0,4px);}
.chat-topbar-collapse[data-tooltip]:hover::after,.chat-topbar-collapse[data-tooltip]:focus-visible::after{transform:translate(0,0);}
.chat-topbar-collapse[data-tooltip]:hover::before,.chat-topbar-collapse[data-tooltip]:focus-visible::before{transform:translate(0,0);}
.chat-scan-banner{margin:10px 10px 0;border:1px solid var(--accent-border);border-radius:10px;background:linear-gradient(180deg,rgba(85,105,127,.03) 0%,rgba(85,105,127,.07) 100%);padding:10px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-scan-banner-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.chat-scan-banner-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-scan-banner-title{font-size:12px;font-weight:700;color:var(--accent);}
.chat-scan-banner-meta{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-scan-banner-badge{min-width:44px;height:24px;padding:0 8px;border-radius:999px;border:1px solid var(--accent-border);background:var(--surface);color:var(--accent);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;}
.chat-scan-banner-status{font-size:12px;color:var(--text2);}
.chat-scan-progress{height:6px;border-radius:999px;background:rgba(85,105,127,.12);overflow:hidden;}
.chat-scan-progress-bar{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent) 0%,var(--accent) 100%);transition:width .25s var(--ease);}
.chat-history-panel{border-bottom:1px solid var(--border);background:var(--surface-soft);display:flex;flex-direction:column;max-height:240px;}
.chat-history-panel.chat-history-standalone{flex:1;max-height:none;border-bottom:none;}
.chat-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--bg2);}
.chat-history-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-history-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
.chat-history-subtitle{font-size:11px;color:var(--text3);}
.chat-history-actions{display:flex;align-items:center;gap:6px;}
.chat-history-btn{border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:5px 8px;font-size:11px;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit;transition:background .15s var(--ease),color .15s var(--ease),border-color .15s var(--ease);}
.chat-history-btn:hover{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-border);}
.chat-history-btn:disabled{opacity:.45;cursor:not-allowed;}
.chat-history-empty{padding:10px;font-size:12px;color:var(--text3);}
.chat-overview-shell{flex:1;overflow:auto;padding:12px;background:var(--surface);display:flex;flex-direction:column;gap:12px;}
.chat-overview-hero{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:12px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 0 rgba(255,255,255,.75) inset;}
.chat-overview-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.chat-overview-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.chat-overview-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
.chat-overview-title{font-size:16px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-overview-subtitle{font-size:12px;line-height:1.55;color:var(--text2);max-width:34ch;}
.chat-overview-badge{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 9px;border-radius:999px;border:1px solid var(--accent-border);background:var(--accent-soft);color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}
.chat-overview-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.chat-overview-stat{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:9px 10px;display:flex;flex-direction:column;gap:3px;}
.chat-overview-stat-value{font-size:17px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;}
.chat-overview-stat-label{font-size:11px;color:var(--text3);}
.chat-overview-primary-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.chat-overview-section{border:1px solid var(--border);border-radius:8px;background:#fff;overflow:hidden;}
.chat-overview-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--bg2);}
.chat-overview-section-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-overview-section-title{font-size:12px;font-weight:600;color:var(--text);}
.chat-overview-section-subtitle{font-size:11px;color:var(--text3);}
.chat-overview-count{min-width:24px;height:24px;padding:0 8px;border-radius:999px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text2);font-variant-numeric:tabular-nums;}
.chat-overview-list{display:flex;flex-direction:column;padding:4px 8px 8px;gap:2px;}
.chat-overview-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:0;border-top:none;border-radius:6px;}
.chat-overview-row:first-child{border-top:none;}
.chat-overview-row-main{border:none;background:none;padding:5px 8px;min-width:0;display:block;text-align:left;cursor:pointer;font-family:inherit;border-radius:6px;}
.chat-overview-row-main:hover{background:var(--bg2);}
.chat-overview-row-title{display:block;font-size:11px;font-weight:500;color:var(--text2);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.chat-overview-empty-state{padding:22px 16px;display:flex;flex-direction:column;gap:5px;align-items:flex-start;background:var(--surface);}
.chat-overview-empty-title{font-size:13px;font-weight:600;color:var(--text);}
.chat-overview-empty-copy{font-size:12px;line-height:1.55;color:var(--text3);max-width:34ch;}
.chat-thread-list{display:flex;flex-direction:column;overflow:auto;}
.chat-thread-item{display:flex;align-items:stretch;border-bottom:1px solid var(--border);background:var(--surface);}
.chat-thread-item:last-child{border-bottom:none;}
.chat-thread-item.active{background:rgba(85,105,127,.06);}
.chat-thread-main{flex:1;min-width:0;border:none;background:none;text-align:left;padding:9px 10px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;}
.chat-thread-main:hover{background:var(--bg2);}
.chat-thread-item.active .chat-thread-main:hover{background:rgba(85,105,127,.09);}
.chat-thread-name{font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-meta{font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-thread-actions{display:flex;align-items:center;gap:4px;padding:0 8px;border-left:1px solid var(--border);background:rgba(255,255,255,.5);}
.chat-thread-row-btn{border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 7px;font-size:10px;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit;transition:background .15s var(--ease),color .15s var(--ease),border-color .15s var(--ease);}
.chat-thread-row-btn:hover{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-border);}
.chat-thread-delete{width:28px;height:28px;border:1px solid #f0d3d3;border-radius:4px;background:#fff7f7;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b42318;flex-shrink:0;}
.chat-thread-delete:hover{background:#fff0f0;color:#912018;}
.chat-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 16px 16px;display:flex;flex-direction:column;gap:16px;}
.chat-empty{flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;text-align:left;padding:12px 12px 0;gap:12px;}
.chat-empty-intro{display:flex;gap:10px;align-items:flex-start;padding:4px 2px;}
.chat-empty-icon{width:34px;height:34px;background:var(--accent-soft);border:1px solid var(--accent-border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0;}
.chat-empty-copy h3{font-size:16px;font-weight:700;color:var(--text);line-height:1.25;max-width:none;}
.chat-empty-copy p{font-size:12px;color:var(--text3);line-height:1.55;max-width:none;margin-top:4px;}
.chat-empty-sections{display:flex;flex-direction:column;gap:10px;}
.chat-empty-block{border:1px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden;}
.chat-empty-block-title{padding:9px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);background:var(--bg2);}
.chat-empty-suggestions{display:grid;grid-template-columns:1fr;gap:0;width:100%;}
.chat-suggestion{border:none;border-bottom:1px solid var(--border);background:var(--surface);padding:11px 12px;font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;transition:background .15s var(--ease),color .15s var(--ease);}
.chat-suggestion:last-child{border-bottom:none;}
.chat-suggestion:hover{background:var(--accent-soft);color:var(--accent);}
.chat-suggestion-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0;}
.chat-suggestion-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.chat-suggestion-title{font-size:12px;font-weight:600;color:inherit;}
.chat-suggestion-meta{font-size:11px;color:var(--text3);}
.chat-empty-note{padding:10px 12px;font-size:12px;line-height:1.55;color:var(--text2);background:var(--surface);}
.msg-u{display:flex;justify-content:flex-end;}
.msg-u-bubble-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:5px;max-width:88%;}
.msg-u-bubble{background:#2B2C30;color:#fff;border:none;border-radius:16px;padding:9px 14px;font-size:13.5px;line-height:1.5;max-width:84%;}
.msg-a{display:flex;flex-direction:column;gap:8px;}
.msg-a-row{display:flex;align-items:flex-start;gap:8px;}
.msg-a-avatar{width:16px;height:16px;border-radius:4px;background:transparent;color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;margin-top:4px;}
.msg-a-bubble-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:11px;max-width:100%;flex:1;min-width:0;}
.msg-a-bubble{background:transparent;border:none;border-radius:0;padding:0;font-family:var(--answer);font-size:15.5px;line-height:1.65;font-weight:400;font-optical-sizing:auto;color:var(--ink-2);max-width:100%;overflow-wrap:anywhere;}
.msg-a-bubble strong,.cited-answer-body strong{font-weight:600;}
.msg-status-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;margin-bottom:2px;}
.msg-status-left{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-3);}
.msg-status-pill{height:22px;padding:0 10px;border-radius:999px;background:#F2F3F5;font-size:11.5px;color:var(--text-2);display:inline-flex;align-items:center;font-weight:500;}
.msg-actions{display:flex;align-items:center;gap:4px;margin-top:4px;}
.msg-action-btn{background:none;border:none;color:var(--text-4);padding:5px;border-radius:6px;cursor:pointer;display:flex;}
.msg-action-btn:hover{background:var(--hover);color:var(--ink);}
.citation-popover-boundary{position:relative;}
.agent-main .msg-a-bubble-wrap{max-width:min(820px,calc(100% - 40px));}
.agent-main .msg-a-bubble{max-width:min(820px,calc(100% - 40px));}
.agent-main .msg-u-bubble-wrap{max-width:min(720px,72%);}
.chat-usage-meta{font-size:11.5px;line-height:1.4;color:var(--text-5);padding:0 2px;white-space:normal;overflow-wrap:anywhere;}
.inline-cit-wrap{display:inline-flex;align-items:flex-start;position:relative;vertical-align:super;margin-left:4px;}
.inline-cit-anchor{border:none;background:var(--accent-tint);color:var(--accent-on-tint);border-radius:5px;min-width:18px;height:18px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-weight:700;font-size:10px;line-height:1;font-family:var(--sans);box-shadow:none;vertical-align:super;}
.inline-cit-anchor-index{display:block;transform:translateY(-.5px);}
.inline-cit-anchor:hover{background:linear-gradient(180deg,rgba(85,105,127,.03) 0%,rgba(85,105,127,.09) 100%);border-color:rgba(85,105,127,.4);color:var(--accent-hover);box-shadow:0 1px 0 rgba(255,255,255,.95) inset,0 4px 10px rgba(85,105,127,.14);transform:translateY(-1px);}
.inline-cit-anchor.active{background:linear-gradient(180deg,var(--accent) 0%,var(--accent-hover) 100%);border-color:var(--accent-hover);color:#fff;box-shadow:0 8px 18px rgba(85,105,127,.22);}
.inline-cit-anchor:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(85,105,127,.18),0 8px 18px rgba(85,105,127,.18);}
.inline-cit-popover{position:absolute;left:0;top:calc(100% + 10px);z-index:40;min-width:220px;max-width:min(320px,calc(100vw - 80px));box-sizing:border-box;}
.inline-cit-popover::before{content:"";position:absolute;top:-7px;left:18px;width:12px;height:12px;background:#fff;border-left:1px solid var(--accent-border);border-top:1px solid var(--accent-border);transform:rotate(45deg);}
.inline-cit-popover .source-card{box-shadow:var(--sh-float);background:#fff;border-color:var(--accent-border);border-radius:12px;padding:12px 13px;margin-left:0;}
.cited-answer-body{display:flex;flex-direction:column;gap:11px;}
.cited-answer{display:flex;flex-direction:column;gap:14px;}
.cited-answer-body ul,.cited-answer-body ol{margin:0;padding-left:1.4em;}
.cited-answer-p{font-family:var(--answer);font-size:15.5px;line-height:1.65;font-weight:400;font-optical-sizing:auto;color:var(--ink-2);}
.cited-answer-h1,.cited-answer-h2,.cited-answer-h3{font-family:var(--sans);font-weight:600;line-height:1.3;color:inherit;margin-top:4px;display:block;}
.cited-answer-h1{font-size:1.05em;}
.cited-answer-h2{font-size:1em;}
.cited-answer-h3{font-size:.95em;color:var(--text2);}
.cited-answer-list{padding-left:1.4em;display:flex;flex-direction:column;gap:4px;}
.cited-answer-li{font-family:var(--answer);font-size:1.02em;line-height:1.66;font-optical-sizing:auto;color:inherit;}
.sources-label{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}
.sources-row,.cited-sources{display:flex;flex-direction:column;gap:8px;margin-top:2px;}
.source-card{background:var(--fill-2);border:none;border-radius:10px;padding:10px 11px;cursor:pointer;margin-left:26px;transition:background .18s cubic-bezier(0.32,0.72,0,1);}
.source-card:hover{background:#F1F3F6;transform:none;box-shadow:none;}
.source-card-list{margin-left:0;display:flex;align-items:flex-start;gap:10px;text-align:left;width:100%;font:inherit;}
.source-card-num{min-width:18px;height:18px;padding:0 5px;border-radius:5px;flex-shrink:0;margin-top:1px;background:var(--accent-tint);color:var(--accent-on-tint);font-family:var(--sans);font-size:10px;font-weight:700;line-height:18px;text-align:center;}
.source-card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}
.source-card-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
.source-card-file{font-size:11px;font-weight:700;color:#1b1b19;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.source-card-page{font-size:11px;color:var(--text-2);background:transparent;border:none;padding:0;border-radius:0;white-space:nowrap;font-weight:500;}
.source-card-jump{font-size:12px;color:var(--accent);font-weight:700;margin-left:auto;white-space:nowrap;}
.source-card-section{font-size:10px;color:#7a8aa5;margin-bottom:6px;font-weight:600;}
.source-card-note{font-size:11px;color:#6c665d;line-height:1.5;margin-bottom:6px;}
.source-card-text{font-family:var(--serif);font-size:12.5px;color:var(--text-2);line-height:1.55;font-style:italic;}
.source-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--sans);font-size:11.5px;font-weight:500;color:var(--text-3);}
.source-card-meta .source-card-jump{margin-left:auto;}
.chat-thinking{display:flex;align-items:flex-start;gap:8px;padding:8px 0;}
.typing{display:flex;gap:3px;}
.typing span{width:5px;height:5px;background:var(--text3);border-radius:50%;animation:bounce 1.2s infinite;}
.typing span:nth-child(2){animation-delay:.2s;} .typing span:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-4px);}}
@keyframes citHighlight{0%{opacity:1;}70%{opacity:1;}100%{opacity:0;}}
.chat-input-area{padding:12px;border-top:none;background:var(--surface);}
.ctx-chip{background:var(--fill-1);border:none;border-radius:9px;padding:8px 10px;margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--ink);}
.ctx-chip-text{flex:1;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.ctx-chip-x{cursor:pointer;opacity:.6;}
.chat-composer{background:var(--surface);border:none;border-radius:13px;padding:10px;display:flex;flex-direction:column;gap:10px;box-shadow:0 0 0 .5px rgba(20,22,28,.13),0 2px 8px -3px rgba(20,22,28,.12);}
.chat-composer:focus-within{box-shadow:0 0 0 .5px rgba(20,22,28,.18),0 2px 8px -3px rgba(20,22,28,.16);}
.chat-composer textarea{background:none;border:none;outline:none;color:var(--text);font-size:13px;font-family:inherit;resize:none;line-height:1.5;max-height:100px;min-height:22px;}
.chat-composer textarea::placeholder{color:var(--text3);}
.composer-context-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}
.attach-picker-inline{margin-bottom:10px;}
.composer-context-trigger{height:26px;border:none;background:var(--chip);color:var(--text2);border-radius:999px;padding:0 10px;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:650;cursor:pointer;font-family:var(--sans);flex-shrink:0;transition:background .4s cubic-bezier(.32,.72,0,1),color .4s cubic-bezier(.32,.72,0,1),transform .4s cubic-bezier(.32,.72,0,1);}
.composer-context-trigger:hover{background:var(--border);color:var(--ink);}
.composer-context-trigger:active{transform:scale(.98);}
.composer-context-list{display:flex;align-items:center;gap:6px;min-width:0;flex:1;flex-wrap:wrap;}
.composer-context-pill{max-width:100%;display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:var(--surface-soft);box-shadow:inset 0 0 0 .5px rgba(20,22,28,.1);color:var(--text2);font-size:11px;line-height:1.2;font-family:var(--sans);}
.composer-context-pill-btn{cursor:pointer;font-family:inherit;border:none;}
.composer-context-pill-btn:hover{background:var(--accent-soft);color:var(--accent);box-shadow:inset 0 0 0 .5px var(--accent-border);}
.composer-context-pill-text{display:block;min-width:0;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.composer-context-pill-more{background:rgba(20,22,28,.03);color:var(--text3);}
.composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.composer-tools{display:flex;align-items:center;gap:8px;}
.icon-btn{width:32px;height:32px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s var(--ease),color .15s var(--ease),border-color .15s var(--ease);}
.icon-btn:hover{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-border);}
.send-btn{background:var(--text);border-color:var(--text);color:#fff;}
.send-btn:hover{background:var(--accent);border-color:var(--accent);color:#fff;}
.composer-stop-btn{height:32px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;color:#b42318;border-color:#f0d3d3;background:#fff7f7;}
.composer-stop-btn:hover{background:#fff0f0;color:#912018;border-color:#efb5b5;}
.attach-picker{position:relative;}
.attach-menu{position:absolute;left:0;bottom:calc(100% + 8px);width:min(320px,calc(100vw - 48px));z-index:30;padding:0;border:none;background:transparent;box-shadow:none;overflow:visible;animation:attachMenuIn .42s cubic-bezier(.32,.72,0,1) both;}
@keyframes attachMenuIn{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}
.attach-menu-bezel{padding:3px;border-radius:16px;background:rgba(20,22,28,.045);box-shadow:0 22px 48px rgba(20,22,28,.14),0 2px 6px rgba(20,22,28,.04),inset 0 0 0 .5px rgba(20,22,28,.06);}
.attach-menu-core{display:flex;flex-direction:column;gap:11px;padding:13px 12px 11px;border-radius:13px;background:rgba(252,252,253,.94);-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);box-shadow:inset 0 1px 0 rgba(255,255,255,.78);max-height:300px;min-height:0;}
.attach-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0;flex-shrink:0;}
.attach-head-copy{display:flex;flex-direction:column;gap:3px;min-width:0;}
.attach-eyebrow{font-size:10px;font-weight:650;letter-spacing:.16em;text-transform:uppercase;color:var(--text3);font-family:var(--sans);line-height:1;}
.attach-title{margin:0;font-size:14px;font-weight:600;letter-spacing:-.02em;color:var(--ink);font-family:var(--sans);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.attach-meta{flex-shrink:0;margin-top:2px;font-size:11px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--text3);font-family:var(--sans);white-space:nowrap;}
.attach-meta-label{font-weight:500;opacity:.85;}
.attach-modes{display:flex;align-items:center;gap:2px;padding:3px;border-radius:10px;background:rgba(20,22,28,.045);box-shadow:inset 0 0 0 .5px rgba(20,22,28,.05);flex-shrink:0;}
.attach-mode{flex:1;min-width:0;height:26px;border:none;background:transparent;color:var(--text3);font-size:11px;font-weight:600;font-family:var(--sans);letter-spacing:-.01em;cursor:pointer;padding:0 6px;border-radius:7px;transition:background .4s cubic-bezier(.32,.72,0,1),color .4s cubic-bezier(.32,.72,0,1),transform .4s cubic-bezier(.32,.72,0,1),box-shadow .4s cubic-bezier(.32,.72,0,1);}
.attach-mode:hover{color:var(--ink);background:rgba(255,255,255,.55);}
.attach-mode:active{transform:scale(.97);}
.attach-mode.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgba(20,22,28,.06),inset 0 0 0 .5px rgba(20,22,28,.08);}
.attach-list{display:flex;flex-direction:column;gap:2px;overflow:auto;min-height:0;margin:0 -4px;padding:0 4px 2px;}
.attach-item{display:flex;align-items:center;gap:9px;padding:8px 8px;border-radius:9px;cursor:pointer;position:relative;transition:background .35s cubic-bezier(.32,.72,0,1);}
.attach-item:hover{background:rgba(20,22,28,.035);}
.attach-item.is-on{background:rgba(85,105,127,.06);}
.attach-item input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;}
.attach-check{width:15px;height:15px;border-radius:5px;flex-shrink:0;box-shadow:inset 0 0 0 .5px rgba(20,22,28,.18);background:rgba(255,255,255,.9);display:inline-flex;align-items:center;justify-content:center;transition:background .35s cubic-bezier(.32,.72,0,1),box-shadow .35s cubic-bezier(.32,.72,0,1),transform .35s cubic-bezier(.32,.72,0,1);}
.attach-item.is-on .attach-check{background:var(--accent);box-shadow:none;transform:scale(1.02);}
.attach-item.is-on .attach-check::after{content:"";width:3.5px;height:7px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg) translateY(-0.5px);margin-top:-1px;}
.attach-file-icon{flex-shrink:0;color:var(--text3);}
.attach-item.is-on .attach-file-icon{color:var(--accent-on-tint);}
.attach-name{font-size:12.5px;color:var(--ink);line-height:1.3;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--sans);font-weight:500;letter-spacing:-.01em;}
.attach-empty{font-size:12.5px;color:var(--text3);padding:14px 8px;text-align:center;font-family:var(--sans);line-height:1.4;}
.attach-mini-btn{border:none;background:none;color:#666;font-size:11px;font-weight:600;cursor:pointer;padding:2px 4px;border-radius:6px;}
.attach-mini-btn:hover{background:#f3f3f3;}
.model-chip{height:32px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text2);display:flex;align-items:center;gap:6px;padding:0 10px;font-size:11px;font-weight:600;font-family:var(--mono);}
.model-picker{position:relative;}
.model-chip{cursor:pointer;}
.model-menu{position:absolute;left:0;bottom:36px;min-width:190px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:4px;box-shadow:0 10px 22px rgba(0,0,0,.10);z-index:25;}
.model-option{width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:7px 8px;font-size:12px;color:#333;cursor:pointer;font-family:inherit;}
.model-option:hover{background:#f4f4f4;}
.model-option.active{background:var(--text);color:#fff;}
.agent-view{flex:1;display:grid;grid-template-columns:320px minmax(0,1fr);background:var(--bg);overflow:hidden;}
.agent-view.sidebar-collapsed{grid-template-columns:56px minmax(0,1fr);}
.agent-sidebar{background:#fff;border-right:1px solid var(--border);display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.agent-sidebar.collapsed{align-items:stretch;}
.agent-sidebar-head{padding:18px 18px 14px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:12px;}
.agent-sidebar.collapsed .agent-sidebar-head{padding:10px 8px;border-bottom:none;}
.agent-sidebar-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.agent-sidebar.collapsed .agent-sidebar-topbar{flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;}
.agent-sidebar-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.agent-sidebar-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.agent-sidebar-title{font-size:18px;font-weight:700;color:var(--text);letter-spacing:-.02em;}
.agent-sidebar-subtitle{font-size:12px;line-height:1.55;color:var(--text3);}
.agent-sidebar-toggle{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.agent-sidebar-chat-icon{color:var(--text2);}
.agent-sidebar-chat-icon:hover{color:var(--text);}
.agent-context-card{margin:16px 16px 14px;border:1px solid var(--border);border-radius:12px;background:linear-gradient(180deg,#ffffff 0%,#fafcfe 100%);padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset;}
.agent-context-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.agent-context-meta{font-size:11px;color:var(--text3);font-weight:700;}
.agent-context-copy{font-size:12px;line-height:1.6;color:var(--text2);}
.agent-thread-list{flex:1;overflow:auto;padding:4px 12px 12px;display:flex;flex-direction:column;gap:2px;}
.agent-thread-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;padding:0;border-radius:6px;background:transparent;}
.agent-thread-row.active{background:var(--accent-soft);}
.agent-thread-main{width:100%;border:none;background:none;text-align:left;padding:5px 8px;cursor:pointer;font-family:inherit;display:block;border-radius:6px;min-width:0;}
.agent-thread-main:hover{background:var(--bg2);}
.agent-thread-row.active .agent-thread-main{background:transparent;}
.agent-thread-title{display:block;font-size:11px;font-weight:500;color:#47443e;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.agent-thread-row.active .agent-thread-title{color:var(--accent);font-weight:600;}
.thread-compact-delete{width:24px;height:24px;border:none;border-radius:6px;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b42318;flex-shrink:0;}
.thread-compact-delete:hover{background:#fff0f0;color:#912018;}
.thread-compact-delete:focus-visible{outline:2px solid rgba(180,35,24,.2);outline-offset:1px;}
.agent-main{display:flex;flex-direction:column;min-width:0;overflow:hidden;background:var(--bg);}
.agent-main-head{padding:18px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:rgba(255,255,255,.7);backdrop-filter:blur(8px);}
.agent-main-copy{display:flex;flex-direction:column;gap:5px;min-width:0;}
.agent-main-title{font-size:21px;font-weight:700;color:var(--text);letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.agent-main-subtitle{font-size:12px;color:var(--text3);}
.agent-main-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
.agent-root-badge{height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--accent-border);background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;}
.agent-workspace-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);overflow:hidden;}
.agent-workspace-body.has-preview{grid-template-columns:minmax(0,1fr) 5px minmax(0,1fr);}
.agent-conversation-pane{min-width:0;display:flex;flex-direction:column;min-height:0;}
.agent-preview-resize-handle{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;z-index:2;}
.agent-preview-resize-handle:hover .agent-preview-resize-grip,.agent-preview-resize-handle:active .agent-preview-resize-grip{background:var(--accent);}
.agent-preview-resize-grip{position:absolute;top:0;bottom:0;left:1px;width:3px;background:transparent;border-radius:999px;transition:background .12s ease;}
.agent-msgs{flex:1;overflow:auto;padding:22px 22px 18px;display:flex;flex-direction:column;gap:18px;}
.agent-empty{display:flex;flex-direction:column;gap:18px;max-width:960px;}
.agent-empty-hero{display:flex;align-items:flex-start;gap:14px;padding-top:4px;}
.agent-empty-copy{display:flex;flex-direction:column;gap:6px;max-width:760px;}
.agent-empty-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
.agent-empty-copy h2{font-size:30px;line-height:1.08;font-weight:700;letter-spacing:-.03em;color:var(--text);max-width:18ch;}
.agent-empty-copy p{font-size:13px;line-height:1.7;color:var(--text2);max-width:58ch;}
.agent-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-width:900px;}
.agent-quick-chip{border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:14px;text-align:left;display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-family:inherit;transition:transform .15s var(--ease),box-shadow .15s var(--ease),border-color .15s var(--ease);}
.agent-quick-chip:hover{transform:translateY(-1px);box-shadow:var(--shadow-lg);border-color:var(--accent-border);}
.agent-quick-chip.active{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 8px 20px rgba(85,105,127,.10);}
.agent-empty-block{border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow:hidden;max-width:900px;}
.agent-empty-block-title{padding:12px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);background:var(--bg2);}
.agent-empty-note{padding:14px;font-size:13px;line-height:1.65;color:var(--text2);}
.agent-input-area{padding:14px 20px 18px;border-top:1px solid var(--border);background:rgba(255,255,255,.75);}
.agent-composer{border-radius:12px;padding:12px;box-shadow:var(--shadow);}
.agent-tool-row{position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.agent-tool-trigger{height:30px;border:none;background:var(--chip);color:var(--text2);border-radius:999px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s var(--ease);}
.agent-tool-trigger:hover,.agent-tool-trigger.active{background:var(--border);color:var(--text);}
.agent-tool-chip{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 10px;border-radius:999px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);font-size:11px;font-weight:700;line-height:1.2;}
.agent-tool-chip-label{display:inline-flex;align-items:center;gap:6px;}
.agent-tool-chip-clear{width:24px;height:24px;border:none;background:transparent;color:inherit;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.agent-tool-chip-clear:hover{background:rgba(85,105,127,.10);}
.agent-tool-hint{font-size:11px;color:var(--text3);font-weight:700;}
.agent-tool-menu{position:absolute;left:0;bottom:calc(100% + 10px);width:300px;max-width:min(300px,calc(100vw - 48px));max-height:min(420px,calc(100vh - 140px));overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px;box-shadow:var(--shadow-lg);z-index:35;}
.agent-tool-menu-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);padding:2px 4px 8px;}
.agent-tool-menu-list{display:flex;flex-direction:column;gap:4px;}
.agent-tool-option{width:100%;border:none;background:none;border-radius:12px;padding:10px;text-align:left;display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-family:inherit;}
.agent-tool-option:hover{background:#f7f9fc;}
.agent-tool-option.active{background:var(--accent-soft);}
.agent-tool-option-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0;margin-top:1px;}
.agent-tool-option-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}
.agent-tool-option-title{font-size:12px;font-weight:600;color:var(--text);}
.agent-tool-option-meta{font-size:11px;color:var(--text3);}
.agent-msg-tool{display:flex;justify-content:flex-end;}
.agent-msg-tool-chip{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.02em;}
.agent-found-sources{margin:0 0 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow:hidden;box-shadow:var(--shadow);}
.agent-found-sources-head{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface-soft);}
.agent-found-sources-title{font-size:14px;font-weight:700;color:var(--text);}
.agent-found-sources-subtitle{font-size:12px;color:var(--text3);}
.agent-found-sources-list{display:flex;flex-direction:column;}
.agent-found-source-row{padding:16px;border-top:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:var(--surface);}
.agent-found-source-row:first-child{border-top:none;}
.agent-found-source-copy{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1;}
.agent-found-source-title{font-size:14px;font-weight:600;line-height:1.45;color:var(--text);}
.agent-found-source-authors{font-size:12px;color:var(--text3);line-height:1.5;}
.agent-found-source-meta{font-size:12px;color:var(--text3);line-height:1.5;}
.agent-found-source-summary{font-size:12px;color:var(--text2);line-height:1.55;}
.agent-found-source-link{font-size:11px;color:var(--text3);overflow-wrap:anywhere;}
.agent-found-source-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;flex-shrink:0;max-width:240px;}
.agent-found-source-badge{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:999px;background:#eef6ef;border:1px solid rgba(22,101,52,.12);color:#166534;font-size:10px;font-weight:800;white-space:nowrap;}
.paper-result-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;}
.paper-result-btn{height:32px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text2);padding:0 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s var(--ease),color .15s var(--ease),border-color .15s var(--ease);}
.paper-result-btn:hover{background:var(--accent-soft);border-color:var(--accent-border);color:var(--accent);}
.paper-result-btn:disabled{opacity:.55;cursor:not-allowed;}
.paper-result-btn-primary{background:var(--text);color:#fff;border-color:var(--text);}
.paper-result-btn-primary:hover{background:var(--accent);border-color:var(--accent);color:#fff;}
.paper-result-status{font-size:11px;line-height:1.55;}
.paper-result-status.done{color:#166534;}
.paper-result-status.error{color:#b91c1c;}
.paper-result-status.loading{color:var(--accent);}
.agent-preview-drawer{border-left:1px solid var(--border);background:#fff;display:flex;flex-direction:column;min-width:0;min-height:0;}
.agent-preview-head{padding:16px 16px 12px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.agent-preview-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}
.agent-preview-title{font-size:15px;font-weight:600;color:var(--text);line-height:1.4;}
.agent-preview-subtitle{font-size:12px;color:var(--text3);line-height:1.5;}
.agent-preview-toolbar{padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--surface-soft);}
.agent-preview-toolbar-meta{font-size:12px;font-weight:700;color:var(--text2);}
.agent-preview-toolbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.agent-preview-note{margin:12px 16px 0;padding:10px 12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;line-height:1.55;}
.agent-preview-viewer{flex:1;min-height:0;overflow:hidden;display:flex;}
.agent-preview-viewer .pdf-scroll{flex:1;min-height:0;padding:12px;}
.agent-gate{margin:auto;max-width:640px;border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:28px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:16px;align-items:flex-start;}
.agent-gate-copy{display:flex;flex-direction:column;gap:6px;}
.agent-gate-copy h2{font-size:28px;line-height:1.08;font-weight:700;color:var(--text);letter-spacing:-.03em;max-width:18ch;}
.agent-gate-copy p{font-size:13px;line-height:1.7;color:var(--text2);max-width:52ch;}
.agent-gate-actions{display:flex;flex-wrap:wrap;gap:10px;}
.library-view{flex:1;overflow:auto;padding:24px;background:var(--bg);}
.library-view-with-detail{display:flex;gap:14px;overflow:hidden;padding:0;}
.library-view-with-detail .library-main{flex:1;min-width:0;overflow:auto;}
.library-main{min-width:0;}
.lib-detail{width:340px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:14px;display:flex;flex-direction:column;min-height:0;max-height:100%;overflow:hidden;box-shadow:var(--shadow);}
.lib-detail-head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;border-bottom:1px solid #f0eee8;}
.lib-detail-kicker{font-size:13.5px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--ink);}
.lib-detail-scroll{flex:1;overflow:auto;padding:16px 16px 12px;display:flex;flex-direction:column;gap:10px;}
.lib-detail-icon{width:36px;height:36px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;}
.lib-detail-title{font-family:var(--serif);font-size:19px;line-height:1.3;font-weight:600;color:var(--text);letter-spacing:-.01em;margin:0;}
.lib-detail-authors{font-size:13px;line-height:1.45;color:#5f584b;margin:0;}
.lib-detail-status{font-size:12px;color:#8a857c;}
.lib-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-top:6px;}
.lib-detail-field{min-width:0;}
.lib-detail-label{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9a9789;margin-bottom:4px;}
.lib-detail-value{font-size:12px;color:#2b2a26;line-height:1.4;word-break:break-word;}
.lib-detail-value a{color:var(--accent);text-decoration:none;}
.lib-detail-value a:hover{text-decoration:underline;}
.lib-detail-section{margin-top:8px;display:flex;flex-direction:column;gap:8px;}
.lib-detail-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a857c;}
.lib-detail-section-actions{display:flex;gap:6px;}
.lib-detail-bibtex{margin:0;padding:12px;border-radius:10px;background:var(--surface-soft);border:1px solid var(--border);font-family:var(--mono);font-size:11px;line-height:1.45;color:var(--text2);white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;}
.lib-detail-ai-btn{width:100%;justify-content:center;margin-top:4px;}
.lib-detail-error{font-size:12px;color:#dc2626;line-height:1.4;}
.lib-detail-abstract{margin:0;font-family:var(--serif);font-size:13px;line-height:1.6;color:var(--text2);}
.lib-detail-footer{padding:12px 14px 14px;border-top:1px solid #f0eee8;}
.lib-detail-footer .lib-btn{width:100%;justify-content:center;}
.db-file-row.selected{background:var(--accent-soft);}
.db-file-row{cursor:pointer;}
.bibtex-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;}
.bibtex-modal{width:min(640px,100%);max-height:min(80vh,720px);background:#fff;border-radius:18px;border:1px solid var(--border);box-shadow:0 24px 60px rgba(15,23,42,.18);display:flex;flex-direction:column;overflow:hidden;}
.bibtex-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid #f0eee8;}
.bibtex-modal-title{font-size:16px;font-weight:800;color:#171613;}
.bibtex-modal-sub{font-size:12px;color:#8a857c;margin-top:2px;}
.bibtex-modal-body{margin:0;padding:16px;overflow:auto;flex:1;font-family:var(--mono);font-size:12px;line-height:1.5;color:var(--text2);white-space:pre-wrap;background:var(--surface-soft);}
.bibtex-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 16px;border-top:1px solid #f0eee8;}
.bibtex-modal-actions .lib-btn:disabled{opacity:.45;cursor:default;}
@media (max-width:1100px){
  .library-view-with-detail{flex-direction:column;overflow:auto;}
  .lib-detail{width:100%;max-height:480px;}
}
.library-search{margin-bottom:16px;display:flex;flex-direction:column;gap:8px;}
.library-search-field{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:#6b6560;}
.library-search-input{flex:1;border:none;outline:none;font:inherit;font-size:13px;background:transparent;color:#222;}
.library-search-results{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;max-height:240px;overflow-y:auto;}
.library-search-empty{padding:12px 14px;font-size:12px;color:#8f8f8f;}
.library-search-hit{width:100%;display:flex;gap:10px;align-items:flex-start;text-align:left;padding:10px 12px;border:none;border-bottom:1px solid #f2f2f2;background:#fff;cursor:pointer;font-family:inherit;color:inherit;}
.library-search-hit:last-child{border-bottom:none;}
.library-search-hit:hover{background:var(--accent-soft);}
.library-search-hit-body{min-width:0;flex:1;}
.library-search-hit-title{font-size:13px;font-weight:600;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.library-search-hit-meta{font-size:11px;color:#8a857c;margin-top:2px;}
.library-search-hit-snippet{font-size:11px;color:#5f584b;margin-top:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.library-sort{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.library-sort-label{font-size:11px;font-weight:600;color:#8a857c;text-transform:uppercase;letter-spacing:.04em;}
.library-sort-select{height:28px;border:1px solid var(--border);border-radius:7px;background:#fff;font-size:12px;padding:0 8px;font-family:inherit;}
.library-db-biblio .db-head,.library-db-biblio .db-row,.library-db-biblio .db-file-row{grid-template-columns:minmax(240px,2fr) minmax(140px,1.2fr) 72px minmax(120px,1fr) 160px;}
.db-file-title-wrap{display:flex;flex-direction:column;min-width:0;gap:1px;}
.db-file-filename{font-size:10px;color:#9a9789;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;}
.library-title{font-family:var(--serif);font-size:26px;font-weight:600;color:var(--text);letter-spacing:-.01em;}
.library-actions{display:flex;gap:8px;}
.lib-btn{height:36px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:0 14px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit;transition:background .15s var(--ease),border-color .15s var(--ease),color .15s var(--ease);}
.lib-btn:hover{background:var(--bg2);border-color:var(--border2);}
.lib-btn.dark{background:var(--text);color:#fff;border-color:var(--text);}
.lib-btn.dark:hover{background:#000;border-color:#000;}
.library-db{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:var(--shadow);}
.db-head,.db-row{display:grid;grid-template-columns:minmax(280px,1.7fr) 90px 90px 120px 140px;align-items:center;}
.db-head{height:40px;background:#fff;border-bottom:1px solid var(--border);}
.db-h{font-size:11px;color:#8c877d;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:0 12px;}
.db-row{min-height:46px;border-bottom:1px solid #f2f2f2;}
.db-row:last-child{border-bottom:none;}
.db-row.folder{background:var(--fill-2);cursor:pointer;}
.db-row.folder.selected{background:var(--fill-2);}
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
  .library-db-biblio .db-head,.library-db-biblio .db-row,.library-db-biblio .db-file-row{grid-template-columns:minmax(180px,1.6fr) minmax(100px,1fr) 56px minmax(90px,.9fr) 130px;}
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
.welcome-upload{margin-top:14px;height:36px;border-radius:8px;border:none;box-shadow:var(--sh-hairline);background:var(--surface);color:var(--ink);padding:0 14px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:7px;}
.welcome-upload:hover{background:var(--bg2);border-color:var(--border2);}
.ov{position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:2000;display:flex;align-items:center;justify-content:center;}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;width:460px;max-width:90vw;box-shadow:var(--shadow-lg);}
.m-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.m-title{font-size:16px;font-weight:600;letter-spacing:-.01em;}
.m-x{background:none;border:none;color:var(--text3);cursor:pointer;padding:4px;border-radius:5px;}
.dz{border:1.5px dashed var(--border2);border-radius:10px;padding:36px 24px;text-align:center;cursor:pointer;background:var(--surface-soft);transition:border-color .15s var(--ease),background .15s var(--ease);overflow:hidden;min-width:0;}
.dz.drag{border-color:var(--accent);background:var(--accent-soft);}
.dz h3{font-size:14px;font-weight:600;margin-bottom:4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dz p{font-size:12px;color:var(--text3);}
.dz-filename{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fs{margin-top:14px;} .fs label{font-size:11px;font-weight:600;color:var(--text3);display:block;margin-bottom:5px;}
.fs select{width:100%;background:white;border:1px solid var(--border2);border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;}
.m-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
.btn-sec{background:var(--surface);border:1px solid var(--border);color:var(--text2);padding:7px 14px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s var(--ease),border-color .15s var(--ease);}
.btn-sec:hover{background:var(--bg2);border-color:var(--border2);}
.btn-pri{background:var(--text);border:1px solid var(--text);color:#fff;padding:7px 16px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s var(--ease);}
.btn-pri:hover{background:#000;}
.settings-field{margin-bottom:16px;}
.settings-label{display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:6px;}
.settings-input-wrap{display:flex;align-items:center;gap:6px;}
.settings-input{flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;background:var(--surface-soft);color:var(--text);transition:border-color .15s var(--ease),box-shadow .15s var(--ease),background .15s var(--ease);}
.settings-input:focus{outline:none;border-color:var(--accent);background:var(--surface);box-shadow:0 0 0 3px var(--accent-soft);}
.settings-toggle-vis{background:none;border:1px solid var(--border);border-radius:5px;padding:5px 8px;cursor:pointer;font-size:11px;color:#666;font-family:inherit;}
.settings-toggle-vis:hover{background:#f5f5f5;}
.settings-info{font-size:11px;color:#888;line-height:1.55;margin-top:6px;}
.settings-panel{margin-top:10px;border:1px solid var(--border);border-radius:8px;background:#fafafa;padding:10px;display:flex;flex-direction:column;gap:8px;}
.settings-panel-title{font-size:12px;font-weight:700;color:#333;}
.settings-option{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:12px;color:#4f4b45;line-height:1.45;font-weight:500;min-width:0;}
.settings-option input{margin-top:2px;accent-color:var(--accent);flex-shrink:0;width:auto;}
.settings-option span{min-width:0;flex:1;overflow-wrap:anywhere;}
.settings-subfield{display:flex;flex-direction:column;gap:6px;margin-top:2px;min-width:0;width:100%;}
.settings-inline-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.settings-error{margin-top:8px;border:1px solid #f3c4c4;background:#fff5f5;color:#9f1d1d;border-radius:7px;padding:8px 10px;font-size:12px;line-height:1.4;}
.settings-select{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;background:var(--surface-soft);color:var(--text);cursor:pointer;}
.settings-select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);}
.sb-settings-bar{padding:8px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:12px;}
.sb-settings-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.sb-settings-label{flex:1;color:#666;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-settings-gear{background:none;border:none;color:#888;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;}
.sb-settings-gear:hover{background:#f0f0f0;color:#333;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);text-align:center;padding:48px;background:var(--bg);}
.welcome-mark{width:56px;height:56px;border-radius:14px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;color:var(--accent);margin-bottom:18px;}
.welcome-title{font-family:var(--serif);font-size:30px;font-weight:600;letter-spacing:-.01em;color:var(--text);margin:0 0 10px;}
.welcome-sub{font-size:14px;line-height:1.65;max-width:400px;color:var(--text2);}
.thinking-trace{width:100%;margin-bottom:6px;}
.thinking-trace-live{display:flex;flex-direction:column;gap:8px;}
.thinking-trace-summary,.thinking-trace-toggle{display:inline-flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;padding:4px 0;color:#6f7786;font-size:11px;font-weight:600;font-family:inherit;}
.thinking-trace-toggle:hover{color:var(--accent);}
.thinking-trace-summary-icon,.thinking-trace-toggle-icon{font-size:12px;color:#7c3aed;}
.thinking-trace-summary-label{color:#6f7786;}
.thinking-trace-toggle-count{background:#f0f3f8;border:1px solid #e5e9f0;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;color:#6f7786;}
.thinking-trace-chevron{font-size:9px;color:#aaa;}
.thinking-trace-panel{border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow);}
.thinking-trace-panel-scroll{max-height:240px;overflow-y:auto;padding:12px 14px;}
.thinking-trace-steps{display:flex;flex-direction:column;gap:10px;}
.thinking-step{animation:thinkStepIn .2s ease;}
.thinking-step-header{display:flex;align-items:flex-start;gap:8px;padding:0;}
.thinking-step-icon{font-size:11px;color:#aab0bc;line-height:1.5;flex-shrink:0;}
.thinking-step-label{font-size:12px;color:#6f7786;line-height:1.5;word-break:break-word;flex:1;}
.thinking-step-body{font-size:12px;color:var(--text2);line-height:1.6;margin:2px 0 0 18px;white-space:pre-wrap;word-break:break-word;background:var(--surface-soft);border:1px solid var(--border);border-radius:10px;padding:10px 12px;}
.thinking-step-reasoning .thinking-step-icon{color:#7c3aed;}
.thinking-step-reasoning .thinking-step-label{color:#6d28d9;font-style:italic;}
.thinking-step-reasoning .thinking-step-body{background:#faf8ff;}
.thinking-step-search .thinking-step-icon{color:var(--accent);}
.thinking-step-search .thinking-step-label{color:var(--accent-hover);}
.thinking-step-result .thinking-step-icon{color:#16a34a;}
.thinking-step-result .thinking-step-label{color:#4a7c5c;}
@keyframes thinkStepIn{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:translateY(0);}}

/* Quarto library table */
.library-view{flex:1;overflow:hidden;padding:0;background:transparent;display:flex;gap:14px;min-height:0;}
.library-table-card{flex:1;min-width:0;border-radius:11px;background:var(--surface);box-shadow:var(--sh-card);display:flex;flex-direction:column;overflow:hidden;}
.lib-table-head,.lib-table-row{display:grid;grid-template-columns:minmax(0,2.5fr) minmax(0,1.4fr) 62px minmax(0,1.1fr) 74px;gap:10px;padding:0 14px;align-items:center;}
.lib-table-head{height:40px;background:var(--fill-3);box-shadow:inset 0 -.5px 0 var(--hairline);font-size:11.5px;font-weight:600;color:var(--text-3);}
.lib-table-head .col-title{padding-left:18px;}
.lib-folder-group{height:38px;background:var(--fill-2);display:flex;align-items:center;gap:8px;padding:0 14px;}
.lib-folder-group .swatch{width:13px;height:13px;border-radius:4px;background:var(--accent);}
.lib-folder-group .name{font-size:13px;font-weight:600;color:var(--ink);}
.lib-folder-group .meta{font-size:11.5px;color:var(--text-5);margin-left:4px;}
.lib-folder-group .actions{margin-left:auto;display:flex;gap:4px;}
.lib-table-row{height:44px;border-bottom:.5px solid #F0F0F2;cursor:pointer;}
.lib-table-row:hover{background:#F7F8F9;}
.lib-table-row.selected{background:var(--accent-tint);}
.lib-table-row.selected .lib-row-title{font-weight:600;}
.lib-row-title{font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lib-row-file{font-size:11px;color:var(--text-5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lib-row-authors,.lib-row-year{font-size:12.5px;color:var(--text-2);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lib-row-doi{font-size:12.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lib-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:4px;}
.lib-open-chip{height:24px;padding:0 9px;border-radius:7px;border:none;background:var(--fill-1);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--ink-3);}
.lib-open-chip:hover{background:var(--hover);}
.lib-detail{width:328px;border-radius:11px;background:var(--surface);box-shadow:var(--sh-panel);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;}
.lib-detail-head{height:44px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:.5px solid var(--hairline-soft);font-size:13.5px;font-weight:600;}
.lib-detail-title{font-family:var(--serif);font-size:19px;line-height:1.3;color:var(--ink);margin:14px 16px 6px;}
.lib-detail-authors{font-size:12.5px;color:var(--text-2);margin:0 16px 10px;}
.lib-detail-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 12px;}
.lib-chip{height:24px;padding:0 9px;border-radius:7px;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;background:#F2F3F5;color:var(--ink-3);}
.lib-chip.accent{background:var(--accent-tint);color:var(--accent-on-tint);}
.lib-dl{padding:0 16px;display:flex;flex-direction:column;}
.lib-dl-row{display:grid;grid-template-columns:74px 1fr;gap:10px;padding:8px 0;border-bottom:.5px solid #F0F0F2;font-size:12px;}
.lib-dl-row dt{color:var(--text-5);}
.lib-dl-row dd{color:var(--ink-3);margin:0;}
.lib-meta-block{margin:14px 16px;padding:12px;border-radius:10px;background:var(--fill-2);}
.lib-meta-block .extract{color:var(--accent);font-weight:700;font-size:12.5px;background:none;border:none;cursor:pointer;font-family:inherit;padding:0;margin-top:6px;}
.lib-detail-footer{margin-top:auto;padding:12px 16px;display:flex;gap:8px;border-top:.5px solid var(--hairline-soft);}
.lib-detail-footer .primary{flex:1;background:var(--accent);color:#fff;border:none;border-radius:8px;height:34px;font-weight:600;cursor:pointer;font-family:inherit;}
.lib-detail-footer .ghost{background:#F2F3F5;color:var(--ink-3);border:none;border-radius:8px;height:34px;padding:0 12px;font-weight:600;cursor:pointer;font-family:inherit;}

/* Quarto agent */
.agent-view{display:flex;gap:14px;flex:1;min-height:0;padding:0;background:transparent;}
.agent-sidebar{width:214px;min-width:214px;border-radius:11px;background:var(--surface);box-shadow:var(--sh-card);display:flex;flex-direction:column;overflow:hidden;}
.agent-main{flex:1;min-width:0;border-radius:11px;background:var(--surface);box-shadow:var(--sh-card);display:flex;flex-direction:column;overflow:hidden;}
.agent-tool-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:var(--accent-tint);color:var(--accent-on-tint);font-size:11.5px;font-weight:600;margin-bottom:6px;}
.agent-found-source-row{border-radius:10px;background:#fff;box-shadow:var(--sh-hairline);padding:10px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.agent-found-source-actions .save-btn{background:none;border:none;color:var(--accent);font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;}
.agent-found-source-badge{background:#F2F3F5;color:var(--ink-3);border-radius:7px;padding:4px 9px;font-size:11.5px;font-weight:600;}
.thinking-trace{border-radius:11px;background:var(--fill-2);overflow:hidden;}
.thinking-trace-head{height:32px;padding:0 10px;display:flex;align-items:center;gap:8px;cursor:pointer;}
.thinking-step-tile{width:18px;height:18px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.thinking-step-tile.done{background:var(--accent-tint);color:var(--accent-on-tint);}
.thinking-step-tile.pending{background:#F2F3F5;color:var(--text-4);}
.composer-send{width:29px;height:27px;border:none;border-radius:7px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.composer-send:hover{background:var(--accent-hover);}
.composer-send:disabled{opacity:.4;cursor:not-allowed;}
.ann-popover,.explain-popover{border:none;border-radius:11px;box-shadow:var(--sh-float);background:rgba(252,252,253,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);}
.ann-popover-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;}
.ann-popover-btn.primary:hover{background:var(--accent-hover);}
.modal-backdrop{background:rgba(20,22,28,.28);}
.modal{border:none;border-radius:13px;box-shadow:var(--sh-panel);}
.lib-btn.dark,.lib-btn.primary{background:var(--accent);color:#fff;border:none;}
.lib-btn.dark:hover,.lib-btn.primary:hover{background:var(--accent-hover);}


/* Map legacy library table classes to Quarto */
.library-main{flex:1;min-width:0;border-radius:11px;background:var(--surface);box-shadow:var(--sh-card);display:flex;flex-direction:column;overflow:hidden;padding:0;gap:0;}
.library-head{display:none!important;}
.library-title{display:none;}
.library-actions{display:flex;align-items:center;gap:6px;margin-left:auto;}
.library-sort{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:.5px solid var(--hairline-soft);}
.library-sort-label{font-size:11.5px;font-weight:600;color:var(--text-3);}
.library-sort-select{border:none;background:var(--fill-1);border-radius:7px;padding:5px 8px;font-size:12px;font-family:inherit;}
.library-db{flex:1;overflow:auto;}
.db-head{display:grid;grid-template-columns:minmax(0,2.5fr) minmax(0,1.4fr) 62px minmax(0,1.1fr) 74px;gap:10px;padding:0 14px;height:40px;align-items:center;background:#fff;box-shadow:inset 0 -.5px 0 rgba(20,22,28,.10);position:sticky;top:0;z-index:2;}
.db-h{font-size:11.5px;font-weight:600;color:var(--text-3);}
.db-h:first-child,.db-file-indent{padding-left:14px!important;}
.db-row.folder{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:0 14px;height:38px;min-height:38px;max-height:38px;box-sizing:border-box;overflow:hidden;background:var(--fill-2);cursor:pointer;box-shadow:inset 0 -.5px 0 rgba(20,22,28,.08);}
.db-row.folder .db-cell{display:flex;align-items:center;gap:8px;min-width:0;}
.db-row.folder .db-title{font-size:13px;font-weight:600;color:var(--ink);}
.db-file-row{display:grid;grid-template-columns:minmax(0,2.5fr) minmax(0,1.4fr) 62px minmax(0,1.1fr) 74px;gap:10px;padding:0 14px;height:44px;align-items:center;border-bottom:.5px solid #F0F0F2;cursor:pointer;}
.db-file-row:hover{background:#F7F8F9;}
.db-file-row.selected{background:var(--accent-tint);}
.db-file-row .db-cell{display:flex;align-items:center;gap:8px;min-width:0;font-size:12.5px;color:var(--text-2);}
.db-file-indent{padding-left:18px;}
.db-file-title-wrap{display:flex;flex-direction:column;min-width:0;}
.db-file-name{font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.db-file-row.selected .db-file-name{font-weight:600;}
.db-file-filename{font-size:11px;color:var(--text-5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.db-meta{font-size:12.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.db-actions{display:flex;align-items:center;justify-content:flex-end;gap:4px;width:100%;}
.db-open{height:24px;padding:0 9px;border-radius:7px;border:none;background:var(--fill-1);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--ink-3);}
.db-open:hover{background:var(--hover);}
.db-toggle,.lib-icon-btn{background:none;border:none;color:var(--text-3);cursor:pointer;padding:5px;border-radius:6px;display:inline-flex;}
.db-toggle:hover,.lib-icon-btn:hover{background:var(--hover);color:var(--ink);}
.db-chip{font-size:11px;color:var(--text-4);}
.lib-detail-kicker{font-size:13.5px;font-weight:600;color:var(--ink);letter-spacing:0;text-transform:none;}
.lib-detail-scroll{flex:1;overflow:auto;padding-bottom:12px;}
.lib-detail-icon{display:none;}
.lib-detail-ai-btn{margin:0 16px 10px;color:var(--accent)!important;background:transparent!important;border:none!important;font-weight:700!important;padding:0!important;}
.lib-detail-grid{padding:0 16px;display:flex;flex-direction:column;}
.lib-detail-field{display:grid;grid-template-columns:74px 1fr;gap:10px;padding:8px 0;border-bottom:.5px solid #F0F0F2;font-size:12px;}
.lib-detail-label{color:var(--text-5);}
.lib-detail-value{color:var(--ink-3);}
.lib-detail-footer .lib-btn.dark{flex:1;background:var(--accent);color:#fff;border:none;border-radius:8px;height:34px;font-weight:600;}
.agent-found-sources{padding:8px 0;display:flex;flex-direction:column;gap:8px;}
.agent-found-sources-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-4);}
.welcome-screen{flex:1;display:flex;align-items:center;justify-content:center;border-radius:11px;background:var(--surface);box-shadow:var(--sh-card);}

.modal-backdrop{position:fixed;inset:0;background:rgba(20,22,28,.28);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;}
.modal{background:var(--surface);border-radius:13px;box-shadow:var(--sh-panel);padding:22px;max-width:480px;width:100%;border:none;}
.modal h2,.modal-title{font-size:16px;font-weight:600;color:var(--ink);margin:0 0 8px;}
.modal p,.modal-copy{font-size:13px;color:var(--text-2);line-height:1.5;}
.modal input:not([type="checkbox"]):not([type="radio"]),.modal select,.modal textarea{border:none;box-shadow:var(--sh-hairline);border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit;width:100%;background:#fff;color:var(--ink);}

.modal .lib-btn.dark,.modal button.primary{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;font-family:inherit;}
.modal .lib-btn.dark:hover,.modal button.primary:hover{background:var(--accent-hover);}
.paper-result-btn{background:none;border:none;color:var(--accent);font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;padding:4px 0;}
.paper-result-btn:disabled{opacity:.4;cursor:not-allowed;}
.thinking-trace-head{width:100%;height:32px;padding:0 10px;display:flex;align-items:center;gap:8px;cursor:pointer;border:none;background:transparent;font-family:inherit;text-align:left;}
.thinking-trace-panel{padding:4px 10px 12px;}
.thinking-step{padding:6px 0;}
.thinking-step-header{display:flex;align-items:center;gap:8px;}
.thinking-step-label{font-size:12.5px;font-weight:600;color:var(--ink);}
.thinking-step-body{font-size:11.5px;color:var(--text-5);margin:4px 0 0 26px;line-height:1.45;}
.thinking-step-tile{width:18px;height:18px;border-radius:6px;flex-shrink:0;}


/* ===== Quarto spacing lock (match design_handoff 4a/4b/4c) ===== */
.sb-nav{padding:0 10px;gap:1px;}
.sb-section{padding:0 10px 8px;flex:1;overflow-y:auto;}
.sb-section-hd{padding:20px 9px 6px;gap:7px;}
.sb-section-label{font-size:12px;font-weight:600;color:#8A8E96;}
.sb-folder-hd{height:31px;padding:0 9px;gap:10px;border-radius:8px;}
.sb-papers{padding:4px 0 2px 18px;gap:3px;}
.sb-paper{height:30px;padding:0 9px;gap:9px;border-radius:8px;}
.sb-footer{padding:12px 14px;}
.topbar{gap:12px;padding:0 14px;}
.topbar-right{gap:9px;}
.topbar-search.lib-wide{width:210px;height:28px;}
.topbar-btn{height:28px;padding:0 11px;border-radius:8px;font-size:12.5px;}
.topbar-btn.ghost{background:#fff;box-shadow:var(--sh-hairline);}
.topbar-btn.primary{height:28px;}

/* Library: design has ONLY the table card + inspector - no inner action/search/sort chrome */
.library-view{flex:1;overflow:hidden;padding:0;background:transparent;display:flex;gap:14px;min-height:0;width:100%;}
.library-view-with-detail .library-main{flex:1;}
.library-main{flex:1;min-width:0;border-radius:11px;background:var(--surface);box-shadow:var(--sh-card);display:flex;flex-direction:column;overflow:hidden;padding:0;gap:0;}
.library-head,.library-sort,.library-search{display:none!important;}
.library-db,.library-db-biblio{flex:1;overflow:auto;padding:0;margin:0;border-radius:0;box-shadow:none;background:transparent;}
.db-head{height:40px;padding:0 14px;gap:10px;background:#fff;box-shadow:inset 0 -.5px 0 rgba(20,22,28,.10);}
.db-h{font-size:11.5px;font-weight:600;color:var(--text-3);text-transform:none;letter-spacing:0;}
.db-h:first-child,.db-file-indent{padding-left:14px!important;}
.db-row.folder{height:38px;padding:0 14px;gap:10px;background:var(--fill-2);box-shadow:inset 0 -.5px 0 rgba(20,22,28,.08);}
.db-file-row{height:44px;padding:0 14px;gap:10px;border-bottom:.5px solid #F0F0F2;}
.db-file-indent{padding-left:18px!important;}
.db-file-name{font-size:13px;font-weight:500;color:var(--ink);line-height:1.25;}
.db-file-filename{font-size:11px;color:var(--text-5);margin-top:1px;}
.db-meta{font-size:12.5px;color:var(--text-2);}
.db-open{height:26px;padding:0 10px;border-radius:7px;background:transparent;box-shadow:inset 0 0 0 .5px rgba(85,105,127,.35);color:var(--accent);font-size:12px;font-weight:600;}
.db-open:hover{background:var(--accent-tint);}
.db-folder-files{display:flex;flex-direction:column;}
.db-file-row.empty{height:auto;min-height:44px;padding:10px 14px;}

/* Inspector 328px - match design padding */
.lib-detail{width:328px!important;flex-shrink:0;border-radius:11px;background:var(--surface);box-shadow:var(--sh-panel);display:flex;flex-direction:column;overflow:hidden;border:none;}
.lib-detail-head{height:44px;padding:0 14px;flex-shrink:0;}
.lib-detail-scroll{padding:0 0 12px;flex:1;overflow:auto;}
.lib-detail-title{font-family:var(--serif);font-size:19px;font-weight:500;line-height:1.3;color:var(--ink);margin:14px 16px 6px;letter-spacing:-.01em;}
.lib-detail-authors{font-size:12.5px;color:var(--text-2);margin:0 16px 10px;line-height:1.45;}
.lib-detail-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 14px;}
.lib-chip{height:22px;padding:0 9px;border-radius:6px;font-size:11px;font-weight:600;}
.lib-dl{padding:0 16px;}
.lib-dl-row{padding:9px 0;grid-template-columns:74px 1fr;gap:10px;font-size:12px;}
.lib-meta-block{margin:14px 16px;padding:12px 12px;border-radius:10px;background:var(--fill-2);}
.lib-detail-footer{padding:12px 16px;gap:7px;flex-shrink:0;}
.lib-detail-footer .primary{height:34px;border-radius:9px;font-size:13px;}
.lib-detail-footer .ghost{height:34px;padding:0 12px;border-radius:9px;font-size:13px;background:#F2F3F5;}

/* Agent - inset cards, 214px rail, 14px gutters (override old 320px grid) */
.agent-view{display:flex!important;grid-template-columns:unset!important;gap:14px;flex:1;min-height:0;padding:0;background:transparent!important;overflow:hidden;width:100%;}
.agent-view.sidebar-collapsed{grid-template-columns:unset!important;}
.agent-sidebar{width:214px!important;min-width:214px!important;max-width:214px;border-radius:11px;background:var(--surface)!important;box-shadow:var(--sh-card);border:none!important;display:flex;flex-direction:column;overflow:hidden;}
.agent-sidebar.collapsed{width:56px!important;min-width:56px!important;max-width:56px;}
.agent-sidebar-head{padding:14px 12px 10px!important;border-bottom:.5px solid var(--hairline-soft)!important;gap:8px!important;}
.agent-empty-eyebrow,.agent-sidebar-head .agent-empty-eyebrow{font-size:11px!important;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-4)!important;}
.agent-sidebar-title{font-size:12.5px!important;font-weight:600!important;color:var(--ink)!important;letter-spacing:0!important;}
.agent-sidebar-subtitle{font-size:11px!important;color:var(--text-5)!important;line-height:1.4!important;}
.agent-thread-list{padding:6px 8px 10px!important;gap:1px!important;}
.agent-thread-main{padding:8px 9px!important;border-radius:8px;}
.agent-thread-title{font-size:12.5px!important;font-weight:500;color:var(--ink-3)!important;}
.agent-thread-row.active{background:var(--selected)!important;border-radius:8px;}
.agent-thread-row.active .agent-thread-title{color:var(--ink)!important;font-weight:600!important;}
.agent-context-card{margin:8px 10px 12px!important;padding:10px 11px!important;border-radius:10px!important;background:var(--fill-2)!important;border:none!important;box-shadow:none!important;}
.agent-main{flex:1!important;min-width:0;border-radius:11px;background:var(--surface)!important;box-shadow:var(--sh-card);display:flex;flex-direction:column;overflow:hidden;}
.agent-workspace-body{flex:1;min-height:0;display:flex;overflow:hidden;}
.agent-found-sources{padding:4px 0 8px;gap:8px;}
.agent-found-source-row{border-radius:10px;background:#fff;box-shadow:0 0 0 .5px rgba(20,22,28,.11);padding:11px 12px;margin:0;}
.agent-found-source-actions .save-btn,.paper-result-btn{color:var(--accent);font-weight:700;font-size:12.5px;}
.agent-found-source-badge{background:#F2F3F5;border-radius:7px;padding:4px 9px;font-size:11.5px;font-weight:600;color:var(--ink-3);}

/* Chat panel - allow drag-resize via inline width; only soft-constrain size */
.chat-panel{min-width:340px;max-width:min(760px,48vw);flex-shrink:0;}
.chat-msgs{padding:16px 15px!important;gap:16px!important;}
.chat-input-area{padding:0 12px 12px!important;}
.msg-a{gap:11px;}
.msg-a-row{gap:10px;}
.source-card{padding:10px 11px!important;margin-left:0;border-radius:10px;background:var(--fill-2);}
.chat-composer{padding:11px 12px 9px!important;border-radius:13px;gap:11px;}
.chat-resize-handle{width:8px;margin:0 -4px;cursor:col-resize;z-index:5;}

/* Reader desk */
.pdf-scroll{padding:20px 18px 72px!important;}
.viewer{border-radius:11px;}
.reader-shell{gap:14px;}

/* Hide resize handle visual bulk between sidebar and main - keep thin */
.sb-resize-handle{width:0;margin:0;overflow:visible;}
.sb-resize-grip{left:-1px;}

/* ===== Quarto spacing lock v2 ===== */
.library-view-with-detail,.library-view{gap:14px!important;padding:0!important;}
.library-main{overflow:hidden!important;}
.library-db{display:flex;flex-direction:column;}
.db-head,.db-file-row{display:grid!important;grid-template-columns:minmax(0,2.5fr) minmax(0,1.4fr) 62px minmax(0,1.1fr) 74px!important;align-items:center;gap:10px!important;}
.db-row.folder{display:flex!important;}
.db-h:first-child,.db-file-indent{padding-left:18px!important;}
.lib-detail{display:flex!important;}
.chat-head{height:46px!important;padding:0 12px 0 15px!important;}
.msg-sources{display:flex;flex-direction:column;gap:7px;padding-left:26px;}
.msg-a-actions{padding-left:22px;}
.viewer-float-toolbar{height:38px;padding:0 6px;border-radius:11px;bottom:18px;}
.agent-msgs,.agent-workspace-scroll{padding:16px 18px!important;gap:16px;}

/* ===== Quarto spacing lock v3 - agent/chrome ===== */
.agent-main-head{display:none!important;}
.agent-sidebar-head-actions{display:none!important;}
.agent-context-card{order:99;margin-top:auto!important;margin:auto 11px 11px!important;padding:11px!important;border-radius:10px!important;background:var(--fill-2)!important;box-shadow:none!important;border:none!important;}
.agent-context-copy{font-size:11px!important;color:var(--text-3)!important;line-height:1.5!important;margin:0;}
.agent-context-row{display:flex;flex-direction:column;align-items:flex-start;gap:5px;}
.agent-root-badge{font-size:11.5px!important;font-weight:700!important;color:var(--ink)!important;background:transparent!important;padding:0!important;height:auto!important;box-shadow:none!important;}
.agent-context-meta{display:none;}
.agent-sidebar-head{padding:13px 12px 9px!important;border-bottom:none!important;}
.agent-thread-list{padding:0 8px!important;flex:1;overflow:auto;}
.agent-thread-main{padding:8px 9px!important;}
.agent-msgs{padding:16px 20px 14px!important;gap:14px!important;}
.agent-conversation-pane{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;}
.agent-msg-tool-chip{height:22px;padding:0 9px;border-radius:6px;background:var(--accent-tint);color:var(--accent-on-tint);font-size:11px;font-weight:700;display:inline-flex;align-items:center;}
.agent-input-area,.agent-composer-wrap{padding:0 14px 14px!important;}
.library-nf{padding:12px 14px;border-bottom:.5px solid var(--hairline-soft);}
.db-h.sorted{display:inline-flex;align-items:center;gap:4px;color:var(--ink);}
.db-actions{display:flex;align-items:center;gap:4px;justify-content:flex-end;}
.db-cell.db-file-indent{padding-left:18px;}

/* Quarto spacing lock v4 chat header toolbar */
.chat-topbar{height:46px!important;padding:0 10px 0 14px!important;gap:10px!important;}
.chat-topbar-subtitle{display:none!important;}
.chat-topbar-title{font-size:14px!important;font-weight:600!important;letter-spacing:-.01em;}
.chat-topbar-btn{width:28px!important;height:26px!important;padding:0!important;border-radius:6px;align-items:center;justify-content:center;}
.viewer-float-toolbar{background:rgba(252,252,253,.82)!important;-webkit-backdrop-filter:blur(24px)!important;backdrop-filter:blur(24px)!important;box-shadow:var(--sh-float)!important;color:var(--ink)!important;}
.vt-page,.vt-zoom{font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--ink-3);font-weight:600;}
.vt-div{width:.5px;height:18px;background:rgba(20,22,28,.14);margin:0 5px;}
.agent-sidebar-title{display:none!important;}
.agent-sidebar-subtitle{font-size:11.5px!important;color:#9CA0A7!important;line-height:1.45!important;}
.agent-sidebar-toggle{display:none!important;}
.lib-detail-empty{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;color:var(--text-5);font-size:13px;text-align:center;}
.lib-detail-kicker{font-size:13.5px;font-weight:600;letter-spacing:0;text-transform:none!important;color:var(--ink)!important;}
.db-row.folder{display:flex!important;height:38px!important;min-height:38px!important;max-height:38px!important;padding:0 14px!important;box-sizing:border-box!important;overflow:hidden!important;align-items:center!important;justify-content:space-between!important;background:var(--fill-2)!important;box-shadow:inset 0 -.5px 0 rgba(20,22,28,.08);}
.db-row.folder .db-cell{min-width:0;overflow:hidden;}
.db-row.folder.selected{background:var(--fill-2)!important;}
.lib-detail-title{margin:14px 16px 6px!important;font-family:var(--serif)!important;font-size:19px!important;font-weight:500!important;line-height:1.3!important;}

.db-folder-main{display:flex;align-items:center;gap:9px;min-width:0;flex:1;}
.db-folder-actions{display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;}
.db-row.folder .db-folder-swatch{width:13px;height:13px;border-radius:4px;flex-shrink:0;background:var(--accent);}

.library-main .library-db{flex:1;min-height:0;border-radius:0;overflow:auto;background:transparent;box-shadow:none;}
.library-main .db-head{border-radius:0;background:#fff;}
`;

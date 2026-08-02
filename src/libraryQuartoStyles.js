/** Quarto Slate Library (4b) - scoped styles. */
export const LIBRARY_QUARTO_CSS = `
.library-view{
  flex:1;min-width:0;min-height:0;width:100%;
  display:flex;gap:14px;padding:0;overflow:hidden;
  background:transparent;
}
.library-view .library-main{
  flex:1;min-width:0;min-height:0;
  display:flex;flex-direction:column;overflow:hidden;
  border-radius:11px;background:var(--surface);
  box-shadow:var(--sh-card);
  padding:0!important;gap:0;
}
.library-view .library-nf{
  padding:12px 14px;border-bottom:.5px solid var(--hairline-soft);flex-shrink:0;
}
.library-view .library-db{
  flex:1;min-height:0;overflow:auto;margin:0;padding:0!important;
  background:transparent!important;border:none;border-radius:0!important;box-shadow:none!important;
}
.library-view .db-head,
.library-view .db-file-row{
  display:grid;
  grid-template-columns:minmax(0,2.5fr) minmax(0,1.4fr) 62px minmax(0,1.1fr) 74px;
  align-items:center;gap:10px;padding:0 14px;
}
.library-view .db-head{
  height:40px;position:sticky;top:0;z-index:2;
  background:#fff;
  box-shadow:inset 0 -.5px 0 rgba(20,22,28,.10);
  border-radius:0;
}
.library-view .db-h{
  font-size:11.5px;font-weight:600;color:var(--text-3);
  text-transform:none;letter-spacing:0;padding:0;
  display:inline-flex;align-items:center;gap:5px;
  background:none;border:none;font-family:inherit;cursor:pointer;
}
.library-view .db-h:first-child{padding-left:18px;}
.library-view .db-h.sorted{color:var(--ink);}
.library-view .db-row.folder{
  display:flex;align-items:center;justify-content:space-between;gap:9px;
  height:38px;padding:0 14px;box-sizing:border-box;overflow:hidden;
  background:var(--fill-2);
  box-shadow:inset 0 -.5px 0 rgba(20,22,28,.08);
  cursor:pointer;
}
.library-view .db-folder-main{
  display:flex;align-items:center;gap:9px;min-width:0;flex:1;
}
.library-view .db-folder-actions{
  display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;
}
.library-view .db-toggle{
  width:16px;height:16px;padding:0;border:none;background:none;
  color:var(--text-3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
}
.library-view .db-folder-swatch{
  width:13px;height:13px;border-radius:4px;flex-shrink:0;background:var(--accent);
}
.library-view .db-folder-swatch.s2{background:var(--swatch-2,#8B7355);}
.library-view .db-folder-swatch.s3{background:var(--swatch-3,#6B7C6B);}
.library-view .db-title{
  font-size:13px;font-weight:600;color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.library-view .db-folder-main .db-meta{
  font-size:11.5px;color:var(--text-5);flex-shrink:0;
}
.library-view .db-file-row{
  height:44px;border-bottom:.5px solid #F0F0F2;cursor:pointer;
  background:transparent;
}
.library-view .db-file-row:hover{background:#F7F8F9;}
.library-view .db-file-row.selected{background:var(--accent-tint);}
.library-view .db-file-row.selected .db-file-name{font-weight:600;}
.library-view .db-file-row.empty{
  height:auto;min-height:44px;padding:10px 14px;
}
.library-view .db-cell{
  display:flex;align-items:center;gap:9px;min-width:0;
  font-size:12.5px;color:var(--text-2);
}
.library-view .db-file-indent{padding-left:18px;}
.library-view .db-file-title-wrap{
  min-width:0;display:flex;flex-direction:column;gap:1px;
}
.library-view .db-file-name{
  font-size:13px;font-weight:500;color:var(--ink);line-height:1.25;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.library-view .db-file-filename{
  font-size:11px;color:var(--text-5);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.library-view .db-meta{
  font-size:12.5px;color:var(--text-2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-variant-numeric:tabular-nums;
}
.library-view .db-actions{
  display:flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;
}
.library-view .db-open{
  height:22px;padding:0 9px;border-radius:6px;border:none;
  background:#fff;color:var(--ink-3);font-size:11.5px;font-weight:600;
  font-family:inherit;cursor:pointer;
  box-shadow:0 0 0 .5px rgba(20,22,28,.12);
}
.library-view .db-open:hover{background:var(--accent-tint);color:var(--accent);}
.library-view .lib-icon-btn{
  width:24px;height:22px;padding:0;border:none;border-radius:6px;
  background:none;color:var(--text-4);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
}
.library-view .lib-icon-btn:hover{background:var(--hover);color:var(--text-2);}
.library-view .empty-upload-btn{
  height:26px;padding:0 10px;border-radius:7px;border:none;
  background:var(--fill-2);color:var(--accent);font-size:12px;font-weight:600;
  font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
}

.library-view .lib-detail{
  width:328px;flex-shrink:0;min-height:0;
  display:flex;flex-direction:column;overflow:hidden;
  border-radius:11px;background:var(--surface);
  box-shadow:var(--sh-panel);border:none;
}
.library-view .lib-detail-head{
  height:44px;padding:0 14px;flex-shrink:0;
  display:flex;align-items:center;justify-content:space-between;
  border-bottom:.5px solid var(--hairline-soft);
  font-size:13.5px;font-weight:600;color:var(--ink);
}
.library-view .lib-detail-kicker{
  font-size:13.5px;font-weight:600;letter-spacing:0;
  text-transform:none;color:var(--ink);
}
.library-view .lib-detail-scroll{
  flex:1;min-height:0;overflow:auto;padding:0 0 12px;
}
.library-view .lib-detail-empty{
  flex:1;display:flex;align-items:center;justify-content:center;
  padding:24px;color:var(--text-5);font-size:13px;text-align:center;
}
.library-view .lib-detail-title{
  font-family:var(--serif);font-size:19px;font-weight:500;
  line-height:1.3;color:var(--ink);letter-spacing:-.01em;
  margin:14px 16px 6px;
}
.library-view .lib-detail-authors{
  font-size:12.5px;color:var(--text-2);line-height:1.45;
  margin:0 16px 10px;
}
.library-view .lib-detail-chips{
  display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 14px;
}
.library-view .lib-chip{
  height:22px;padding:0 9px;border-radius:6px;
  font-size:11px;font-weight:600;display:inline-flex;align-items:center;
  background:#F2F3F5;color:var(--ink-3);
}
.library-view .lib-chip.accent{
  background:var(--accent-tint);color:var(--accent-on-tint);
}
.library-view .lib-dl{padding:0 16px;margin:0;}
.library-view .lib-dl-row{
  display:grid;grid-template-columns:74px 1fr;gap:10px;
  padding:9px 0;border-bottom:.5px solid #F0F0F2;font-size:12px;
}
.library-view .lib-dl-row dt{color:var(--text-5);font-weight:500;margin:0;}
.library-view .lib-dl-row dd{color:var(--ink-3);margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.library-view .lib-dl-row a{color:var(--accent);text-decoration:none;}
.library-view .lib-meta-block{
  margin:14px 16px;padding:0;background:transparent;
}
.library-view .lib-meta-label{
  font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:#9CA0A7;margin-bottom:7px;
}
.library-view .lib-meta-card{
  border-radius:10px;background:var(--fill-2);padding:11px 12px;
  display:flex;align-items:flex-start;gap:9px;
}
.library-view .lib-meta-card svg{flex-shrink:0;margin-top:1px;color:var(--accent);}
.library-view .lib-meta-copy{min-width:0;display:flex;flex-direction:column;gap:5px;}
.library-view .lib-meta-copy p{
  margin:0;font-size:12px;color:var(--text-2);line-height:1.5;
}
.library-view .lib-meta-block .extract{
  margin:0;height:auto;padding:0;border:none;border-radius:0;
  background:transparent;color:var(--accent);font-size:12px;font-weight:600;
  font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  text-align:left;
}
.library-view .lib-meta-block .extract:hover{background:transparent;text-decoration:underline;}
.library-view .lib-meta-block .extract:disabled{opacity:.45;cursor:not-allowed;text-decoration:none;}
.library-view .lib-detail-error{margin-top:4px;font-size:12px;color:#B42318;}
.library-view .lib-detail-footer{
  padding:12px 16px;gap:7px;flex-shrink:0;
  display:flex;align-items:center;
  border-top:.5px solid var(--hairline-soft);
}
.library-view .lib-detail-footer .primary{
  flex:1;height:34px;border:none;border-radius:9px;
  background:var(--accent);color:#fff;font-size:13px;font-weight:600;
  font-family:inherit;cursor:pointer;
}
.library-view .lib-detail-footer .primary:hover{background:var(--accent-hover);}
.library-view .lib-detail-footer .ghost{
  height:34px;padding:0 12px;border:none;border-radius:9px;
  background:#F2F3F5;color:var(--ink);font-size:13px;font-weight:600;
  font-family:inherit;cursor:pointer;
}
.library-view .lib-detail-footer .ghost:hover{background:#E8EAED;}

@media (max-width:1100px){
  .library-view{flex-direction:column;overflow:auto;}
  .library-view .lib-detail{width:100%;max-height:360px;}
}
`;

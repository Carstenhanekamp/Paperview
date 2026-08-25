import React from 'react';
import { isTauri } from '../platform/runtime';

export default function FolderPermModal({ onCancel, onConfirm }) {
  const nativeDesktop = isTauri();
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={onCancel}>
      <div style={{ background:'#fff',borderRadius:16,padding:36,maxWidth:420,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width:48,height:48,borderRadius:12,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:20 }}>📁</div>
        <div style={{ fontSize:18,fontWeight:800,letterSpacing:'-0.4px',marginBottom:10 }}>Folder access needed</div>
        <p style={{ fontSize:13,color:'#4e4b45',lineHeight:1.7,marginBottom:20,fontWeight:500 }}>
          {nativeDesktop
            ? "macOS will ask you to choose a folder that Paperview may read and update."
            : "To open your PDF folder, your browser will ask you to pick a folder and grant Paperview permission to read and write files in it."}
        </p>
        <ul style={{ fontSize:13,color:'#4e4b45',lineHeight:1.8,paddingLeft:20,marginBottom:24,fontWeight:500 }}>
          <li>Your PDFs are never uploaded — they stay on your machine.</li>
          <li>Paperview only writes one file: <strong>.paperview.json</strong>, which saves your chat history and annotations so they travel with your papers.</li>
          <li>{nativeDesktop ? "Remove a folder from Paperview at any time to stop using it." : "You can revoke access at any time in your browser settings."}</li>
        </ul>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <button
            style={{ background:'none',border:'1.5px solid #ececec',borderRadius:9,padding:'10px 18px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#4e4b45',fontFamily:'inherit' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{ background:'#121212',color:'#fff',border:'none',borderRadius:9,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}
            onClick={onConfirm}
          >
            OK, give access →
          </button>
        </div>
      </div>
    </div>
  );
}

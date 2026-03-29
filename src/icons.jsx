import React from 'react';

export const Ic = ({ size = 16, fill = "none", sw = 1.75, vb = "0 0 24 24", style, children }) => (
  <svg
    width={size}
    height={size}
    viewBox={vb}
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);

export const IFolder = (p) => (
  <Ic {...p}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4.2l1.8 2h6.9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
  </Ic>
);
export const IFolderOpen = (p) => (
  <Ic {...p}>
    <path d="M3.5 8a2 2 0 0 1 2-2h4.2l1.8 2h7.1a2 2 0 0 1 1.95 2.45l-1.3 6a2 2 0 0 1-1.95 1.55H5.7a2 2 0 0 1-1.95-1.55l-1.1-5A2 2 0 0 1 4.6 9h15.1" />
  </Ic>
);
export const IFile = (p) => (
  <Ic {...p}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v5h5" />
    <path d="M9 13h6M9 17h6" />
  </Ic>
);
export const IPlus = (p) => (
  <Ic {...p}>
    <path d="M12 5v14M5 12h14" />
  </Ic>
);
export const ISearch = (p) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.8-3.8" />
  </Ic>
);
export const IUpload = (p) => (
  <Ic {...p}>
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    <path d="M12 4v10" />
    <path d="M8.5 7.5 12 4l3.5 3.5" />
  </Ic>
);
export const IClose = (p) => (
  <Ic {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Ic>
);
export const ICopy = (p) => (
  <Ic {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </Ic>
);
export const IZoomIn = (p) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.8-3.8M11 8v6M8 11h6" />
  </Ic>
);
export const IZoomOut = (p) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.8-3.8M8 11h6" />
  </Ic>
);
export const IPanel = (p) => (
  <Ic {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Ic>
);
export const IGrid = (p) => (
  <Ic {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Ic>
);
export const IFilter = (p) => (
  <Ic {...p}>
    <path d="M4 5h16l-6 7v5l-4 2v-7z" />
  </Ic>
);
export const IShare = (p) => (
  <Ic {...p}>
    <path d="M12 16V4" />
    <path d="M8.5 7.5 12 4l3.5 3.5" />
    <path d="M4 14.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5" />
  </Ic>
);
export const IChat = (p) => (
  <Ic {...p}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  </Ic>
);
export const IMore = (p) => (
  <Ic {...p} sw={2.6}>
    <circle cx="5" cy="12" r="0.8" />
    <circle cx="12" cy="12" r="0.8" />
    <circle cx="19" cy="12" r="0.8" />
  </Ic>
);
export const ILeft = (p) => (
  <Ic {...p}>
    <path d="m15 18-6-6 6-6" />
  </Ic>
);
export const IRight = (p) => (
  <Ic {...p}>
    <path d="m9 18 6-6-6-6" />
  </Ic>
);
export const ISpark = (p) => (
  <Ic {...p}>
    <path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1z" />
  </Ic>
);
export const IPaperclip = (p) => (
  <Ic {...p}>
    <path d="M21.4 11.1 13 19.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3 3 0 1 1 4.2 4.2l-8.5 8.5a1 1 0 0 1-1.4-1.4l7.8-7.8" />
  </Ic>
);
export const IChevronDown = (p) => (
  <Ic {...p}>
    <path d="m6 9 6 6 6-6" />
  </Ic>
);
export const IArrowUp = (p) => (
  <Ic {...p}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </Ic>
);
export const IArrowDown = (p) => (
  <Ic {...p}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Ic>
);
export const IChevronLeftDouble = (p) => (
  <Ic {...p}>
    <path d="m13 17-5-5 5-5M19 17l-5-5 5-5" />
  </Ic>
);
export const IChevronRightDouble = (p) => (
  <Ic {...p}>
    <path d="m11 17 5-5-5-5M5 17l5-5-5-5" />
  </Ic>
);
export const ITrash = (p) => (
  <Ic {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="m6.8 6 1 13a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8l1-13" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Ic>
);
export const IGear = (p) => (
  <Ic {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Ic>
);
export const IEye = (p) => (
  <Ic {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Ic>
);
export const IEyeOff = (p) => (
  <Ic {...p}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </Ic>
);
export const IHighlight = (p) => (
  <Ic {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Ic>
);
export const INotes = (p) => (
  <Ic {...p}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </Ic>
);

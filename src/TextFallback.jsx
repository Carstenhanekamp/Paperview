import React from 'react';

export default function TextFallback({ text }) {
  return (
    <div className="text-fallback" style={{ maxWidth: 780, margin: "0 auto" }}>
      {(text || "")
        .split("\n")
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} style={{ marginBottom: 10, color: "#333", lineHeight: 1.7 }}>
            {line}
          </p>
        ))}
    </div>
  );
}

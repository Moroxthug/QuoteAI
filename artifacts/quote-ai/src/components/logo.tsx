import React from "react";

export function Logo({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/quoteai-logo.png"
      alt="quoteai"
      width={144}
      height={72}
      className={`logo-glow ${className}`}
      style={{ height: 72, width: "auto", objectFit: "contain", ...style }}
    />
  );
}

"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = "ChatGPTに記録をコピー", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // フォールバック
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={className}
      style={
        copied
          ? { backgroundColor: "#1C3A1C", color: "#CAFF4D", border: "1px solid rgba(202,255,77,0.3)" }
          : { backgroundColor: "#2C2C2E", color: "#8E8E93", border: "1px solid rgba(255,255,255,0.08)" }
      }
    >
      {copied ? "✓ コピーしました" : `📋 ${label}`}
    </button>
  );
}

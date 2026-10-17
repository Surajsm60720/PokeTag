"use client";

import { useEffect, useState } from "react";

export function DialogBox({
  text,
  speed = "mid",
  showArrow = false,
  name,
  onSkip,
}: {
  text: string;
  speed?: "slow" | "mid" | "fast" | "instant";
  showArrow?: boolean;
  name?: string;
  onSkip?: () => void;
}) {
  const [shown, setShown] = useState(speed === "instant" ? text : "");

  useEffect(() => {
    if (speed === "instant") {
      setShown(text);
      return;
    }
    setShown("");
    const delay = speed === "slow" ? 55 : speed === "fast" ? 12 : 28;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, delay);
    return () => window.clearInterval(id);
  }, [text, speed]);

  const done = shown.length >= text.length;

  return (
    <div
      className="pixel-panel dialog-box"
      role="status"
      onClick={() => {
        setShown(text);
        onSkip?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "z" || e.key === "Z") {
          setShown(text);
          onSkip?.();
        }
      }}
      tabIndex={0}
    >
      {name ? <div className="dialog-name">{name}</div> : null}
      <p className="dialog-text">
        {shown}
        {showArrow && done ? <span className="dialog-arrow">▼</span> : null}
      </p>
    </div>
  );
}

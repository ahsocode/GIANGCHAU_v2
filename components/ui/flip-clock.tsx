"use client";

import { useEffect, useRef, useState } from "react";

type FlipDigitProps = {
  value: string;
};

function FlipDigit({ value }: FlipDigitProps) {
  const [current, setCurrent] = useState(value);
  const [next, setNext] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const [topValue, setTopValue] = useState(value);
  const timeoutRef = useRef<number | null>(null);
  const topTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === current) return;
    
    // Set số mới vào next
    setNext(value);
    setFlipping(true);
    
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (topTimeoutRef.current) window.clearTimeout(topTimeoutRef.current);
    
    // Sau 250ms (khi top flip đến ngang 90°), cập nhật topValue
    topTimeoutRef.current = window.setTimeout(() => {
      setTopValue(value);
    }, 250);
    
    // Sau animation xong + pause, cập nhật current
    timeoutRef.current = window.setTimeout(() => {
      setCurrent(value);
      setFlipping(false);
    }, 800); // 250ms top + 250ms bottom + 300ms pause
    
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (topTimeoutRef.current) window.clearTimeout(topTimeoutRef.current);
    };
  }, [current, value]);

  return (
    <div className="flip-digit" aria-hidden="true">
      {/* Tấm tĩnh top - hiển thị số mới sau khi top animation xong */}
      <div className="flip-half top">
        <span>{topValue}</span>
      </div>
      
      {/* Tấm tĩnh bottom - hiển thị số mới khi không flip, số hiện tại khi đang flip */}
      <div className="flip-half bottom">
        <span>{flipping ? current : next}</span>
      </div>
      
      {/* Tấm animation top - số cũ lật xuống */}
      <div className={`flip-anim top ${flipping ? "flip" : ""}`}>
        <span>{current}</span>
      </div>
      
      {/* Tấm animation bottom - số mới lật lên */}
      <div className={`flip-anim bottom ${flipping ? "flip" : ""}`}>
        <span>{next}</span>
      </div>
    </div>
  );
}

export function FlipClock({
  hours,
  minutes,
  seconds,
  className,
}: {
  hours: string;
  minutes: string;
  seconds: string;
  className?: string;
}) {
  const digits = [
    hours[0] ?? "0",
    hours[1] ?? "0",
    ":",
    minutes[0] ?? "0",
    minutes[1] ?? "0",
    ":",
    seconds[0] ?? "0",
    seconds[1] ?? "0",
  ];

  return (
    <div className={["flip-clock", className].filter(Boolean).join(" ")} aria-label="Thời gian hiện tại">
      {digits.map((digit, index) =>
        digit === ":" ? (
          <span key={`sep-${index}`} className="flip-separator" aria-hidden="true">
            :
          </span>
        ) : (
          <FlipDigit key={`digit-${index}`} value={digit} />
        )
      )}
    </div>
  );
}

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (value === current) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNext(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlipping(true);

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (topTimeoutRef.current) window.clearTimeout(topTimeoutRef.current);

    topTimeoutRef.current = window.setTimeout(() => {
      setTopValue(value);
    }, 250);

    timeoutRef.current = window.setTimeout(() => {
      setCurrent(value);
      setFlipping(false);
    }, 800);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (topTimeoutRef.current) window.clearTimeout(topTimeoutRef.current);
    };
  }, [current, value]);

  return (
    <div className="flip-digit" aria-hidden="true">
      <div className="flip-half top">
        <span>{topValue}</span>
      </div>
      <div className="flip-half bottom">
        <span>{flipping ? current : next}</span>
      </div>
      <div className={`flip-anim top ${flipping ? "flip" : ""}`}>
        <span>{current}</span>
      </div>
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

"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  value: string;
  height?: number;
  lineColor?: string;
  width?: number;
};

export function Barcode({ value, height = 80, lineColor = "#000", width = 2 }: Props) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value || " ", {
        format: "CODE128",
        lineColor,
        height,
        width,
        displayValue: true,
        fontSize: 12,
        margin: 0,
      });
    } catch (error) {
      console.error("Render barcode error:", error);
    }
  }, [value, height, lineColor, width]);

  return (
    <div className="flex justify-center">
      <svg ref={ref} role="img" aria-label={`Mã vạch ${value}`} />
    </div>
  );
}

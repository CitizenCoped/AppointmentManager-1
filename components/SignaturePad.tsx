"use client";

import { useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

type Props = {
  label: string;
  onChange: (dataUrl: string | null) => void;
};

export default function SignaturePad({ label, onChange }: Props) {
  const ref = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const data = canvas.isEmpty() ? null : canvas.toDataURL("image/png");
      const el = canvas.getCanvas();
      const parent = el.parentElement;
      if (!parent) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      el.width = parent.clientWidth * ratio;
      el.height = 160 * ratio;
      el.getContext("2d")?.scale(ratio, ratio);
      el.style.width = `${parent.clientWidth}px`;
      el.style.height = "160px";
      if (data) {
        canvas.fromDataURL(data);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const emit = () => {
    const canvas = ref.current;
    if (!canvas || canvas.isEmpty()) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    ref.current?.clear();
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="field-label !mb-0">{label}</label>
        <button
          type="button"
          onClick={clear}
          className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--gold)]"
        >
          Clear
        </button>
      </div>
      <div className="sig-box overflow-hidden">
        <SignatureCanvas
          ref={ref}
          penColor="#f6e8ef"
          backgroundColor="#0e0b0f"
          canvasProps={{
            className: "w-full h-[160px] touch-none",
          }}
          onEnd={emit}
        />
      </div>
    </div>
  );
}

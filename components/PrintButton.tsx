"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      data-print
      onClick={() => window.print()}
      className="text-[var(--muted)] hover:text-[var(--gold)]"
    >
      Print
    </button>
  );
}

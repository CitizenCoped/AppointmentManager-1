"use client";

import dynamic from "next/dynamic";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_SECTIONS, smsHref } from "@/lib/contract-terms";

const SignaturePad = dynamic(() => import("@/components/SignaturePad"), {
  ssr: false,
});

export default function ContractForm() {
  const router = useRouter();
  const [masterName, setMasterName] = useState("Marcus");
  const [slaveName, setSlaveName] = useState("Sabrina");
  const [priorName, setPriorName] = useState("Seth");
  const [term, setTerm] = useState("Up to 24 hours");
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [masterAddendum, setMasterAddendum] = useState("");
  const [masterSignature, setMasterSignature] = useState<string | null>(null);
  const [slaveSignature, setSlaveSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sms = useMemo(
    () => smsHref(process.env.NEXT_PUBLIC_SMS_TO || "6198766618"),
    [],
  );

  async function onSeal(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError("Confirm you are 18+ and consent to this training instrument.");
      return;
    }
    if (!masterSignature || !slaveSignature) {
      setError("Both Marcus and Sabrina must sign before sealing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterName,
          slaveName,
          priorName,
          term,
          startDate: startDate || null,
          location: location || null,
          masterAddendum: masterAddendum || null,
          masterSignature,
          slaveSignature,
          agreed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to seal contract");
      }
      router.push(`/certificate/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seal contract");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSeal} className="space-y-5">
      <header className="mb-2">
        <p className="crest mb-2">Marcus · Master / Trainer</p>
        <h1 className="font-serif text-[1.55rem] uppercase tracking-[0.04em] text-[var(--gold)] m-0">
          24-Hour Feminization Training Contract
        </h1>
        <p className="sub mt-2">
          Marcus (Master / Trainer) &amp; Sabrina (formerly Seth). Hardcore
          sissification.
        </p>
      </header>

      <div className="row">
        <div>
          <label className="field-label" htmlFor="masterName">
            Master / Trainer
          </label>
          <input
            id="masterName"
            type="text"
            value={masterName}
            onChange={(e) => setMasterName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="slaveName">
            Slave name
          </label>
          <input
            id="slaveName"
            type="text"
            value={slaveName}
            onChange={(e) => setSlaveName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label className="field-label" htmlFor="priorName">
            Prior / punished name
          </label>
          <input
            id="priorName"
            type="text"
            value={priorName}
            onChange={(e) => setPriorName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="term">
            Term
          </label>
          <input
            id="term"
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label className="field-label" htmlFor="startDate">
            Start date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Training location"
          />
        </div>
      </div>

      {CONTRACT_SECTIONS.map((section) => (
        <section key={section.title} className="pt-1">
          <h2 className="font-serif text-lg text-[var(--gold)] tracking-[0.06em] uppercase m-0 mb-2">
            {section.title}
          </h2>
          <ul className="terms">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <div>
        <label className="field-label" htmlFor="masterAddendum">
          Marcus addendum
        </label>
        <textarea
          id="masterAddendum"
          value={masterAddendum}
          onChange={(e) => setMasterAddendum(e.target.value)}
          placeholder="Additional orders, extensions, and training notes from Marcus…"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SignaturePad
          label="Marcus — Master/Trainer"
          onChange={setMasterSignature}
        />
        <SignaturePad label="Sabrina — Slave" onChange={setSlaveSignature} />
      </div>

      <label className="flex items-start gap-3 text-sm text-[var(--muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 accent-[var(--accent)]"
        />
        <span>
          I am 18+ and consent to this consensual adult role/training
          instrument. This is not a legal transfer of a person.
        </span>
      </label>

      {error ? (
        <p className="text-[var(--accent)] text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="seal" disabled={submitting}>
        {submitting ? "Sealing…" : "Seal Contract"}
      </button>

      <p className="note">
        Consensual adult role/training instrument only. Not a legal transfer of
        a person. 18+.
      </p>

      <a className="sms" href={sms}>
        I request from current owner permission to train Sabrina
      </a>
    </form>
  );
}

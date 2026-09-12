import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getSql, ContractRow } from "@/lib/db";
import { CONTRACT_SECTIONS, smsHref } from "@/lib/contract-terms";
import PrintButton from "@/components/PrintButton";

type Props = {
  params: Promise<{ id: string }>;
};

async function loadContract(id: string): Promise<ContractRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select *
    from contracts
    where id = ${id}
    limit 1
  `) as ContractRow[];
  return rows[0] ?? null;
}

export default async function CertificatePage({ params }: Props) {
  const { id } = await params;
  const contract = await loadContract(id);
  if (!contract) notFound();

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://sissysabrina.vercel.app";
  const certUrl = `${site}/certificate/${contract.id}`;
  const qrDataUrl = await QRCode.toDataURL(certUrl, {
    margin: 1,
    width: 220,
    color: { dark: "#d4af37", light: "#0e0b0f" },
  });
  const sms = smsHref(
    process.env.NEXT_PUBLIC_SMS_TO || process.env.SMS_TO || "6198766618",
  );

  const startDate =
    contract.start_date == null
      ? "—"
      : typeof contract.start_date === "string"
        ? contract.start_date
        : new Date(contract.start_date).toISOString().slice(0, 10);
  const sealedAt = new Date(contract.created_at).toLocaleString();

  const fields: [string, string][] = [
    ["Master / Trainer", contract.master_name],
    ["Slave", contract.slave_name],
    ["Prior name", contract.prior_name],
    ["Term", contract.term],
    ["Start date", startDate],
    ["Location", contract.location || "—"],
    ["Sealed", sealedAt],
    ["Record ID", contract.id],
  ];

  return (
    <main className="wrap">
      <div className="no-print mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/" className="text-[var(--muted)] hover:text-[var(--gold)]">
          ← New contract
        </Link>
        <PrintButton />
      </div>

      <article className="cert-frame">
        <p className="crest">Certificate of Ownership</p>
        <h1 className="font-serif">Certificate of Ownership</h1>
        <p className="sub mx-auto max-w-xl">
          Holder of this document holds training ownership of{" "}
          <strong>{contract.slave_name}</strong> for the term and any extension{" "}
          {contract.master_name} grants.
        </p>

        <dl className="meta-grid">
          {fields.map(([label, value]) => (
            <div className="meta-item" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {contract.master_addendum ? (
          <section className="mb-5 text-left">
            <h2 className="font-serif text-base uppercase tracking-[0.08em] text-[var(--gold)]">
              Marcus addendum
            </h2>
            <p className="whitespace-pre-wrap text-[var(--ink)]">
              {contract.master_addendum}
            </p>
          </section>
        ) : null}

        <section className="mb-5 text-left">
          <h2 className="font-serif text-base uppercase tracking-[0.08em] text-[var(--gold)] mb-2">
            Contract terms
          </h2>
          {CONTRACT_SECTIONS.map((section) => (
            <div key={section.title} className="mb-3">
              <h3 className="m-0 text-sm uppercase tracking-[0.1em] text-[var(--accent)]">
                {section.title}
              </h3>
              <ul className="terms">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <div className="grid gap-4 md:grid-cols-2 text-left mb-5">
          <div>
            <p className="field-label">Marcus — Master/Trainer</p>
            {contract.master_signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contract.master_signature}
                alt="Marcus signature"
                className="sig-img"
              />
            ) : null}
          </div>
          <div>
            <p className="field-label">Sabrina — Slave</p>
            {contract.slave_signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contract.slave_signature}
                alt="Sabrina signature"
                className="sig-img"
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Certificate QR code"
            width={180}
            height={180}
          />
          <p className="note break-all px-2">
            QR →{" "}
            <a href={certUrl} className="text-[var(--gold)]">
              {certUrl}
            </a>
          </p>
        </div>

        <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-[var(--line)] bg-[#0e0b0f] p-3 text-left text-xs text-[var(--muted)] whitespace-pre-wrap">
          {contract.payload}
        </pre>

        <a className="sms" href={sms}>
          I request from current owner permission to train Sabrina
        </a>
      </article>
    </main>
  );
}

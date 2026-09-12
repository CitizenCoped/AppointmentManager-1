import Link from "next/link";
import { getSql, ContractRow } from "@/lib/db";

type Props = {
  searchParams: Promise<{ key?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const { key } = await searchParams;
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return (
      <main className="wrap">
        <div className="card">
          <h1 className="font-serif text-[var(--gold)] uppercase tracking-[0.06em]">
            Admin
          </h1>
          <p className="note">Unauthorized. Pass ?key=ADMIN_KEY</p>
        </div>
      </main>
    );
  }

  const sql = getSql();
  const rows = (await sql`
    select id, master_name, slave_name, prior_name, term, start_date, location, created_at
    from contracts
    order by created_at desc
    limit 100
  `) as Pick<
    ContractRow,
    | "id"
    | "master_name"
    | "slave_name"
    | "prior_name"
    | "term"
    | "start_date"
    | "location"
    | "created_at"
  >[];

  return (
    <main className="wrap">
      <div className="card">
        <h1 className="font-serif text-[var(--gold)] uppercase tracking-[0.06em] mb-4">
          Sealed contracts
        </h1>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-[var(--line)] pb-3">
              <Link
                href={`/certificate/${row.id}`}
                className="text-[var(--gold)] hover:underline"
              >
                {row.slave_name} ← {row.master_name}
              </Link>
              <div className="note">
                {new Date(row.created_at as string | Date).toLocaleString()} ·{" "}
                {row.term} · {row.location || "no location"}
              </div>
            </li>
          ))}
          {rows.length === 0 ? <li className="note">No contracts yet.</li> : null}
        </ul>
      </div>
    </main>
  );
}

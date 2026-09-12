import { NextRequest, NextResponse } from "next/server";
import { getSql, ContractRow } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const sql = getSql();
    const rows = (await sql`
      select *
      from contracts
      where id = ${id}
      limit 1
    `) as ContractRow[];

    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("GET /api/contracts/[id]", err);
    return NextResponse.json({ error: "Unable to load contract." }, { status: 500 });
  }
}

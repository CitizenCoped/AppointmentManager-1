import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { CONTRACT_SECTIONS } from "@/lib/contract-terms";

type Body = {
  masterName?: string;
  slaveName?: string;
  priorName?: string;
  term?: string;
  startDate?: string | null;
  location?: string | null;
  masterAddendum?: string | null;
  masterSignature?: string | null;
  slaveSignature?: string | null;
  agreed?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const masterName = (body.masterName || "Marcus").trim();
    const slaveName = (body.slaveName || "Sabrina").trim();
    const priorName = (body.priorName || "Seth").trim();
    const term = (body.term || "Up to 24 hours").trim();
    const startDate = body.startDate || null;
    const location = body.location?.trim() || null;
    const masterAddendum = body.masterAddendum?.trim() || null;
    const masterSignature = body.masterSignature || null;
    const slaveSignature = body.slaveSignature || null;
    const agreed = Boolean(body.agreed);

    if (!agreed) {
      return NextResponse.json(
        { error: "18+ consent checkbox is required." },
        { status: 400 },
      );
    }
    if (!masterSignature || !slaveSignature) {
      return NextResponse.json(
        { error: "Both signatures are required." },
        { status: 400 },
      );
    }
    if (!masterSignature.startsWith("data:image/") || !slaveSignature.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Signatures must be image data URLs." },
        { status: 400 },
      );
    }

    const payload = JSON.stringify(
      {
        masterName,
        slaveName,
        priorName,
        term,
        startDate,
        location,
        masterAddendum,
        agreed,
        sections: CONTRACT_SECTIONS,
        sealedAt: new Date().toISOString(),
      },
      null,
      2,
    );

    const sql = getSql();
    const rows = await sql`
      insert into contracts (
        master_name,
        slave_name,
        prior_name,
        term,
        start_date,
        location,
        master_addendum,
        master_signature,
        slave_signature,
        agreed,
        payload
      ) values (
        ${masterName},
        ${slaveName},
        ${priorName},
        ${term},
        ${startDate},
        ${location},
        ${masterAddendum},
        ${masterSignature},
        ${slaveSignature},
        ${agreed},
        ${payload}
      )
      returning id
    `;

    const id = rows[0]?.id as string | undefined;
    if (!id) {
      return NextResponse.json(
        { error: "Insert failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("POST /api/contracts", err);
    return NextResponse.json(
      { error: "Unable to save contract." },
      { status: 500 },
    );
  }
}

import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.includes("@")) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { rows: existing } = await sql`select id from users where email = ${normalizedEmail}`;
  if (existing.length > 0) {
    return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await sql`insert into users (email, password_hash) values (${normalizedEmail}, ${passwordHash})`;

  return Response.json({ ok: true });
}

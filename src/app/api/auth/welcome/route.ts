import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, fullName } = (await req.json()) as { email?: string; fullName?: string };

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      return NextResponse.json(
        { error: "SendGrid is not configured. Add SENDGRID_API_KEY and SENDGRID_FROM_EMAIL." },
        { status: 400 },
      );
    }

    sgMail.setApiKey(apiKey);

    await sgMail.send({
      to: email,
      from: fromEmail,
      subject: "Welcome to MyLife",
      text: `Hi ${fullName ?? "there"}, welcome to MyLife. Your story journey starts now.`,
      html: `<p>Hi ${fullName ?? "there"},</p><p>Welcome to <strong>MyLife</strong>. Your story journey starts now.</p><p>Sign in and begin your first chapter.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to send welcome email." }, { status: 500 });
  }
}


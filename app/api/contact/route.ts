import { NextResponse } from "next/server";
import { Resend } from "resend";

type ContactRequest = {
  name: string;
  email: string;
  msg: string;
};

export async function POST(request: Request) {
  const body: ContactRequest = await request.json();
  const { name, email, msg } = body;

  if (!name || !email || !msg) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos requeridos." },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.CONTACT_TO_EMAIL as string,
      subject: `Nuevo mensaje de contacto de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

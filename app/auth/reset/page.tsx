"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth/AuthProvider";
import { authErrorMessage } from "@/app/lib/auth/errors";
import { PASSWORD_MIN } from "@/app/lib/auth/validation";
import { createClient } from "@/app/lib/supabase/client";

type ResetStatus = "idle" | "submitting" | "error";

// Destino del enlace de recuperación: /auth/callback canjea el code y deja
// la sesión iniciada antes de llegar aquí (SPEC 12).
export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [supabase] = useState(createClient);

  const [status, setStatus] = useState<ResetStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pass, setPass] = useState("");
  const [repeat, setRepeat] = useState("");

  const fail = (error: Parameters<typeof authErrorMessage>[0]) => {
    setStatus("error");
    setErrorMsg(authErrorMessage(error));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    if (pass.length < PASSWORD_MIN) return fail({ code: "weak_password" });
    if (pass !== repeat) return fail("password_mismatch");

    setStatus("submitting");
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) return fail(error);
      router.replace("/biblioteca");
    } catch {
      fail(null);
    }
  };

  const submitting = status === "submitting";

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            NUEVA CONTRASEÑA
          </div>
        </div>

        {loading ? null : !user ? (
          <div className="auth-notice slide-in" role="status">
            <div className="auth-notice-title neon-magenta">
              ENLACE INVÁLIDO
            </div>
            <p>
              El enlace es inválido o caducó. Pide uno nuevo desde «¿Olvidaste
              tu contraseña?».
            </p>
            <button
              className="btn"
              type="button"
              style={{ width: "100%" }}
              onClick={() => router.push("/auth")}
            >
              IR A INICIAR SESIÓN
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Contraseña nueva</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Repetir contraseña</label>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 8 }}
            >
              {submitting ? "CONECTANDO…" : "GUARDAR CONTRASEÑA"}
            </button>

            {status === "error" && (
              <div className="auth-error" role="alert">
                {errorMsg}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

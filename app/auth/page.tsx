"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth/AuthProvider";
import { authErrorMessage } from "@/app/lib/auth/errors";
import { PASSWORD_MIN, USERNAME_RE } from "@/app/lib/auth/validation";
import { createClient } from "@/app/lib/supabase/client";

type AuthMode = "in" | "up" | "recover";
type AuthStatus = "idle" | "submitting" | "error" | "check-email";

export default function AuthPage({ searchParams }: PageProps<"/auth">) {
  const { error: errorParam } = use(searchParams);
  const callbackFailed = errorParam === "callback";

  const router = useRouter();
  const { user, loading } = useAuth();
  const [supabase] = useState(createClient);

  const [mode, setMode] = useState<AuthMode>("in");
  const [status, setStatus] = useState<AuthStatus>(
    callbackFailed ? "error" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState(
    callbackFailed ? authErrorMessage("callback") : ""
  );
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");

  // Con sesión, /auth no tiene nada que hacer. Mientras se envía el login la
  // navegación la hace submit(), para no redirigir dos veces.
  useEffect(() => {
    if (!loading && user && status !== "submitting") {
      router.replace("/biblioteca");
    }
  }, [loading, user, status, router]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setStatus("idle");
    setErrorMsg("");
  };

  const fail = (error: Parameters<typeof authErrorMessage>[0]) => {
    setStatus("error");
    setErrorMsg(authErrorMessage(error));
  };

  const signIn = async () => {
    setStatus("submitting");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) return fail(error);
    router.push("/biblioteca");
  };

  const signUp = async () => {
    const name = username.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) return fail("username_invalid");
    if (pass.length < PASSWORD_MIN) return fail({ code: "weak_password" });

    setStatus("submitting");

    // Pre-chequeo para dar un mensaje claro; el trigger cubre la carrera.
    const { data: taken, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name)
      .maybeSingle();
    if (checkError) return fail(checkError);
    if (taken) return fail("username_taken");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: {
        data: { username: name },
        emailRedirectTo: `${location.origin}/auth/callback?next=/biblioteca`,
      },
    });
    if (error) return fail(error);
    // Con la confirmación activada, un email ya registrado no da error:
    // Supabase devuelve un usuario sin identities para no revelarlo.
    if (data.user?.identities?.length === 0) return fail("email_taken");

    setStatus("check-email");
  };

  // Mismo aviso exista o no la cuenta: Supabase no da error por un email
  // desconocido, así que no se revela qué correos están registrados.
  const recover = async () => {
    setStatus("submitting");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
    });
    if (error) return fail(error);
    setStatus("check-email");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    try {
      if (mode === "in") await signIn();
      else if (mode === "up") await signUp();
      else await recover();
    } catch {
      fail(null);
    }
  };

  const submitting = status === "submitting";
  const submitLabel =
    mode === "in"
      ? "ENTRAR AL VAULT"
      : mode === "up"
        ? "CREAR Y JUGAR"
        : "ENVIAR ENLACE";

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
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          {/* «recover» es un sub-modo de INICIAR SESIÓN. */}
          <button
            className={mode !== "up" ? "on" : ""}
            onClick={() => switchMode("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={mode === "up" ? "on" : ""}
            onClick={() => switchMode("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {status === "check-email" ? (
          <div className="auth-notice slide-in" role="status">
            <div className="auth-notice-title neon-cyan">REVISA TU CORREO</div>
            {mode === "recover" ? (
              <p>
                Si el correo existe, te enviamos un enlace para elegir una
                contraseña nueva.
              </p>
            ) : (
              <p>
                Te enviamos un enlace de confirmación a <b>{email.trim()}</b>.
                Ábrelo para activar tu cuenta y entrar al Vault.
              </p>
            )}
            <button
              className="btn"
              type="button"
              style={{ width: "100%" }}
              onClick={() => switchMode("in")}
            >
              VOLVER
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "up" && (
              <div className="field slide-in">
                <label>Usuario</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="px_kai"
                  autoComplete="username"
                />
              </div>
            )}
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
              />
            </div>
            {mode !== "recover" && (
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    mode === "in" ? "current-password" : "new-password"
                  }
                />
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 8 }}
            >
              {submitting ? "CONECTANDO…" : submitLabel}
            </button>

            {mode === "in" && (
              <button
                type="button"
                className="auth-link"
                onClick={() => switchMode("recover")}
              >
                ¿OLVIDASTE TU CONTRASEÑA?
              </button>
            )}
            {mode === "recover" && (
              <button
                type="button"
                className="auth-link"
                onClick={() => switchMode("in")}
              >
                VOLVER
              </button>
            )}

            {status === "error" && (
              <div className="auth-error" role="alert">
                {errorMsg}
              </div>
            )}
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/biblioteca")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          {/* OAuth llega en la SPEC 13. */}
          <button className="btn ghost" type="button" disabled>
            <span>◆ GOOGLE</span>
            <span className="auth-soon">PRÓXIMAMENTE</span>
          </button>
          <button className="btn ghost" type="button" disabled>
            <span>▣ GITHUB</span>
            <span className="auth-soon">PRÓXIMAMENTE</span>
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

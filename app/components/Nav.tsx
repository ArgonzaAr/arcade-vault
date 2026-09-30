"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth/AuthProvider";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const displayName = profile?.username.toUpperCase() ?? "CUENTA";

  const isActive = (
    name: "home" | "biblioteca" | "salon" | "about" | "auth"
  ) => {
    if (name === "home") return pathname === "/";
    if (name === "biblioteca")
      return pathname === "/biblioteca" || pathname.startsWith("/game/");
    if (name === "salon") return pathname === "/hall-of-fame";
    if (name === "about") return pathname === "/about";
    if (name === "auth") return pathname === "/auth";
    return false;
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleSignOut = async () => {
    await signOut();
    go("/");
  };

  return (
    <>
      <nav className="av-nav">
        <div className="logo" onClick={() => go("/")}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </div>
        <div className="links">
          <Link href="/" className={isActive("home") ? "active" : ""}>
            Inicio
          </Link>
          <Link
            href="/biblioteca"
            className={isActive("biblioteca") ? "active" : ""}
          >
            Biblioteca
          </Link>
          <Link
            href="/hall-of-fame"
            className={isActive("salon") ? "active" : ""}
          >
            Salón de la Fama
          </Link>
          <Link href="/about" className={isActive("about") ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {/* Mientras se resuelve la sesión no se muestra ni usuario ni ENTRAR. */}
        {loading ? null : user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {displayName} ▾
          </button>
        ) : (
          <button className="btn auth-btn" onClick={() => go("/auth")}>
            Iniciar Sesión
          </button>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/"
          className={isActive("home") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isActive("biblioteca") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Biblioteca
        </Link>
        <Link
          href="/hall-of-fame"
          className={isActive("salon") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Salón de la Fama
        </Link>
        <Link
          href="/about"
          className={isActive("about") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Acerca de
        </Link>
        {loading ? null : user ? (
          <a
            onClick={handleSignOut}
            className={isActive("auth") ? "active" : ""}
          >
            Cuenta
          </a>
        ) : (
          <Link
            href="/auth"
            className={isActive("auth") ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}

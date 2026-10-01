// Traducción de errores de auth a mensajes de la UI (SPEC 12).

// Casos que no llegan como AuthError de Supabase: se detectan en el cliente
// (validación, pre-chequeo, identities vacío) o vienen en la URL.
export type AuthLocalCode =
  | "email_taken"
  | "username_taken"
  | "username_invalid"
  | "callback"
  | "password_mismatch"
  | "captcha_unavailable";

type AuthErrorLike = { code?: string; message?: string };

const MESSAGES: Record<string, string> = {
  invalid_credentials: "CORREO O CONTRASEÑA INCORRECTOS",
  email_not_confirmed: "CONFIRMA TU CORREO ANTES DE ENTRAR",
  weak_password: "LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES",
  over_email_send_rate_limit: "DEMASIADOS INTENTOS. ESPERA UNOS MINUTOS",
  email_taken: "ESE CORREO YA TIENE CUENTA",
  username_taken: "ESE USUARIO YA EXISTE",
  username_invalid: "USUARIO: 3–10 CARACTERES, LETRAS, NÚMEROS O _",
  callback: "EL ENLACE ES INVÁLIDO O CADUCÓ",
  password_mismatch: "LAS CONTRASEÑAS NO COINCIDEN",
  // Turnstile (SPEC 14): Supabase rechaza el token / el widget no carga.
  captcha_failed: "VERIFICACIÓN ANTI-BOT FALLIDA · INTÉNTALO DE NUEVO",
  captcha_unavailable: "NO SE PUDO CARGAR LA VERIFICACIÓN · RECARGA LA PÁGINA",
};

const FALLBACK = "ALGO FALLÓ. INTÉNTALO DE NUEVO";

// Si el trigger on_auth_user_created falla (username repetido por una carrera
// entre dos registros), Supabase devuelve este mensaje genérico.
const TRIGGER_FAILURE = "Database error saving new user";

export function authErrorMessage(
  error: AuthErrorLike | AuthLocalCode | null | undefined
): string {
  if (!error) return FALLBACK;
  if (typeof error === "string") return MESSAGES[error] ?? FALLBACK;
  if (error.message?.includes(TRIGGER_FAILURE)) return MESSAGES.username_taken;
  return (error.code && MESSAGES[error.code]) || FALLBACK;
}

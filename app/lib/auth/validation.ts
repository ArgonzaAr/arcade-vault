// Reglas de validación en cliente (SPEC 12). Deben coincidir con el check
// profiles_username_format de la BD y con el mínimo configurado en el panel.
export const USERNAME_RE = /^[a-z0-9_]{3,10}$/; // se valida tras lower()
export const PASSWORD_MIN = 8;

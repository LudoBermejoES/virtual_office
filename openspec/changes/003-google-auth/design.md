# Diseño técnico: Google Authentication

## Flujo de login

```
[FE] LoginScene click
   ├─► Google Identity Services (GIS) muestra popup nativo
   │     ├─► usuario acepta
   │     └─► GIS callback con `credential` = ID token JWT
   │
   ├─► fetch POST /api/auth/google { idToken }
   │     │
   │     [BE] /api/auth/google handler
   │       ├─► rateLimit(10/min/ip)
   │       ├─► googleVerifier.verifyIdToken(idToken, audience: GOOGLE_CLIENT_ID)
   │       │     └─► throw si firma inválida o aud incorrecto
   │       ├─► payload = token.getPayload()
   │       ├─► validar:
   │       │     - payload.iss ∈ { accounts.google.com, https://accounts.google.com }
   │       │     - payload.email_verified === true
   │       │     - payload.hd ∈ TEIMAS_DOMAINS  OR  payload.email tiene invitación válida (change 004)
   │       ├─► upsert user (google_sub, email, name, picture)
   │       ├─► si email ∈ ADMIN_EMAILS → role = "admin"
   │       ├─► firmar JWT { sub: user.id, role: user.role, kid: 1 }
   │       └─► set-cookie session=<jwt>
   │
   └─► /me ← cliente verifica sesión y arranca OfficeScene
```

## google-auth-library

```ts
import { OAuth2Client } from "google-auth-library";

export class GoogleVerifier {
  constructor(private clientId: string) {}
  client = new OAuth2Client(this.clientId);
  async verify(idToken: string) {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    return ticket.getPayload();
  }
}
```

`verifyIdToken` valida firma, expiración y audience. **No valida** `hd` ni `email_verified`; eso lo hace nuestro código.

## Validación del payload

```ts
function isAllowedDomain(hd?: string, email?: string, domains: string[]): boolean {
  if (!email) return false;
  if (hd && domains.includes(hd)) return true;
  // si no hay hd, evaluar el dominio del email (cuentas Gmail no tienen hd)
  const dom = email.split("@")[1];
  return domains.includes(dom);
}
```

- Empleados Teimas con Workspace: `payload.hd === "teimas.com"` → permitido.
- Cuenta Gmail personal: no tiene `hd`. Solo se permite si `email` tiene una invitación viva (change `004`).
- Cuenta Workspace de tercero: `hd === "otra.com"` → rechazada salvo invitación.

## Modelo `User`

```ts
type User = {
  id: number;
  google_sub: string;       // id estable de Google, único
  email: string;
  domain: string;           // email.split("@")[1]
  name: string;
  avatar_url: string | null;
  role: "admin" | "member";
  is_invited_external: 0 | 1;
  created_at: string;
};
```

Upsert idempotente por `google_sub`. Si cambia el email (caso raro: cambio de alias en Workspace), se actualiza.

## Sesión JWT

- Algoritmo HS256, secret en `SESSION_SECRET`.
- Claims: `{ sub: userId, role, kid: 1, iat, exp }`.
- TTL: 7 días.
- Cookie: `session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
- En cada request autenticado, si la cookie está a < 24h de expirar, se renueva.

### Rotación de secret

- `SESSION_SECRET` y `SESSION_SECRET_PREVIOUS`. Validación intenta primero el actual, fallback al previous. Rotación operativa cada 90 días.
- `kid` en el JWT prepara para el cambio sin romper sesiones.

## Plugin auth-guard

```ts
fastify.decorate("requireAuth", async (req, reply) => {
  const token = req.cookies.session;
  if (!token) return reply.code(401).send(...);
  try { req.user = verifyJwt(token); }
  catch { return reply.code(401).send(...); }
});
fastify.decorate("requireAdmin", async (req, reply) => {
  await fastify.requireAuth(req, reply);
  if (req.user.role !== "admin") return reply.code(403).send(...);
});
```

Uso por ruta: `fastify.post("/x", { preHandler: fastify.requireAdmin }, ...)`.

## Endpoints

```
POST /api/auth/google          { idToken: string }                → 200 { user } + set-cookie
POST /api/auth/logout                                              → 204 + clear cookie
GET  /api/me                                                       → 200 { user } | 401
```

## Frontend `LoginScene`

- Carga `https://accounts.google.com/gsi/client` (GIS) en HTML overlay.
- Botón estilo arcade `<button id="g-login">PRESS START</button>` con CSS pixel.
- `google.accounts.id.initialize({ client_id, callback })` y `google.accounts.id.prompt()`.
- Callback envía `credential` al backend.
- En éxito: recargar, `BootScene` redirige a `OfficeScene`.

### Por qué GIS y no flujo redirect

- GIS popup mantiene la SPA viva, evita perder estado de Phaser.
- ID token llega en el callback sin redirect.
- Documentación oficial Google recomienda GIS para web apps modernas.

## Migración

No añade tablas (la tabla `users` ya existe desde `001`). Sí añade un seed opcional al boot:

```sql
-- al boot, para cada email en ADMIN_EMAILS y user existente, fijar role='admin'
UPDATE users SET role='admin' WHERE email IN (...) AND role <> 'admin';
```

Se ejecuta tras migraciones. Idempotente.

## Observabilidad

- Login OK → log info `auth.success { domain, role }`.
- Login KO → log warn `auth.rejected { reason }`. Razones: `invalid_token`, `domain_not_allowed`, `email_not_verified`.
- Sentry captura solo errores inesperados (excepciones de la librería), no fallos de autorización.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambio del `iss` de Google | Aceptamos los dos valores conocidos |
| Compromiso de `SESSION_SECRET` | Rotación con `kid`; documentado |
| Token replay tras logout | El logout solo limpia cookie; el JWT sigue válido hasta exp. Mitigación futura: lista de revocación |
| Abuso de `/api/auth/google` | Rate limit 10/min/ip |

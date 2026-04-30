# Propuesta: User Avatars (foto circular)

## Motivación

El usuario quiere que los puestos asignados a una persona se marquen con la fotografía de la persona, mostrada con una máscara circular como template. La foto **por defecto es la de Google** (`picture` del payload del ID token, que ya se persiste en `users.avatar_url` desde el flujo de auth).

## Alcance

**En scope:**
- Cargar dinámicamente la imagen del avatar del backend (URL de Google) en una textura de Phaser por usuario.
- Render circular con `BitmapMask` o `GeometryMask` sobre el cuadrado del puesto.
- Tamaño del avatar = `DESK_SIZE_PX - 8` (40 px con DESK_SIZE_PX=48).
- Fallback con iniciales en círculo de color cuando el avatar no está disponible o falla la carga.
- Caché en memoria por user id para no recargar varias veces.
- Render del avatar tanto en bookings daily como en fixed.
- Tooltip al hover muestra el nombre completo del usuario.

**Fuera de scope:**
- Subir avatar custom (siempre se usa el de Google).
- Editar avatar.
- Indicador de "estado" sobre el avatar (presente/ausente).

## Dominios afectados

`reservas` y `ui-game`.

## Orden y dependencias

Change `011`. Depende de `007-daily-desk-booking` (necesita bookings con `user.avatar_url`). Beneficia a `008` y `009` automáticamente.

## Impacto de seguridad

- URL del avatar ya se persiste desde el login con Google. No se vuelve a tocar el flujo de auth.
- Las URLs de Google (`googleusercontent.com`) sirven con CORS abierto; se cargan directamente desde el cliente sin proxy.
- En caso de URL inválida o 403, fallback a iniciales — sin intentos infinitos.

## Rollback

Trivial: render sin máscara circular (solo el cuadrado). El backend sigue devolviendo `avatar_url`.

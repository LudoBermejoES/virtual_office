# Diseño técnico: User Avatars

## Origen del avatar

El campo `users.avatar_url` se popula durante `POST /api/auth/google` con el claim `picture` del ID token de Google. Cualquier respuesta del backend que incluya un `user` (`PublicUser`) trae también `avatar_url`. Este change consume esa propiedad sin tocarla.

## Render

```
1. Por cada booking en el snapshot, identifica user.avatar_url y user.name.
2. Si la URL no está cacheada como textura Phaser → loader.image(`avatar:${userId}`, url).
3. Una vez cargada, crea Image con setDisplaySize(40, 40) y aplica máscara circular.
4. Posiciona en el centro del cuadrado del desk.
```

Phaser 4:

```ts
function renderAvatar(scene: Phaser.Scene, userId: number, url: string, x: number, y: number) {
  const key = `avatar:${userId}`;
  if (!scene.textures.exists(key)) {
    scene.load.image(key, url);
    scene.load.once(`filecomplete-image-${key}`, () => placeAvatar(scene, key, x, y));
    scene.load.once(`loaderror`, () => placeFallback(scene, x, y, getInitials(name), color));
    scene.load.start();
  } else {
    placeAvatar(scene, key, x, y);
  }
}

function placeAvatar(scene, key, x, y) {
  const photo = scene.add.image(x, y, key).setDisplaySize(40, 40);
  const mask = scene.add.graphics().fillCircle(x, y, 20).setVisible(false);
  photo.setMask(mask.createGeometryMask());
}
```

## Fallback con iniciales

Si la carga del avatar falla (URL caducada, 403, sin red):

```
1. Calcular iniciales: primera letra del nombre + primera de un apellido (si hay).
2. Generar color determinístico a partir del userId con HSL fija (consistencia entre sesiones).
3. Pintar círculo lleno de ese color con las iniciales centradas en blanco con Press Start 2P 12px.
```

## Hover y tooltip

Al pasar el ratón por un avatar:

```
- mostrar tooltip HTML (no Phaser) con el nombre completo
- offset 8 px arriba del cuadrado
- desaparecer en mouseout o pulsar tecla
```

Implementación con `phaser`'s `pointerover`/`pointerout` events que emiten al overlay HTML `#tooltip`.

## Caché

- `scene.textures` actúa como caché.
- Al cambiar de día, los desks que se desocupan no liberan la textura del avatar (puede que el user vuelva a aparecer).
- Si el cache crece > 50 textures, se purga LRU al cambiar de día (medida defensiva, raramente se alcanza).

## CORS

Las URLs `https://lh3.googleusercontent.com/...` sirven con `Access-Control-Allow-Origin: *`. Phaser carga sin issue. Si en el futuro Google cambiara, se introduce un proxy `GET /api/avatars/:userId` que el backend consulta y cachea.

## Avatares en cada estado

- `mine`: avatar (foto del propio user) con borde cian pulsante.
- `occupied`: avatar de otro user con borde rojo.
- `fixed`: avatar del user fijo con icono 📌 superpuesto y borde violeta.
- `free`: sin avatar.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| URL de Google rotada (rara vez) | Fallback iniciales |
| Many bookings → many GETs | HTTP/2 multiplex; caché del navegador y de Phaser |
| Imagen no cuadrada o tamaño raro | `setDisplaySize` fuerza tamaño; máscara recorta |
| Carga lenta produce flash | Mostrar fallback iniciales mientras carga; reemplazar al onload |

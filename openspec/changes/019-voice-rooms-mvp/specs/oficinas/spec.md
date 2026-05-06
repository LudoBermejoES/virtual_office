# Oficinas

## ADDED Requirements

### Requirement: Layer voice_rooms en el TMJ

El parser de bundles Tiled SHALL soportar un object layer adicional llamado `voice_rooms` cuyos rectángulos definen las salas de voz de la oficina.

#### Scenario: Layer voice_rooms presente

- **WHEN** un TMJ subido tiene un objectgroup `voice_rooms` con rectángulos
- **THEN** se parsean junto a `desks` y `zones` en la misma operación de subida

#### Scenario: Layer voice_rooms ausente

- **WHEN** un TMJ no incluye el layer `voice_rooms`
- **THEN** la oficina se crea sin salas de voz y la subida no falla

#### Scenario: Tipo distinto de "voice"

- **WHEN** un objeto declara `properties.kind: "video"` u otro valor distinto de `"voice"`
- **THEN** el objeto se ignora silenciosamente (reservado para futuras salas con otros modos)

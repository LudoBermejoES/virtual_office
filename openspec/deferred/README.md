# Deferred changes

Changes propuestos pero **no implementados** y que se han dejado "en barbecho" indefinidamente.

Diferencia con `archive/`:

- `archive/` → changes **completados** y fusionados a los specs principales. El proyecto vive con esa funcionalidad ya en producción.
- `deferred/` → changes que tenían proposal/design/tasks pero **no se ejecutaron**. Los specs principales NO los reflejan. Están aquí para no perder el trabajo de diseño por si se retoma la idea más adelante.

Para reactivar uno, mueve la carpeta de vuelta a `openspec/changes/<name>/`:

```bash
mv openspec/changes/deferred/<name> openspec/changes/<name>
openspec validate <name> --strict
```

Para cerrar definitivamente sin implementar (descartar la idea), bórralo del repositorio o muévelo a un branch de archivo.

# Retratos y fondo de SpriteCollab

## Fuente

- Sitio visual: <https://sprites.pmdcollab.org/>
- Repositorio: <https://github.com/PMDCollab/SpriteCollab>
- Fondo incorporado: `assets/spritecollab-background.png`

El fondo local evita que la pantalla dependa de una descarga remota en cada arranque. Se renderiza con `cover`, una capa oscura y scanlines para conservar legibilidad.

## URLs de retrato

Para un Pokémon con ID `N`, el cliente intenta:

```text
portrait/NNNN/Happy.png
portrait/NNNN/Normal.png
portrait/NNNN/Sad.png
```

La cadena de resolución del componente es:

```text
Happy:  Happy → Normal → retrato base → PokeAPI
Sad:    Sad   → Normal → retrato base → PokeAPI
Normal: Normal → retrato base → PokeAPI
```

Esto es importante porque no todos los IDs ofrecen todas las expresiones. Usar arte oficial de PokeAPI como primera opción rompe la coherencia visual de la tabla.

## Integridad visual

Si una casilla de referencia se ve distinta:

1. comprobar el ID Dex que aparece en la esquina;
2. comprobar que el ID se rellena a cuatro dígitos en la URL;
3. revisar si existe `Normal.png` aunque falte `Happy.png` o `Sad.png`;
4. dejar que el fallback avance solo si la imagen responde con error;
5. no cambiar manualmente un Pokémon por otro para “parecerse” a una captura.

Los retratos se muestran con `contain`, conservan su proporción y llevan el número Dex en una insignia independiente.


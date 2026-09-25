# Beach Defence

A 3D browser game built with [Three.js](https://threejs.org/). You man a machine gun in a
dune-top bunker while enemy soldiers storm the beach in rubber landing boats.

## Play

```bash
npm install
npm run dev      # then open the printed URL
npm run build    # static build in dist/ (relative paths, works on GitHub Pages)
```

## Controls

| Input | Action |
| --- | --- |
| Mouse | Aim (pointer lock; falls back to cursor aiming if unavailable) |
| Left click / Space | Fire |
| Esc | Pause |

## Rules

- Boats come in waves. Every wave brings more boats that move faster and carry more soldiers.
- Sink a boat (+50, +15 for each soldier still aboard) or shoot soldiers as they wade (+15) or run up the beach (+10).
- Each soldier who reaches the barbed-wire line costs one point of defence line. At zero, the beach is lost.
- Firing heats the barrel. At 100% the gun locks up until it cools down, so fire in bursts.
- Clearing a wave gives a bonus of 100 × the wave number. Your best score is saved in the browser.

## Code layout

- `src/main.js`: renderer, game loop, shooting and hit resolution, game state
- `src/world.js`: terrain, animated ocean, sky, bunker, beach obstacles
- `src/boats.js`, `src/soldiers.js`: enemies
- `src/gun.js`: machine gun model, heat, tracers, muzzle flash
- `src/waves.js`: wave director and difficulty curve
- `src/effects.js`: instanced particle effects (splashes, sand, sparks)
- `src/audio.js`: synthesised WebAudio sound effects
- `src/hud.js`: HUD and menu screens

Add `?debug` to the URL to expose `window.game` for testing.

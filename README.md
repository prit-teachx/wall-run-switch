# Link Twin

Endless **dual-runner** with a neon tether. Control two cubes at once ? one on the **floor**, one on the **ceiling** ? linked by a fixed-length beam. Lane-change moves both. Jump the active twin and the tether yanks its partner.

Offline web game ? **no backend**, no accounts.

## Stack

- **Next.js** (App Router) + React
- Pure TypeScript game engine
- Canvas 2D neon corridor renderer
- Web Audio procedural SFX
- Local high score in `localStorage`

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Change lane | ? ? / A D | Swipe left / right |
| Jump (active twin) | Space / W / ? | Tap or swipe up |
| **Switch active twin** | S / ? / F | Swipe down |
| Pause | P / Esc | Pause button |

## Gameplay

- Two cubes, always linked by a neon tether
- **Active twin** (floor or ceiling) is the one that jumps
- Jumping pulls the partner when the tether goes taut ? use it to clear or dodge
- **Walls** ? change lane (both twins move)
- **Barriers** ? jump the twin on that surface
- **Gaps** ? jump or use the tether pull to clear
- Hit either twin = death
- Score = distance + coins + switch bonuses

## Architecture

```
src/
  app/           # Next.js shell
  components/    # Canvas, HUD
  game/          # constants, segments, engine, renderer
  audio/         # procedural SFX
  storage/       # localStorage
```

## Notes

- No accounts, leaderboard, or network calls
- Clearing site data resets local high score

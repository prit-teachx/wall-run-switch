# Wall Run Switch

Endless **neon wall-run** game. Stick to the **left** or **right** wall, switch height lanes, jump barriers, and **flip across the corridor** to dodge wall-side hazards.

Offline web game ? **no backend**, no accounts. High score stays in `localStorage`.

## Stack

- **Next.js** (App Router) + React
- Pure TypeScript game engine
- Canvas 2D neon corridor renderer
- Web Audio procedural SFX
- Local high score only

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Height up | W / ? | Swipe up |
| Height down | S / ? | Swipe down |
| **Flip wall** | Space / F | Tap |
| Jump | E / Shift | Double-tap or second button (or hold-flip uses Space for flip; jump = swipe toward center optional) |
| Pause | P / Esc | Pause button |

> Jump: **E** or **Shift**. Flip: **Space** / **F** / tap.

## Gameplay

- Auto-run down a neon corridor stuck to one wall
- **Walls** (solid blocks) ? change height lane **or** flip to the other wall
- **Barriers** (low beams) ? jump while on that wall
- **Gaps** ? flip before you fall into the void
- Hazards live on a wall; the opposite wall is often free
- Score = distance + coins + flip bonuses

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

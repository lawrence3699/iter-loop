# iter-loop — Landing Page

A standalone **React 18 + TypeScript + Vite + Tailwind CSS 3.4** landing page.
It lives in `landing/` as its own self-contained app, separate from the
`iter-loop` CLI at the repo root.

## Develop

```bash
cd landing
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the Vite dev server        |
| `npm run build`     | Production build to `dist/`      |
| `npm run preview`   | Preview the production build     |
| `npm run typecheck` | `tsc --noEmit` type check        |

## Structure

```
src/
  components/
    hero/          Section 1 — shader hero, navbar, mobile menu
    about/         Section 2 — studio intro + image grid
    casestudies/   Section 3 — featured work video cards
    ui/            Shared primitives (buttons, badges, icons)
  hooks/           useLondonTime (live London clock)
  data/            site copy + asset URLs
```

## Hero background

The animated hero backdrop uses the [`shaders`](https://www.npmjs.com/package/shaders)
WebGPU library — a nested filter chain of `Swirl → ChromaFlow → FlutedGlass →
FilmGrain`. It renders in any WebGPU/WebGL-capable browser; it will not appear in
headless screenshot tools that don't composite the GPU canvas layer.

Fonts are the system default by design — no web fonts are loaded.

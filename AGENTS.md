This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Web Application (`web/` — Next.js 16 + HeroUI v3)

The web dashboard is a modern desktop-first Next.js 16 (App Router) application located in the `web/` subfolder. It is statically exported and published to GitHub Pages (`https://mylifer.github.io/scan/`). Detailed handover context is in `CLAUDE_CODE_HANDOVER.md`.

### Web Commands
```bash
cd web
npm run dev        # Next.js development server
npm run typecheck  # TypeScript check
npm run lint       # ESLint check
npm test           # Vitest unit tests (10 test files, 35 tests)
npm run build      # Static export build (out/)
```

### Design Standards for Web
- **Typography:** Use only `Geist Sans` with `tabular-nums` for amounts and numbers. No `font-mono`.
- **Badges:** Emojis are deprecated; use `CategoryBadge` (`components/category-badge.tsx`, HeroUI `Chip` with dotColor status dot + 2-letter uppercase monogram). Other badges use HeroUI `Chip`.
- **Tables:** Dark mode row dividers use ultra-soft 2% opacity (`rgba(255, 255, 255, 0.02)`).
- **UI library:** All design components come from **HeroUI v3** (`@heroui/react`, compound API: `Card.Header`, `Modal.Backdrop`, `Table.Content`…; styles via `@import "@heroui/styles"` in `globals.css`). There is no `components/ui/` folder and no shadcn/Radix/sonner — don't reintroduce them. HeroUI has no sidebar: `components/layout/sidebar-shell.tsx` provides it (HeroUI `Drawer` on mobile). Toasts: `toast` from `@heroui/react` (`toast.danger`, not `error`). Docs: https://heroui.com/docs/react
- **Tokens:** HeroUI semantics — `text-muted` = secondary text (old `text-muted-foreground`), `bg-default` = neutral fill, `bg-accent` = turquoise brand, `bg-surface` = cards, `bg-overlay` = popovers, `danger` = destructive. Theme overrides live in `globals.css` (`:root` / `.dark`).
- **Tables:** HeroUI `Table` is React Aria based — every table needs one `Table.Column isRowHeader`, row checkboxes must use `slot="selection"` with `selectionMode` on `Table.Content`, and clickable rows use `onAction`.
- **Cards:** Apple Native Glass / macOS Tahoe frosted glass design (`bg-surface/75 backdrop-blur-xl border-border/80`). HeroUI `Card` gets it by default from the `.card` override in `globals.css` — use `Card` instead of repeating the classes.
- **KDV period:** Receipts sent to the accountant in month M are deducted in M−1; unsent receipts in (current month − 1); never earlier than the receipt's own month. Single source: `fisKdvAyi` / `kdvFisFiltresi` in `src/lib/kdvAy.ts` (shared by mobile and web).
- **Currency:** `formatTL` already returns "₺1.234,56"; never append " TL".
- **e-Fatura:** The UBL KDV fallback lives in `supabase/functions/qnb-efatura/index.ts` (`tutarlariTamamla`); there is no `ublFallback.ts`. "Tümünü Göster" (`fetchAllFaturalar` in `web/src/lib/efatura.ts`) must keep 3-way concurrency, surface failed months/warnings, and never cache incomplete results.
- **Version skew:** Keep `VersionGuard`, `(app)/error.tsx` and the `_next/static` cache step in `deploy-web.yml`; GitHub Pages can't use Next's `deploymentId` protection. In Next 16, `error.tsx` receives `retry` (not `reset`).
- Always run root tests (`npm test -- --run`) and web tests (`cd web && npm test && npm run typecheck`) before committing.

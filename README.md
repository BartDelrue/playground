# JS Playground

A browser-based code playground for teaching JavaScript, Vue and full-stack development,
plus an admin portal for issuing exam keys and reviewing submissions.

Built with Nuxt 4, Monaco, `@vue/repl` and almostnode.

---

## Origins

The split is not mode-against-mode; it is **student code against the admin session**.

| Origin | What runs there | Process |
|---|---|---|
| `play.ctrlaltdelrue.be` | The playground. Three routes: `/` browser, `/vue`, `/node` | none — static |
| `preview.ctrlaltdelrue.be` | Browser-mode student code, and nothing else | none — static |
| `admin.ctrlaltdelrue.be` | Portal, submit endpoint, key and submission store | Nitro node + volume |

**The one rule: the admin session cookie has no `Domain` attribute.** A cookie scoped to
`.ctrlaltdelrue.be` would also be sent to `play` and `preview`, where student code runs,
and anything there could then ride the session. See `apps/admin/nuxt.config.ts`.

Browser-mode previews run on `preview` because blob URLs inherit the origin of the
document that created them — so the shim over there mints them, not the app.

### Why node mode is not on its own origin

almostnode's cross-origin sandbox is `createRuntime({ sandbox })`, and the page it
generates speaks only `init` / `syncFile` / `execute` / `runFile` / `clearCache`. There is
no npm install, no `ServerBridge` and no preview URL in that protocol — all three of which
node mode needs. `createContainer`, which the playground uses, takes `RuntimeOptions` and
has no `sandbox` field at all.

So almostnode's root-scope service worker stays on the `play` origin. This is the same
place it has always been, not a regression, and the consequence is contained: it is
node mode's own origin that it controls. Giving it a `runtime.` origin of its own means
writing our own sandbox host, which is a project rather than a config change.

---

## Layout

```
packages/shared/       raw TypeScript, no build step; both apps transpile it
  hash.ts              share-URL codec (also decodes @vue/repl's zlib form)
  bundler.ts           blob-URL bundler, used by the shim AND by node mode
  preview-protocol.ts  the postMessage contract, with the origin rules in one place
  keys.ts              exam keys and storage-key slugs
  tests.ts             test identifiers: slugify, validate
  stores.ts            Test / Key / Submission store interfaces
  links.ts             what a stored or shared playground link may carry

apps/playground/       Nuxt, ssr:false, no server routes -> prerenders to static
apps/preview/          index.html + one esbuild bundle. Publishes dist/
apps/admin/            Nuxt, ssr:true. The only real process
tools/                 static dev server, almostnode asset copier, hash encode/decode
```

---

## Development

Four processes, one command:

```bash
pnpm install
pnpm dev
```

| Origin | Serves | Process |
|---|---|---|
| `play.localhost:3000` | the playground, all three routes | `nuxt dev`, HMR |
| `admin.localhost:3001` | portal and API | `nuxt dev`, HMR |
| `preview.localhost:3002` | the shim | static server + esbuild watch |

### Use the `*.localhost` hosts, not `localhost:PORT`

Four ports on bare `localhost` gives four correct origins for DOM, storage and
service-worker isolation — but **cookies ignore the port**. A session cookie set by
`localhost:3001` is also sent to `localhost:3000`, so dev would be more permissive than
production and would hide exactly the bug the origin split exists to prevent.

`*.localhost` resolves to loopback in Chrome, Edge and Firefox, and all of them treat it
as a secure context, so service workers register over plain HTTP with no certificates.
Safari does not resolve it and neither does Node, so add the hosts entries
(`C:\Windows\System32\drivers\etc\hosts`, needs an elevated editor):

```
127.0.0.1 play.localhost
127.0.0.1 admin.localhost
127.0.0.1 preview.localhost
```

Both Nuxt apps set `vite.server.allowedHosts: ['.localhost']`. Without it Vite answers
*Blocked request. This host is not allowed.* — it rejects unrecognised `Host` headers
since the host-header CVE.

### Habits worth adopting on day one

- Turn on **Update on reload** under DevTools → Application → Service Workers, or you will
  debug a worker that was replaced twenty minutes ago.
- When you change an origin, unregister the worker on the **old** one. It survives happily
  on a host nothing points at any more.

### Environment

Copy the examples; both are gitignored.

```bash
cp apps/playground/.env.example apps/playground/.env
cp apps/admin/.env.example      apps/admin/.env
```

`NUXT_SESSION_PASSWORD` must be at least 32 characters. `NUXT_ADMIN_PASSWORD` unset means
every login is refused — never that any password works.

---

## Deployment (Coolify)

Four resources; base directory is the **repo root** for all of them, because pnpm installs
the workspace as a whole.

| Resource | Type | Build | Publishes |
|---|---|---|---|
| play | Static | `pnpm i && pnpm build:play` | `apps/playground/.output/public` |
| preview | Static | `pnpm i && pnpm build:preview` | `apps/preview/dist` |
| admin | Application | `pnpm i && pnpm build:admin` | `node .output/server/index.mjs` |

`preview` looks like a folder copy but is not — its bundle comes from
`packages/shared`, so it needs a real install step. The same is true of the almostnode
assets in `play`, which `tools/copy-almostnode-assets.mjs` lifts out of `node_modules` on
postinstall.

### Static Nuxt bakes runtimeConfig at build time

`NUXT_PUBLIC_*` set as **runtime** variables on the `play` container do nothing — the
playground prerenders to static files and there is no server left to read them. They must
be **build-time** variables. Changing a preview or API origin is a rebuild, not a restart.

```
# play (build-time)
NUXT_PUBLIC_PREVIEW_ORIGIN=https://preview.ctrlaltdelrue.be
NUXT_PUBLIC_API_ORIGIN=https://admin.ctrlaltdelrue.be

# admin (runtime)
NUXT_SESSION_PASSWORD=<32+ chars, unique per environment>
NUXT_ADMIN_PASSWORD=<the login>
NUXT_ALLOWED_ORIGINS=https://play.ctrlaltdelrue.be
NUXT_STORAGE_DIR=/data
NUXT_PUBLIC_PLAYGROUND_ORIGIN=https://play.ctrlaltdelrue.be
```

### The volume

Coolify containers are ephemeral. **Mount a persistent volume on `admin` and point
`NUXT_STORAGE_DIR` at it**, or a redeploy erases every submission and you find out during
an exam. A volume protects you from redeploys, not from the host — copy the data off the
box before each exam.

### Other details that matter

- **All three need HTTPS**, including the static ones: service workers refuse to register
  without a secure context. Traefik issues per-domain Let's Encrypt certificates
  automatically, which is fine at this count.
- **Do not give `__sw__.js` a long cache lifetime.** Browsers revalidate worker scripts,
  but a stale worker pinned by an aggressive `Cache-Control` is invisible until someone
  reports that nothing updates. Serve it `no-cache`; hashed assets can stay immutable.
- **Set watch paths per resource**, or every push redeploys all three. Point each at its
  own `apps/*` directory plus `packages/shared`.
- **Deploy `admin` before `play`** the first time: play's build bakes in the API origin.

---

## Storage

Everything belongs to a **test**: one exam or exercise session. Keys are issued for a test
and submissions are filed under it, so a cohort can be listed, exported or archived as a
unit rather than filtered out of one ever-growing pile.

```
<NUXT_STORAGE_DIR>/tests/<testId>/
  test.json                    { id, label, createdAt }
  keys.json                    ExamKey[]
  submissions/<id>.json        one file per submission
```

The identifier is a slug derived from the name the lecturer types ("Webdev examen januari
2027" -> `webdev-examen-januari-2027`), validated by `isValidTestId` at every boundary
because it becomes a directory name. Accents fold to ASCII so one test cannot end up under
two spellings depending on NFC/NFD normalisation.

**Exam keys are unique across all tests, not within one.** A student types six characters
and nothing else, so the key is the only thing available to look up; `find()` scans every
test, and `create()` checks uniqueness globally. That is a handful of small JSON reads per
submission - cheaper at this scale than an index that has to be kept correct, and a
non-issue once this becomes SQLite with a unique column.

File-backed, behind the interfaces in `packages/shared/src/stores.ts` so it can become
SQLite without a caller changing. Ids are opaque - the filename is not the identity, which
is what removed the old check-then-write race where two simultaneous submissions could both
claim the same slot and one would silently overwrite the other.

`apps/admin/server/plugins/migrate.ts` imports both older layouts on first boot - the
pre-workspace one (`data/allowed-keys` plus bare-URL files under `uploads/`) and the flat
one this app wrote before grouping (`keys.json` plus `submissions/`) - into a single
`imported` test, because that is what they are: one real cohort. Sources are renamed to
`*.imported` so it cannot run twice. Imported submissions have an empty `submittedAt`; the
portal shows "unknown (imported)" rather than inventing a date.

Keys are **revoked, never deleted**, so past submissions stay attributable.

## Commands

```bash
pnpm dev            # all four dev processes
pnpm build          # preview + play + admin
pnpm test           # vitest (coverage is opt-in via test:coverage)
pnpm typecheck      # nuxt typecheck, both apps
pnpm lint           # eslint --fix, both apps
```

`typescript` is pinned to 5.9 because `vue-tsc` needs `typescript/lib/tsc`, an export TS 6
removed. That is unrelated to the `typescriptVersion` string in
`VueModeLayout.client.vue`, which selects what the in-browser Volar worker downloads from a
CDN — do not "align" them.

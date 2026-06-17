<script setup lang="ts">
type Mode = 'browser' | 'vue' | 'node'

const mode = (import.meta.env.VITE_PREVIEW_MODE ?? 'browser') as Mode

interface ModeInfo {
  key: Mode
  label: string
  blurb: string
  url: string
}

const MODES: ModeInfo[] = [
  {
    key: 'browser', label: 'Browser', url: '',
    blurb: 'HTML, CSS and JavaScript, bundled to blob URLs and rendered live in a sandboxed frame.'
  },
  {
    key: 'vue', label: 'Vue', url: '',
    blurb: 'Single-file components, compiled in the browser by the official @vue/repl.'
  },
  {
    key: 'node', label: 'Node', url: '',
    blurb: 'A Node-style server with working npm install, run entirely in the browser via almostnode.'
  },
]

interface ModeDetail {
  tagline: string;
  points: string[];
  how: string;
}

const DETAIL: Record<Mode, ModeDetail> = {
  browser: {
    tagline: 'Front-end code, running the instant you type it.',
    points: [
      'Markup and modules are bundled into blob URLs and rendered in a sandboxed iframe on every keystroke.',
      'Files ending in .ts and .tsx are transpiled on the fly — no build step to configure.',
      "Bare imports such as import x from 'lib' resolve straight to esm.sh, with nothing to install.",
      'Logs, thrown errors and unhandled rejections all stream into the console pane.',
    ],
    how: 'There is no server. Each file becomes an ES-module blob URL inside the page and is loaded directly by the preview frame, so what you see is genuine browser execution.',

  },
  vue: {
    tagline: 'Single-file components, rendered live.',
    points: [
      'Full <script setup>, <template> and <style> compilation through @vue/compiler-sfc.',
      'Components mount in an isolated frame and hot-update as you type, with no reload.',
      'Genuine Vue reactivity — refs, computeds and watchers behave exactly as in production.',
      'Pull any npm package straight from the CDN and use it inside your components.',
    ],
    how: '@vue/repl compiles your single-file components in the browser and mounts them into a sandboxed preview frame, recompiling on every edit.',
  },
  node: {
    tagline: 'A real server, without leaving the tab.',
    points: [
      'almostnode runs your server in a Web Worker backed by a virtual filesystem. No container, no VM.',
      'Declare dependencies in package.json and they are fetched and installed in-browser before boot.',
      'Your http.createServer app is served through a service worker at a live, navigable preview URL.',
      'Edit a server file and the process restarts; edit a client file and the preview frame remounts.',
    ],
    how: 'almostnode boots a virtual Node environment and a service worker that routes requests to your in-browser server. Client modules are served as blob URLs so the browser can resolve their imports.',
  },
}

const DISPLAY_MODES = [
  {
    q: 'full',
    name: 'Full',
    desc: 'Default. The whole workspace: file tree, editor, console and live preview — plus a terminal in Node mode.'
  },
  {
    q: 'minimal',
    name: 'Minimal',
    desc: 'Editor and preview side by side, with every bit of chrome stripped away. Ideal for embedding.'
  },
  {q: 'vertical', name: 'Vertical', desc: 'Editor stacked above the preview, splitting top to bottom.'},
]

const current = MODES.find(m => m.key === mode) ?? MODES[0]!
const detail = DETAIL[mode] ?? DETAIL.browser

useHead({
  title: `About · ${current.label} Playground`,
  link: [
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: ''},
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600;700&family=Rubik+Mono+One&display=swap'
    },
  ],
})
</script>

<template>
  <div class="about">
    <header class="hero wrap">
      <h1 class="title">The JS <em>Playground</em></h1>
      <p class="lead">
        A small family of browser-based coding sandboxes for teaching and tinkering. Write code,
        watch it run the instant you type, and share it as a single link.
      </p>

      <ul class="modes">
        <li
            v-for="m in MODES"
            :key="m.key"
            class="mode-card"
            :class="{ here: m.key === mode }"
        >

          <div class="mode-text">
            <h3 class="mode-name">
              {{ m.label }}
              <span v-if="m.key === mode" class="badge caps">you’re here</span>
            </h3>
            <p class="mode-blurb muted">{{ m.blurb }}</p>
          </div>
          <a v-if="m.key !== mode && m.url" :href="m.url" class="mode-link caps">visit →</a>
          <span v-else-if="m.key !== mode" class="mode-link soon caps">link coming soon</span>
          <NuxtLink v-else :to="{name: 'index'}" class="home">Take me there!</NuxtLink>
        </li>
      </ul>
    </header>

    <main>

      <section class="wrap section">
          <h2 class="section-title">
            {{ current.label }} <em>Playground</em>
          </h2>

          <p class="lead">You are currently visiting <em>{{ current.label }} Playground</em>. {{ detail.tagline }}</p>

          <ul class="points">
            <li v-for="p in detail.points" :key="p" class="muted">{{ p }}</li>
          </ul>

          <h3>How it works</h3>
          <p class="lead">{{ detail.how }}</p>
      </section>

      <section class="wrap section">
        <h2 class="section-title">Display modes</h2>
        <p class="lead">
          Add a <code>displaymode</code> query parameter to reshape the workspace — handy for embedding
          a stripped-down view in a slide, an LMS or an iframe.
        </p>

        <dl class="display-modes">
          <div v-for="dm in DISPLAY_MODES" :key="dm.q" class="dm">
            <dt>
              <code>?displaymode={{ dm.q }}</code>
            </dt>
            <dd class="muted">{{ dm.desc }}</dd>
          </div>
        </dl>
      </section>

      <section class="wrap section">
        <h2 class="section-title">Evaluation mode</h2>
        <p class="lead">For exams, the playground doubles as a hand-in tool.</p>

        <div class="exam">
          <ol class="exam-steps">
            <li>Open the playground with an <code>?key=</code> parameter. A <strong>Submit</strong> panel appears in the
              sidebar.
            </li>
            <li>The student enters their personal <strong>exam key</strong> and presses send.</li>
            <li>The current URL — with all open files serialised into its hash — is posted to <code>/api/submit</code>.
            </li>
            <li>The server checks the key against the allow-list and stores the URL under the student’s name, ready for
              the examiner to reopen.
            </li>
          </ol>
          <p class="exam-note muted">
            Keys are never trusted blindly: an unknown key is rejected, and repeat submissions are kept
            side by side rather than overwritten.
          </p>
        </div>

        <NuxtLink :to="{name: 'index'}" class="home">&larr; Back to the playground</NuxtLink>
      </section>
    </main>
    <footer class="wrap project">
      <p class="colophon caps muted">Built and maintained by <a href="https://bartdelrue.github.io">Bart Delrue</a> for <a
          href="https://odisee.be/ELOICT">Odisee - ELOICT</a>.</p>
    </footer>
  </div>


</template>

<style scoped>
.about {
  --bg: var(--base);
  --fg: oklch(95% 0.03 145);
  --mint: var(--green);
  --coral: var(--red);

  --muted: var(--text);
  --surface: var(--surface0);
  --surface-2: var(--surface1);
  --line: color-mix(in oklab, var(--fg) 16%, transparent);

  container-type: inline-size;
  block-size: 100dvb;
  overflow-y: auto;
  color: var(--fg);
  font-size: 1.2rem;
  line-height: 1.65;
  padding-block-start: 8rem;
}

p {
  max-width: 70ch;
}

a {
  color: var(--mint);
}

code {
  font-family: ui-monospace, "Cascadia Code", "Consolas", monospace;
  padding: 0.15em 0.5em;
  border-radius: 0.4em;
  color: var(--mint);
  background-color: var(--surface-2);
  font-size: 1rem;
}

.title em,
.section-title em {
  font-style: normal;
  font-weight: 700;
}

.wrap {
  max-inline-size: 90rem;
  margin-inline: auto;
  padding-inline: clamp(1.25rem, 5vw, 2.5rem);
}

.caps {
  font-variant: all-petite-caps;
  letter-spacing: 0.1em;
}

.muted {
  color: var(--muted);
}

.home {
  display: block;
  margin-block-start: 8rem;
}

.hero {
  padding-block: clamp(2.5rem, 8vh, 5.5rem) clamp(2rem, 6vh, 4rem);
}

.title {
  margin-block-start: 0.4rem;
  font-size: clamp(2.75rem, 9cqi, 5rem);
  font-weight: 300;
  line-height: 0.98;
  letter-spacing: -0.01em;

  em {
    position: relative;
    isolation: isolate;

    &::after {
      content: "";
      position: absolute;
      inset: -0.05em -0.1em;
      background-color: var(--mint);
      filter: blur(0.8em);
      opacity: 0.28;
      z-index: -1;
    }
  }
}

.lead {
  margin-block-start: 1rem;
  font-weight: 300;
}

.hero .lead {
  margin-block-start: 3.5rem;
}

.section,
.project {
  padding-block: clamp(2.5rem, 7vh, 4.5rem);
  border-block-start: 1px solid var(--line);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-block-start: 0.4rem;
  font-size: clamp(1.75rem, 5cqi, 2.6rem);
  font-weight: 300;
  line-height: 1.05;
}

.modes {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  margin-block: 8rem 4rem;
  list-style: none;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  padding: 1.25rem 1.4rem;
  border: 1px solid var(--line);
  background-color: var(--surface);
  transition: border-color 0.25s ease, background-color 0.25s ease;
  max-inline-size: 40ch;

  &.here {
    background-color: var(--surface-2);
    border-color: color-mix(in oklab, var(--mint) 55%, transparent);
  }
}

.mode-text {
  flex: 1;
  min-inline-size: 0;
}

.mode-name {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  font-weight: 600;
}

.badge {
  padding: 0.15em 0.6em;
  border-radius: 999px;
  color: var(--bg);
  background-color: var(--mint);
  font-size: 1rem;
}

.mode-blurb {
  margin-block-start: 1.5em;
  font-size: .9em;
}

.mode-link {
  flex-shrink: 0;
  text-decoration: none;
  color: var(--mint);

  &.soon {
    color: var(--muted);
    opacity: 0.7;
  }

  &:not(.soon):hover {
    text-decoration: underline;
  }
}

.points {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  margin-block: 2rem;
  margin-inline-start: 2rem;
  list-style: none;

  li {
    position: relative;
    padding-inline-start: 1.5rem;
    margin-block-end: 1.5rem;
    max-inline-size: 40ch;

    &::before {
      content: "";
      position: absolute;
      inset-block-start: 0.62em;
      inset-inline-start: 0;
      inline-size: 0.7rem;
      block-size: 2px;
      background-color: var(--mint);
    }
  }
}

.display-modes {
  margin-block-start: 2rem;
}

.dm {
  display: grid;
  gap: 0.35rem 1.5rem;
  padding-block: 1.1rem;
  border-block-start: 1px solid var(--line);

  &:last-child {
    border-block-end: 1px solid var(--line);
  }

  @container (min-width: 34rem) {
    grid-template-columns: 16rem 1fr;
    align-items: baseline;
  }

  dt {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
}

.exam {
  margin-block-start: 2rem;
}

.exam-steps {
  display: grid;
  gap: 0.85rem;
  padding-inline-start: 1.5rem;

  li::marker {
    color: var(--coral);
    font-variant-numeric: tabular-nums;
  }
}

.exam-note {
  margin-block-start: 1.5rem;
  padding-block-start: 1.25rem;
  border-block-start: 1px solid var(--line);
}

.colophon {
  margin-block-start: 2.5rem;
}
</style>

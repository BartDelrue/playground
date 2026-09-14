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
    blurb: 'HTML, CSS and JavaScript, bundled to blob URLs and rendered live in a sandboxed frame.',
  },
  {
    key: 'vue',
    label: 'Vue',
    url: `${location.origin}/vue`,
    blurb: 'Single-file components, compiled in the browser by the official @vue/repl.',
  },
  {
    key: 'node',
    label: 'Node',
    url: `${location.origin}/node`,
    blurb: 'A Node-style server with working npm install, run entirely in the browser via almostnode.'
  },
]

const DISPLAY_MODES = [
  {
    q: 'full',
    name: 'Full',
    desc: 'Default. The whole workspace: file tree, editor, console and live preview — plus a terminal in Node mode.'
  },
  {
    q: 'minimal',
    name: 'Minimal',
    desc: 'Editor and preview side by side, with every bit of chrome stripped away. Ideal for embedding.',
    iframe: `${useRequestURL().origin}?displaymode=minimal`
  },
  {
    q: 'vertical', name: 'Vertical', desc: 'Editor stacked above the preview, splitting top to bottom.',
    iframe: `${useRequestURL().origin}?displaymode=vertical&file=styles.css`
  },
]

useHead({
  title: `About · Playground`,
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
            </h3>
            <p class="mode-blurb muted">{{ m.blurb }}</p>
          </div>
          <a :href="m.url" class="mode-link caps">visit →</a>
        </li>
      </ul>
    </header>

    <main>
      <section class="wrap section">
        <h2 class="section-title">Display modes</h2>
        <p class="lead">
          Add a <code>displaymode</code> query parameter to reshape the workspace — handy for embedding
          a stripped-down view in a slide, an LMS or an iframe. Pair it with
          <code>?file=</code> to decide which file opens:
          <code>?displaymode=minimal&amp;file=server/server.js</code>. The file is chosen once,
          when the playground loads — switching files afterwards leaves the link alone.
        </p>

        <dl class="display-modes">
          <div v-for="dm in DISPLAY_MODES" :key="dm.q" class="dm">
            <dt>
              <code>?displaymode={{ dm.q }}</code>
            </dt>
            <dd class="muted">
              <div>
                {{ dm.desc }}
              </div>
              <iframe
                  v-if="dm.iframe" :src="dm.iframe" frameborder="0"
                  style="width: 100%; min-height: 40rem; margin-block-start:1rem;"/>
            </dd>
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
      <p class="colophon caps muted">Built and maintained by <a href="https://bartdelrue.github.io">Bart Delrue</a> for
        <a
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
  font-family: var(--font-body);
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
  font-family: var(--font-display);
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

  @media (min-width: 60rem) {
    flex-wrap: nowrap;
  }
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
  flex: 1 1 40ch;
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
}

.display-modes {
  margin-block-start: 2rem;
}

.dm {
  display: grid;
  gap: 0.35rem 1.5rem;
  padding-block: 1.1rem;
  border-block-start: 1px solid var(--line);

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

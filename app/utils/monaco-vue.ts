import type * as MT from 'monaco-editor'

// ─── Vue 3 type declarations for Monaco's TypeScript service ─────────────────

const VUE_TYPES = `
declare module 'vue' {
  export interface Ref<T = any> { value: T }
  export interface ShallowRef<T = any> { value: T }
  export interface ComputedRef<T = any> extends Ref<T> { readonly value: T }
  export interface WritableComputedRef<T> extends Ref<T> {}
  type UnwrapRef<T> = T extends Ref<infer V> ? UnwrapRef<V> : T
  type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)
  type WatchCallback<V = any, OV = any> = (value: V, oldValue: OV, onCleanup: (fn: () => void) => void) => void
  export interface WatchStopHandle { (): void }

  export function ref<T>(value: T): Ref<UnwrapRef<T>>
  export function ref<T = any>(): Ref<T | undefined>
  export function shallowRef<T>(value: T): ShallowRef<T>
  export function shallowRef<T = any>(): ShallowRef<T | undefined>
  export function reactive<T extends object>(target: T): T
  export function shallowReactive<T extends object>(target: T): T
  export function readonly<T extends object>(target: T): Readonly<T>
  export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
  export function unref<T>(ref: T | Ref<T>): T
  export function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]>
  export function toRefs<T extends object>(object: T): { [K in keyof T]: Ref<T[K]> }

  export function computed<T>(getter: () => T): ComputedRef<T>
  export function computed<T>(options: { get(): T; set(value: T): void }): WritableComputedRef<T>

  export function watch<T>(source: WatchSource<T>, cb: WatchCallback<T>, opts?: { immediate?: boolean; deep?: boolean; flush?: 'pre'|'post'|'sync' }): WatchStopHandle
  export function watch<T extends object>(source: T, cb: WatchCallback<T>, opts?: { immediate?: boolean; deep?: boolean }): WatchStopHandle
  export function watchEffect(effect: (onCleanup: (fn: () => void) => void) => void, opts?: { flush?: 'pre'|'post'|'sync' }): WatchStopHandle

  export function onMounted(hook: () => void): void
  export function onBeforeMount(hook: () => void): void
  export function onUnmounted(hook: () => void): void
  export function onBeforeUnmount(hook: () => void): void
  export function onUpdated(hook: () => void): void
  export function onBeforeUpdate(hook: () => void): void
  export function onErrorCaptured(hook: (err: unknown, instance: any, info: string) => boolean | void): void
  export function onActivated(hook: () => void): void
  export function onDeactivated(hook: () => void): void

  export function provide<T>(key: string | symbol, value: T): void
  export function inject<T>(key: string | symbol): T | undefined
  export function inject<T>(key: string | symbol, defaultValue: T): T
  export function nextTick(fn?: () => void): Promise<void>
  export function useTemplateRef<T = HTMLElement>(key: string): Readonly<Ref<T | null>>

  export function defineProps<T extends Record<string, any> = {}>(): T
  export function defineEmits<T = Record<string, any>>(): (event: keyof T, ...args: any[]) => void
  export function defineExpose<T extends Record<string, any>>(exposed?: T): void
  export function withDefaults<T, D extends Partial<T>>(props: T, defaults: D): T & Required<Pick<T, Extract<keyof T, keyof D>>>
  export function defineComponent<T extends object>(options: T): T

  export interface App {
    mount(el: string | Element): any
    unmount(): void
    use(plugin: any, ...args: any[]): this
    component(name: string, comp?: any): any
    directive(name: string, dir?: any): any
    provide<T>(key: string | symbol, value: T): this
    config: { globalProperties: Record<string, any> }
  }
  export function createApp(root: any, props?: Record<string, any>): App
}
`

// ─── Monarch tokenizer for Vue SFCs ──────────────────────────────────────────

const vueTokens: MT.languages.IMonarchLanguage = {
  defaultToken: '',
  keywords: [
    'abstract','as','async','await','break','case','catch','class','const','continue',
    'declare','default','delete','do','else','enum','export','extends','false','finally',
    'for','from','function','get','if','implements','import','in','instanceof','interface',
    'let','module','namespace','new','null','of','package','private','protected','public',
    'readonly','return','set','static','super','switch','this','throw','true','try','type',
    'typeof','undefined','var','void','while','yield',
  ],
  vueApis: [
    'ref','shallowRef','reactive','shallowReactive','readonly','computed','watch','watchEffect',
    'onMounted','onBeforeMount','onUnmounted','onBeforeUnmount','onUpdated','onBeforeUpdate',
    'onErrorCaptured','onActivated','onDeactivated','provide','inject','nextTick',
    'toRef','toRefs','isRef','unref','useTemplateRef',
    'defineProps','defineEmits','defineExpose','withDefaults','defineComponent','createApp',
  ],
  tokenizer: {
    root: [
      [/(<)(template)(\b)/, ['delimiter.html', 'tag.html.vue', ''], '@template'],
      [/(<)(script)(\b)/,   ['delimiter.html', 'tag.html.vue', ''], '@script'],
      [/(<)(style)(\b)/,    ['delimiter.html', 'tag.html.vue', ''], '@style'],
      [/<!--/, 'comment.html', '@htmlComment'],
      [/[^<]+/, ''],
      [/</, 'delimiter.html'],
    ],
    htmlComment: [
      [/-->/, 'comment.html', '@pop'],
      [/./, 'comment.html'],
    ],

    // ── Template ──────────────────────────────────────────────────────────────
    template: [
      [/(<\/)(template)(>)/, ['delimiter.html', 'tag.html.vue', 'delimiter.html'], '@pop'],
      [/{{/, 'metatag', '@mustache'],
      [/(<\/?)([A-Z][a-zA-Z0-9-]*)/, ['delimiter.html', 'tag.vue-component']],
      [/(<\/?)([a-z][a-zA-Z0-9-]*)/, ['delimiter.html', 'tag.html']],
      [/\bv-[a-z-]+\b/, 'keyword'],
      [/[@:#][a-zA-Z][a-zA-Z0-9._-]*/, 'keyword'],
      [/[a-zA-Z_][\w-]*(?==)/, 'attribute.name.html'],
      [/(=)("[^"]*"|'[^']*')/, ['delimiter', 'attribute.value.html']],
      [/>/, 'delimiter.html'],
      [/[^<{@:#v]+/, ''],
    ],
    mustache: [
      [/}}/, 'metatag', '@pop'],
      { include: 'scriptBody' },
    ],

    // ── Script ────────────────────────────────────────────────────────────────
    script: [
      [/\s+/, ''],
      [/(lang=)(["'])(ts|typescript)\2/, ['attribute.name.html', 'attribute.value.html', 'attribute.value.html']],
      [/(setup|lang=["'][^"']*["']|[a-zA-Z]+(?:=[^>]*)?)/, 'attribute.name.html'],
      [/>/, 'delimiter.html', '@scriptBody'],
      [/\/?>/, 'delimiter.html', '@pop'],
    ],
    scriptBody: [
      [/(<\/)(script)(>)/, ['delimiter.html', 'tag.html.vue', 'delimiter.html'], '@pop'],
      { include: 'ts' },
    ],

    // ── Style ─────────────────────────────────────────────────────────────────
    style: [
      [/\s+/, ''],
      [/[a-zA-Z]+(?:=[^>]*)?/, 'attribute.name.html'],
      [/>/, 'delimiter.html', '@styleBody'],
      [/\/?>/, 'delimiter.html', '@pop'],
    ],
    styleBody: [
      [/(<\/)(style)(>)/, ['delimiter.html', 'tag.html.vue', 'delimiter.html'], '@pop'],
      { include: 'css' },
    ],

    // ── Embedded TypeScript ───────────────────────────────────────────────────
    ts: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@blockComment'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/`/, 'string', '@templateLiteral'],
      [/\b\d+\.?\d*([eE][+-]?\d+)?\b/, 'number'],
      [/\b0x[0-9a-fA-F]+\b/, 'number.hex'],
      [/\b(?:ref|shallowRef|reactive|shallowReactive|readonly|computed|watch|watchEffect|onMounted|onBeforeMount|onUnmounted|onBeforeUnmount|onUpdated|onBeforeUpdate|onErrorCaptured|onActivated|onDeactivated|provide|inject|nextTick|toRef|toRefs|isRef|unref|useTemplateRef|defineProps|defineEmits|defineExpose|withDefaults|defineComponent|createApp)\b/, 'keyword.vue'],
      [/\b(?:abstract|as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|module|namespace|new|null|of|package|private|protected|public|readonly|return|set|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|yield)\b/, 'keyword'],
      [/[a-zA-Z_$][\w$]*/, 'identifier'],
      [/[{}()[\]]/, 'delimiter.bracket'],
      [/[;,.]/, 'delimiter'],
      [/[=!<>+\-*/%&|^~?:]+/, 'operator'],
      [/\s+/, ''],
    ],
    blockComment: [
      [/\*\//, 'comment', '@pop'],
      [/./, 'comment'],
    ],
    templateLiteral: [
      [/`/, 'string', '@pop'],
      [/\${/, 'delimiter.bracket', '@tlExpression'],
      [/[^`$]+/, 'string'],
    ],
    tlExpression: [
      [/}/, 'delimiter.bracket', '@pop'],
      { include: 'ts' },
    ],

    // ── Embedded CSS ──────────────────────────────────────────────────────────
    css: [
      [/\/\*/, 'comment', '@cssComment'],
      [/([.#]?[a-zA-Z][\w-]*)(\s*{)/, ['type.css', 'delimiter.bracket']],
      [/}/, 'delimiter.bracket'],
      [/([a-zA-Z-]+)(\s*:)/, ['attribute.name.css', 'delimiter']],
      [/:[^;{]+/, 'attribute.value.css'],
      [/;/, 'delimiter'],
      [/\s+/, ''],
    ],
    cssComment: [
      [/\*\//, 'comment', '@pop'],
      [/./, 'comment'],
    ],
  },
}

// ─── Completion items ─────────────────────────────────────────────────────────

const SNIPPETS: Array<{ label: string; insert: string; doc: string; kind: number }> = [
  { label: 'ref',            insert: 'ref(${1:initialValue})',              doc: 'Creates a reactive reference',            kind: 3 },
  { label: 'reactive',       insert: 'reactive({ ${1} })',                  doc: 'Creates a reactive object',               kind: 3 },
  { label: 'computed',       insert: 'computed(() => ${1})',                doc: 'Creates a computed ref',                  kind: 3 },
  { label: 'watch',          insert: 'watch(${1:source}, (val) => {\n  ${2}\n})', doc: 'Watches a reactive source',         kind: 3 },
  { label: 'watchEffect',    insert: 'watchEffect(() => {\n  ${1}\n})',     doc: 'Runs effect tracking its deps',          kind: 3 },
  { label: 'onMounted',      insert: 'onMounted(() => {\n  ${1}\n})',       doc: 'Lifecycle: after component is mounted',  kind: 3 },
  { label: 'onUnmounted',    insert: 'onUnmounted(() => {\n  ${1}\n})',     doc: 'Lifecycle: before component unmounts',   kind: 3 },
  { label: 'onUpdated',      insert: 'onUpdated(() => {\n  ${1}\n})',       doc: 'Lifecycle: after DOM update',            kind: 3 },
  { label: 'onBeforeMount',  insert: 'onBeforeMount(() => {\n  ${1}\n})',   doc: 'Lifecycle: before first render',         kind: 3 },
  { label: 'onBeforeUnmount',insert: 'onBeforeUnmount(() => {\n  ${1}\n})', doc: 'Lifecycle: before unmount begins',       kind: 3 },
  { label: 'defineProps',    insert: 'defineProps<{\n  ${1}: ${2:string}\n}>()', doc: 'Declare component props',             kind: 3 },
  { label: 'defineEmits',    insert: "defineEmits<{\n  ${1}: [${2}]\n}>()", doc: 'Declare component events',               kind: 3 },
  { label: 'defineExpose',   insert: 'defineExpose({ ${1} })',              doc: 'Expose properties to parent',            kind: 3 },
  { label: 'useTemplateRef', insert: 'useTemplateRef<${1:HTMLElement}>(\x27${2:el}\x27)', doc: 'Get a template ref', kind: 3 },
  { label: 'provide',        insert: 'provide(${1:key}, ${2:value})',       doc: 'Provide a value to descendants',         kind: 3 },
  { label: 'inject',         insert: 'inject(${1:key})',                    doc: 'Inject a provided value',                kind: 3 },
  { label: 'toRef',          insert: 'toRef(${1:object}, \x27${2:key}\x27)', doc: 'Create ref from object property',      kind: 3 },
  { label: 'toRefs',         insert: 'toRefs(${1:object})',                 doc: 'Convert reactive object to refs',        kind: 3 },
  { label: 'nextTick',       insert: 'await nextTick()',                    doc: 'Wait for next DOM update flush',         kind: 3 },
  { label: 'shallowRef',     insert: 'shallowRef(${1:value})',              doc: 'Shallow-only reactive ref',              kind: 3 },
]

function completionProvider(monaco: typeof MT): MT.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const text  = model.getValue()
      const offset = model.getOffsetAt(position)

      // Only offer completions inside <script> … </script>
      const scriptOpen  = text.search(/<script\b/)
      const scriptClose = text.lastIndexOf('</script>')
      if (scriptOpen < 0 || offset < scriptOpen || offset > scriptClose)
        return { suggestions: [] }

      const word  = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      }

      return {
        suggestions: SNIPPETS.map(s => ({
          label:            s.label,
          kind:             s.kind as MT.languages.CompletionItemKind,
          documentation:    s.doc,
          insertText:       s.insert,
          insertTextRules:  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
      }
    },
  }
}

// ─── Public setup function ────────────────────────────────────────────────────

let initialized = false

export function setupMonacoVue(monaco: typeof MT): void {
  if (initialized) return
  initialized = true

  // Register language
  monaco.languages.register({ id: 'vue', extensions: ['.vue'] })

  monaco.languages.setLanguageConfiguration('vue', {
    comments:   { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets:   [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{',   close: '}' },
      { open: '[',   close: ']' },
      { open: '(',   close: ')' },
      { open: '"',   close: '"',  notIn: ['string', 'comment'] },
      { open: "'",   close: "'",  notIn: ['string', 'comment'] },
      { open: '`',   close: '`' },
      { open: '<!--',close: '-->' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
      { open: '"', close: '"' }, { open: "'", close: "'" }, { open: '`', close: '`' },
      { open: '<', close: '>' },
    ],
  })

  monaco.languages.setMonarchTokensProvider('vue', vueTokens)
  monaco.languages.registerCompletionItemProvider('vue', completionProvider(monaco))

  // Add Vue types to Monaco's TypeScript service.
  // Important: leave module/moduleResolution at Monaco's defaults — overriding
  // them (e.g. module: ESNext + moduleResolution: NodeJs) breaks completions.
  const ts = monaco.languages.typescript
  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    defaults.setEagerModelSync(true)
    defaults.setCompilerOptions({
      ...defaults.getCompilerOptions(),
      allowSyntheticDefaultImports: true,
      jsx: ts.JsxEmit.Preserve,
    })
    defaults.addExtraLib(VUE_TYPES, 'file:///node_modules/vue/index.d.ts')
  }
}

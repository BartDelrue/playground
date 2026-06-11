import {WebContainer, type WebContainerProcess, type FileSystemTree} from "@webcontainer/api";

type LogHandler = (text: string, type?: LogType) => void

const ANSI    = /\x1B\[[0-9;]*[A-Za-z]/g
const SPINNER = /^[-\\|/⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\s]+$/

// Console capture injected into every preview page via a hidden Vite plugin.
// Lives in .playground/ inside WebContainer — never visible in the editor.
const CONSOLE_PLUGIN = `
export default {
  name: 'console-capture',
  transformIndexHtml() {
    return [{
      tag: 'script',
      injectTo: 'head-prepend',
      children: \`;(function(){
        var _post = function(type, args) {
          window.top.postMessage({
            source: 'playground-console', type: type,
            message: Array.from(args).map(function(a){
              try { return typeof a === 'object' ? JSON.stringify(a) : String(a) } catch(e){ return String(a) }
            }).join(' ')
          }, '*');
        };
        console.log   = function(){ _post('info',  arguments) };
        console.info  = function(){ _post('info',  arguments) };
        console.warn  = function(){ _post('warn',  arguments) };
        console.error = function(){ _post('error', arguments) };
      })();\`
    }]
  }
}
`


const VITE_CONFIG_WRAPPER = `
import { mergeConfig } from 'vite'
import userConfig from '../vite.config.js'
import consolePlugin from './console-plugin.mjs'
export default mergeConfig(userConfig, {
  plugins: [consolePlugin]
})
`

export const useWebContainer = (fsTree: () => FileSystemTree) => {

  const wc = shallowRef<WebContainer | null>(null);
  let devProc: WebContainerProcess | null = null;
  const previewUrl = ref('');
  const isBooting = ref(false);
  const bootStatus = ref('');

  const logHandlers: LogHandler[] = []
  const onLog = (handler: LogHandler) => logHandlers.push(handler)
  const pushLog = (text: string, type: LogType = LogType.INFO) => logHandlers.forEach(h => h(text, type))

  function batchWriter(ms = 50) {
    let buf = '', timer: ReturnType<typeof setTimeout> | null = null
    return (chunk: string) => {
      buf += chunk
      if (!timer) timer = setTimeout(() => {
        const text = buf
          .replace(/\r\n/g, '\n')
          .split('\n')
          .map(line => line.split('\r').at(-1) ?? '')
          .map(line => line.replace(ANSI, ''))
          .filter(line => line.trim() && !SPINNER.test(line.trim()))
          .join('\n')
        if (text) pushLog(text)
        buf = ''; timer = null
      }, ms)
    }
  }

  async function injectPlayground(): Promise<void> {
    await wc.value!.fs.mkdir('.playground').catch(() => {})
    await wc.value!.fs.writeFile('.playground/console-plugin.mjs', CONSOLE_PLUGIN)
    await wc.value!.fs.writeFile('.playground/vite.config.mjs', VITE_CONFIG_WRAPPER)

    // Add a hidden _dev script to the in-WebContainer package.json that uses
    // our wrapper config. The user's visible package.json is never touched.
    const raw = await wc.value!.fs.readFile('package.json', 'utf-8')
    const pkg = JSON.parse(raw)
    const original = pkg.scripts?.dev ?? ''
    pkg.scripts._dev = original.replace(/\bvite\b/, 'vite --config .playground/vite.config.mjs')
    await wc.value!.fs.writeFile('package.json', JSON.stringify(pkg, null, 2))
  }

  async function spawnDev(): Promise<void> {
    console.log('[WC] Starting npm install')
    pushLog('$ npm install');
    const install = await wc.value!.spawn('npm', ['install']);
    install.output.pipeTo(new WritableStream({write: batchWriter()}));
    const code = await install.exit;
    if (code !== 0) throw new Error(`npm install exited with code ${code}`);
    console.log('[WC] npm install done')

    await injectPlayground();

    console.log('[WC] Starting npm run _dev')
    pushLog('$ npm run dev');
    devProc = await wc.value!.spawn('npm', ['run', '_dev']);
    devProc.output.pipeTo(new WritableStream({write: batchWriter()}));
  }

  async function boot(): Promise<void> {
    // WebContainer requires SharedArrayBuffer, which is only available in
    // cross-origin isolated contexts (COOP + COEP headers). Calling boot() without
    // this causes WebContainer to navigate to StackBlitz's setup page.
    if (!window.crossOriginIsolated) {
      pushLog(
        'This browser is not cross-origin isolated — SharedArrayBuffer is unavailable.\n' +
        'The full-stack playground requires these HTTP headers to be present:\n' +
        '  Cross-Origin-Opener-Policy: same-origin\n' +
        '  Cross-Origin-Embedder-Policy: require-corp\n' +
        'In a lockdown browser (e.g. Safe Exam Browser) these may be blocked.\n' +
        'Please use the Browser or Vue playground mode instead.',
        LogType.ERROR
      )
      return
    }

    isBooting.value = true;
    bootStatus.value = 'Booting WebContainer…';
    previewUrl.value = '';
    try {
      if (!wc.value) {
        console.log('[WC] Calling WebContainer.boot()')
        wc.value = await WebContainer.boot()
        console.log('[WC] boot() returned — WebContainer ready')
        pushLog('WebContainer ready')
        wc.value.on('server-ready', (port, url) => {
          console.log('[WC] server-ready (Vite):', url)
          pushLog(`Server ready → ${url}`)
          previewUrl.value = url
          isBooting.value = false
          bootStatus.value = ''
        })
      }
      bootStatus.value = 'Mounting files…';
      await wc.value.mount(fsTree());
      console.log('[WC] Files mounted')
      pushLog('Files mounted');
      bootStatus.value = 'Installing & starting…';
      await spawnDev();
    } catch (err) {
      pushLog(err instanceof Error ? err.message : String(err), LogType.ERROR);
      isBooting.value = false;
      bootStatus.value = '';
    }
  }

  async function restart(): Promise<void> {
    if (!window.crossOriginIsolated) { await boot(); return; } // boot() handles the error
    if (!wc.value) { await boot(); return; }
    devProc?.kill();
    devProc = null;
    previewUrl.value = '';
    isBooting.value = true;
    try {
      bootStatus.value = 'Mounting files…';
      await wc.value!.mount(fsTree());
      bootStatus.value = 'Installing & starting…';
      await spawnDev();
    } catch (err) {
      pushLog(err instanceof Error ? err.message : String(err), LogType.ERROR);
      isBooting.value = false;
      bootStatus.value = '';
    }
  }

  const previewKey = ref(0)
  return {onLog, wc, devProc, previewUrl, previewKey, isBooting, bootStatus, boot, restart}
}

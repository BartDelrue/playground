import nodePackageJson    from './defaults/node/package.json?raw'
import nodeServerIndexJs  from './defaults/node/server/index.js?raw'
import nodeClientIndexHtml from './defaults/node/client/index.html?raw'
import nodeClientMainJs    from './defaults/node/client/src/main.js?raw'
import nodeClientStylesCss from './defaults/node/client/src/styles.css?raw'

import browserIndexHtml  from './defaults/browser/index.html?raw'
import browserMainJs     from './defaults/browser/src/main.js?raw'
import browserStyleCss   from './defaults/browser/src/style.css?raw'

import vueIndexHtml      from './defaults/vue/index.html?raw'
import vueMainJs         from './defaults/vue/src/main.js?raw'
import vueAppVue         from './defaults/vue/src/App.vue?raw'

export const NODE_DEFAULT_FILES: Record<string, string> = {
  'package.json':           nodePackageJson,
  'server/index.js':        nodeServerIndexJs,
  'client/index.html':      nodeClientIndexHtml,
  'client/src/main.js':     nodeClientMainJs,
  'client/src/styles.css':  nodeClientStylesCss,
}

export const BROWSER_DEFAULT_FILES: Record<string, string> = {
  'index.html':    browserIndexHtml,
  'src/main.js':   browserMainJs,
  'src/style.css': browserStyleCss,
}

export const VUE_DEFAULT_FILES: Record<string, string> = {
  'index.html':  vueIndexHtml,
  'src/main.js': vueMainJs,
  'src/App.vue': vueAppVue,
}

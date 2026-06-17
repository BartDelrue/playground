import nodePackageJson from './node/package.json?raw'
import nodeServerIndexJs from './node/server?raw'
import nodeClientIndexHtml from './node/client/index.html?raw'
import nodeClientMainJs from './node/client/src/main.js?raw'

import browserIndexHtml from './browser/index.html?raw'
import browserMainJs from './browser/main.js?raw'

import vueIndexHtml from './vue/index.html?raw'
import vueMainJs from './vue/src/main.js?raw'
import vueAppVue from './vue/src/App.vue?raw'

import commonStyleCss from './common/styles.css?raw'

export const NODE_DEFAULT_FILES: Record<string, string> = {
    'package.json': nodePackageJson,
    'server/index.js': nodeServerIndexJs,
    'client/index.html': nodeClientIndexHtml,
    'client/src/main.js': nodeClientMainJs,
    'client/src/styles.css': commonStyleCss,
}

export const BROWSER_DEFAULT_FILES: Record<string, string> = {
    'index.html': browserIndexHtml,
    'main.js': browserMainJs,
    'styles.css': commonStyleCss,
}

export const VUE_DEFAULT_FILES: Record<string, string> = {
    'index.html': vueIndexHtml,
    'src/main.js': vueMainJs,
    'src/App.vue': vueAppVue,
    'src/styles.css': commonStyleCss
}

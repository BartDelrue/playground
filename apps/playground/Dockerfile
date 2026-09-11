# The playground: prerendered to static files, served by nginx.
#
# Build context is the REPO ROOT. In Coolify: leave "Base Directory" at / and set
# "Dockerfile Location" to /apps/playground/Dockerfile.

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
RUN npm install --global pnpm@11.21.0
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY apps/playground/package.json ./apps/playground/
COPY apps/preview/package.json   ./apps/preview/
COPY apps/admin/package.json     ./apps/admin/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# THE PART THAT CATCHES PEOPLE OUT.
#
# This app prerenders to static files: there is no server left at run time to read an
# environment variable. Both origins below are baked into the JavaScript during the build,
# so they have to arrive as Docker BUILD ARGS - in Coolify, an environment variable with
# "Build Variable" ticked. Set them as plain runtime variables and they do nothing at all:
# the app builds fine and then talks to the wrong origin, or to none.
#
# Changing either one is a REBUILD, not a restart.
ARG NUXT_PUBLIC_PREVIEW_ORIGIN
ARG NUXT_PUBLIC_API_ORIGIN
ENV NUXT_PUBLIC_PREVIEW_ORIGIN=$NUXT_PUBLIC_PREVIEW_ORIGIN
ENV NUXT_PUBLIC_API_ORIGIN=$NUXT_PUBLIC_API_ORIGIN

# Fail loudly here rather than shipping a build that silently cannot reach anything.
RUN test -n "$NUXT_PUBLIC_PREVIEW_ORIGIN" || (echo "NUXT_PUBLIC_PREVIEW_ORIGIN is not set as a BUILD variable" && exit 1) \
 && test -n "$NUXT_PUBLIC_API_ORIGIN"     || (echo "NUXT_PUBLIC_API_ORIGIN is not set as a BUILD variable" && exit 1)

# Node's default heap is about 2 GB, and this build does not fit in it: measured, it dies
# at ~2048 MB and completes at 3072 MB. That is the price of one build serving three modes
# - Monaco, @vue/repl (which carries its own Monaco and Volar) and almostnode are all in
# the same module graph, where the old three-build setup split them up.
#
# 4096 for headroom. The BUILD MACHINE therefore needs ~4 GB of RAM or swap available. If
# this step dies with exit code 137 or a bare "Killed" instead of a JavaScript heap
# message, that is the kernel's OOM killer rather than Node's own limit, and raising this
# number will not help - the server needs more memory.
ENV NODE_OPTIONS=--max-old-space-size=4096

# copy-almostnode-assets lifts almostnode's service worker and runtime worker out of
# node_modules into public/. Node mode is broken without them, and --ignore-scripts above
# means postinstall did not run, so this is that step done explicitly.
RUN node tools/copy-almostnode-assets.mjs \
 && pnpm --filter @playground/app exec nuxt prepare \
 && pnpm --filter @playground/app generate

# ---- serve ------------------------------------------------------------------
FROM nginx:alpine AS run
COPY --from=build /repo/apps/playground/.output/public /usr/share/nginx/html
COPY apps/playground/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

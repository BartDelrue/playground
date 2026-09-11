# Admin portal: the only long-running process.
#
# Build context is the REPO ROOT, not this directory - pnpm has to see the whole
# workspace to resolve @playground/shared. In Coolify that means leaving "Base Directory"
# at / and setting "Dockerfile Location" to /apps/admin/Dockerfile.

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
RUN npm install --global pnpm@11.21.0
WORKDIR /repo

# Copy manifests first so a code-only change reuses the cached install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY apps/playground/package.json ./apps/playground/
COPY apps/preview/package.json   ./apps/preview/
COPY apps/admin/package.json     ./apps/admin/
COPY packages/shared/package.json ./packages/shared/

# --ignore-scripts because postinstall builds the OTHER two apps (it copies almostnode's
# worker and bundles the preview shim). None of that belongs in the admin image, and at
# this point the source it needs has not been copied in yet.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
# `nuxt prepare` is the part of postinstall this app does need: it generates .nuxt/types,
# without which the build fails on missing auto-import types.
RUN pnpm --filter @playground/admin exec nuxt prepare \
 && pnpm --filter @playground/admin build

# ---- run --------------------------------------------------------------------
FROM node:22-alpine AS run
WORKDIR /app

# Nitro bundles its own dependencies into .output, so the runtime image needs no
# node_modules and no package manager.
COPY --from=build /repo/apps/admin/.output ./.output

ENV NODE_ENV=production
ENV NITRO_PORT=3000
EXPOSE 3000

# Exam data lives here. This MUST be a mounted volume in Coolify - a container filesystem
# is thrown away on every redeploy, and NUXT_STORAGE_DIR pointing anywhere else means
# losing every submission the next time you deploy.
ENV NUXT_STORAGE_DIR=/data
VOLUME /data

CMD ["node", ".output/server/index.mjs"]

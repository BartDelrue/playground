# The preview origin: one HTML file and one bundle, and nothing else may ever live here.
#
# This is where browser-mode student code executes. It is a separate origin so the blob
# URLs the shim mints inherit ITS origin rather than the playground's, which is what stops
# student code from reaching the app's document.
#
# Build context is the REPO ROOT. In Coolify: leave "Base Directory" at / and set
# "Dockerfile Location" to /apps/preview/Dockerfile.

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

# No build arguments. The shim learns the app's origin from the first message it receives
# rather than having one baked in, so one image serves development and production alike.
RUN pnpm --filter @playground/preview build

# ---- serve ------------------------------------------------------------------
FROM nginx:alpine AS run
# dist/ only: index.html and main.js. Copying the app directory instead would publish
# package.json and src/ on the origin that runs untrusted code, for no reason.
COPY --from=build /repo/apps/preview/dist /usr/share/nginx/html
COPY apps/preview/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

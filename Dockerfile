# Node 22 LTS — the active long-term-support line. Pinned off Node 24
# ("Current") after a newer 24.x pulled by the moving tag introduced an
# undici/fetch "Premature close" regression that broke the server's HTTPS
# call to Google's OAuth token endpoint (knocking out photo storage).
FROM node:22-alpine
WORKDIR /app

# Native build tools required by some npm packages
RUN apk add --no-cache python3 make g++

# Install the exact pnpm version used by the project
RUN npm install -g pnpm@10.33.0

# Copy workspace manifests before source for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY lib/db/package.json lib/db/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/mobile/package.json artifacts/mobile/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY scripts/package.json scripts/

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Copy remaining source files
COPY . .

# Build the api-server bundle
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]

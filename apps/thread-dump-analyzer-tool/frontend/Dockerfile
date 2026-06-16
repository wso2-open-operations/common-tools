# Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
#
# WSO2 LLC. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# pnpm 9 matches the committed pnpm-lock.yaml (lockfileVersion 9.0).
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# No host- or tenant-specific values are baked in; they are injected at runtime by docker-entrypoint.sh.
COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM nginx:1.27-alpine

# Non-root UID in Choreo's required 10000-20000 range; own the served dir so config.js can be rewritten at start.
RUN adduser -D -u 10015 tdat \
    && chown -R 10015 /usr/share/nginx/html

COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER 10015
EXPOSE 8080

# Liveness probe for Docker/Compose/Podman (k8s and Choreo use their own probes).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/" >/dev/null 2>&1 || exit 1

# Entrypoint renders config.js and the nginx listen port from env, then runs nginx.
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-c", "/tmp/nginx.conf", "-g", "daemon off;"]
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
FROM golang:1.25-alpine AS build

WORKDIR /src

# Download modules first so they cache independently of source edits.
COPY go.mod go.sum ./
RUN go mod download

# CGO off produces a static binary that runs on a minimal runtime image.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/tdat-backend .

# ---- Runtime stage ----
FROM alpine:3.20

# ca-certificates: outbound HTTPS to the Anthropic API. UID 10014 sits in Choreo's required 10000-20000 range.
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10014 tdat

WORKDIR /app

# Binary plus the two files the server reads at runtime: Grule rules and thread-pool definitions.
COPY --from=build /out/tdat-backend ./tdat-backend
COPY --from=build /src/config ./config
COPY --from=build /src/internal/rules/rules.grl ./internal/rules/rules.grl

USER 10014
EXPOSE 8080

# Liveness probe for Docker/Compose/Podman (k8s and Choreo use their own probes).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" >/dev/null 2>&1 || exit 1

# Containers log to stdout/stderr (collected by the platform); the on-disk session log is off by default.
# To enable it, mount a writable volume and override, e.g. -e LOG_FILE=/data/logs/tdat.log.
ENV LOG_FILE=off

# ANTHROPIC_API_KEY, auth, and CORS settings are supplied at runtime, never baked into the image.
ENTRYPOINT ["./tdat-backend"]

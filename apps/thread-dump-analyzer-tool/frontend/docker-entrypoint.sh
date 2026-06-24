#!/bin/sh
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

set -e

# Inject runtime config so one image serves any host and any Asgardeo tenant (the app reads window.configs first).
: "${API_URL:=http://localhost:8080}"
: "${ASGARDEO_CLIENT_ID:=}"
: "${ASGARDEO_BASE_URL:=}"

# Escape backslashes, single quotes, then CR/LF so a hostile or malformed env value can't break out of the JS string literal.
# $!{N;ba} guards N with the last-line check so single-line values still reach the s/// commands (a bare :a;N;$!ba quits at EOF first).
escape_js() {
    printf '%s' "$1" | sed -e ':a' -e '$!{N;ba' -e '}' \
        -e 's/\\/\\\\/g' \
        -e "s/'/\\\\'/g" \
        -e 's/\r/\\r/g' \
        -e 's/\n/\\n/g'
}
API_URL_ESC=$(escape_js "$API_URL")
ASGARDEO_CLIENT_ID_ESC=$(escape_js "$ASGARDEO_CLIENT_ID")
ASGARDEO_BASE_URL_ESC=$(escape_js "$ASGARDEO_BASE_URL")
cat > /usr/share/nginx/html/config.js <<EOF
window.configs = {
    apiUrl: '${API_URL_ESC}',
    ASGARDEO_CLIENT_ID: '${ASGARDEO_CLIENT_ID_ESC}',
    ASGARDEO_BASE_URL: '${ASGARDEO_BASE_URL_ESC}'
};
EOF

# Honor a platform-injected listen port (Cloud Run, Heroku, Knative set $PORT); default to 8080.
: "${PORT:=8080}"
export PORT
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

exec "$@"
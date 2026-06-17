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
cat > /usr/share/nginx/html/config.js <<EOF
window.configs = {
    apiUrl: '${API_URL}',
    ASGARDEO_CLIENT_ID: '${ASGARDEO_CLIENT_ID}',
    ASGARDEO_BASE_URL: '${ASGARDEO_BASE_URL}'
};
EOF

# Honor a platform-injected listen port (Cloud Run, Heroku, Knative set $PORT); default to 8080.
: "${PORT:=8080}"
export PORT
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

exec "$@"
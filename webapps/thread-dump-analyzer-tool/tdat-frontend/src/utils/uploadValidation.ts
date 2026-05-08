// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

const ALLOWED_EXTENSIONS = ['txt', 'log'];

export interface PairedFile {
    dump: File | null;
    usage: File | null;
    matched: boolean;
    warning?: string;
}

export function validateFiles(files: File[]): { valid: File[]; invalid: boolean } {
    const validFiles: File[] = [];
    let hasInvalid = false;

    files.forEach(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension && ALLOWED_EXTENSIONS.includes(extension)) {
            validFiles.push(file);
        } else {
            hasInvalid = true;
        }
    });

    return { valid: validFiles, invalid: hasInvalid };
}

// Extract matching key from filename by removing extension and known prefixes.
// E.g. "threaddump_2024-01-15.txt" and "threadusage_2024-01-15.log" both extract to "2024-01-15" for pairing.
export function extractFileKey(filename: string): string {
    let key = filename.replace(/\.[^/.]+$/, '');

    const prefixes = [
        'threaddump', 'threadusage', 'thread_dump', 'thread_usage',
        'thread-dump', 'thread-usage', 'dump', 'usage', 'td', 'tu',
    ];

    const lowerKey = key.toLowerCase();
    for (const prefix of prefixes) {
        if (!lowerKey.startsWith(prefix)) continue;
        const boundary = lowerKey.charAt(prefix.length);
        if (boundary !== '' && boundary !== '_' && boundary !== '-' && boundary !== '.') continue;
        key = key.substring(prefix.length).replace(/^[_\-.]/, '');
        break;
    }

    return key.trim().toLowerCase();
}

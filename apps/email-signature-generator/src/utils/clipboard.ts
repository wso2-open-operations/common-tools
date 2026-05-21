// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
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

export async function copyRichText(html: string): Promise<boolean> {
  try {
    const blob = new Blob([html], { type: "text/html" });
    const item = new ClipboardItem({ "text/html": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return legacyCopy(html);
  }
}

export async function copyHtmlCode(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyTextCopy(text);
  }
}

function legacyTextCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function legacyCopy(html: string): boolean {
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    div.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(div);
    return true;
  } catch {
    return false;
  }
}

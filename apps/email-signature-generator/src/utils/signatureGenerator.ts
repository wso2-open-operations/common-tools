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

import type { SignatureData } from "../types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function generateSignatureHTML(data: SignatureData): string {
  const socialLinks: string[] = [];
  if (data.medium) {
    const safeUrl = isSafeUrl(data.medium) ? escapeHtml(data.medium) : "#";
    socialLinks.push(
      `<a href="${safeUrl}" style="color: #F04E23; text-decoration: none;">Medium</a>`
    );
  }
  if (data.linkedin) {
    const safeUrl = isSafeUrl(data.linkedin) ? escapeHtml(data.linkedin) : "#";
    socialLinks.push(
      `<a href="${safeUrl}" style="color: #F04E23; text-decoration: none;">LinkedIn</a>`
    );
  }
  if (data.customUrl && data.customUrlLabel) {
    const safeUrl = isSafeUrl(data.customUrl) ? escapeHtml(data.customUrl) : "#";
    socialLinks.push(
      `<a href="${safeUrl}" style="color: #F04E23; text-decoration: none;">${escapeHtml(data.customUrlLabel)}</a>`
    );
  }
  const socialText = socialLinks.join(" | ");

  let phoneText = "";
  if (data.workPhone && data.personalPhone) {
    phoneText = `Work: ${escapeHtml(data.workPhone)} | Mobile: ${escapeHtml(data.personalPhone)}`;
  } else if (data.workPhone) {
    phoneText = `Work: ${escapeHtml(data.workPhone)}`;
  } else if (data.personalPhone) {
    phoneText = `Mobile: ${escapeHtml(data.personalPhone)}`;
  }

  const tdBase = [
    `-webkit-text-size-adjust: 100%`,
    `-ms-text-size-adjust: 100%`,
    `mso-table-lspace: 0pt`,
    `mso-table-rspace: 0pt`,
    `background-color: transparent`,
  ].join(";");

  const textTd = (extra: string = "") =>
    `${tdBase};color: #000000 !important;font-family: Inter, Arial, sans-serif;line-height: 1.4;padding: 0 0 3px 0;${extra}`;

  return `<table border="0" cellpadding="0" cellspacing="0" style="${tdBase};font-family: Arial, sans-serif;max-width: 400px;" width="100%">
  <tbody>
    <tr>
      <td style="${tdBase};padding: 0;margin: 0;">
        <table border="0" cellpadding="0" cellspacing="0" style="${tdBase};" width="100%">
          <tbody>
            <tr>
              <td style="${tdBase};padding: 0 0 3px 0;">
                <a href="https://wso2.com" style="text-decoration: none;border: 0;display: block;"><img src="https://wso2.cachefly.net/wso2/sites/all/image_resources/logos/wso2-orange-logo.png" alt="WSO2" width="100" style="-ms-interpolation-mode: bicubic;height: auto;outline: none;text-decoration: none;border: 0;display: block;"></a>
              </td>
            </tr>
            <tr>
              <td style="${textTd("font-size: 13px;font-weight: 700;")}">
                <span style="color: #000000 !important;">${escapeHtml(data.name)}</span>
              </td>
            </tr>
            ${
              data.designation
                ? `<tr>
              <td style="${textTd("font-size: 12px;font-weight: 600;")}">
                <span style="color: #000000 !important;">${escapeHtml(data.designation)}, WSO2</span>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="${tdBase};padding: 0 0 3px 0;">
                <hr style="border: none; border-top: 4px solid #F14E23; margin: 0; padding: 0; width: 100%; max-width: 400px;">
              </td>
            </tr>
            ${
              phoneText
                ? `<tr>
              <td style="${textTd("font-size: 11px;font-weight: 500;")}">
                <span style="color: #000000 !important;">${phoneText}</span>
              </td>
            </tr>`
                : ""
            }
            ${
              socialText
                ? `<tr>
              <td style="${textTd("font-size: 11px;font-weight: 500;")}">
                <span style="color: #000000 !important;">${socialText}</span>
              </td>
            </tr>`
                : ""
            }
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>`;
}

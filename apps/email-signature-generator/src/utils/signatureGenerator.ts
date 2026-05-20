import type { SignatureData } from "../types";

export function generateSignatureHTML(data: SignatureData): string {
  const socialLinks: string[] = [];
  if (data.medium) {
    socialLinks.push(
      `<a href="${data.medium}" style="color: #000000; text-decoration: none;">Medium</a>`
    );
  }
  if (data.linkedin) {
    socialLinks.push(
      `<a href="${data.linkedin}" style="color: #000000; text-decoration: none;">LinkedIn</a>`
    );
  }
  const socialText = socialLinks.join(" | ");

  let phoneText = "";
  if (data.workPhone && data.personalPhone) {
    phoneText = `Work: ${data.workPhone} | Mobile: ${data.personalPhone}`;
  } else if (data.workPhone) {
    phoneText = `Work: ${data.workPhone}`;
  } else if (data.personalPhone) {
    phoneText = `Mobile: ${data.personalPhone}`;
  }

  const tdBase = [
    `-webkit-text-size-adjust: 100%`,
    `-ms-text-size-adjust: 100%`,
    `mso-table-lspace: 0pt`,
    `mso-table-rspace: 0pt`,
    `background-color: transparent`,
  ].join(";");

  const textTd = (extra = "") =>
    `${tdBase};color: #000000 !important;font-family: Inter, Arial, sans-serif;line-height: 1.4;padding: 0 0 3px 0;${extra}`;

  return `<table border="0" cellpadding="0" cellspacing="0" style="${tdBase};font-family: Arial, sans-serif;max-width: 400px;" width="100%">
  <tbody>
    <tr>
      <td style="${tdBase};padding: 0;margin: 0;">
        <table border="0" cellpadding="0" cellspacing="0" style="${tdBase};" width="100%">
          <tbody>
            <tr>
              <td style="${tdBase};padding: 0 0 3px 0;">
                <img src="https://wso2.cachefly.net/wso2/sites/all/image_resources/logos/wso2-orange-logo.png" alt="WSO2" width="100" style="-ms-interpolation-mode: bicubic;height: auto;outline: none;text-decoration: none;border: 0;display: block;">
              </td>
            </tr>
            <tr>
              <td style="${textTd("font-size: 13px;font-weight: 700;")}">
                <span style="color: #000000 !important;">${data.name}</span>
              </td>
            </tr>
            ${
              data.designation
                ? `<tr>
              <td style="${textTd("font-size: 12px;font-weight: 600;")}">
                <span style="color: #000000 !important;">${data.designation}, WSO2</span>
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

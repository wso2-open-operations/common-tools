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

import { describe, it, expect } from "vitest";
import { generateSignatureHTML } from "../signatureGenerator";
import type { SignatureData } from "../../types";

const base: SignatureData = {
  name: "Jane Doe",
  designation: "Senior Engineer",
  workPhone: "",
  personalPhone: "",
  medium: "",
  linkedin: "",
  customUrl: "",
  customUrlLabel: "",
};

describe("generateSignatureHTML", () => {
  it("includes the WSO2 logo img tag", () => {
    const html = generateSignatureHTML(base);
    expect(html).toContain("wso2-orange-logo.png");
  });

  it("includes the person name", () => {
    const html = generateSignatureHTML(base);
    expect(html).toContain("Jane Doe");
  });

  it("appends ', WSO2' to designation", () => {
    const html = generateSignatureHTML(base);
    expect(html).toContain("Senior Engineer, WSO2");
  });

  it("includes orange HR divider", () => {
    const html = generateSignatureHTML(base);
    expect(html).toContain("#F14E23");
  });

  it("omits phone row when no phones provided", () => {
    const html = generateSignatureHTML(base);
    expect(html).not.toContain("Work:");
    expect(html).not.toContain("Mobile:");
  });

  it("shows work phone only when only work phone provided", () => {
    const html = generateSignatureHTML({ ...base, workPhone: "+94 77 555 0001" });
    expect(html).toContain("Work: +94 77 555 0001");
    expect(html).not.toContain("Mobile:");
  });

  it("shows mobile phone only when only personal phone provided", () => {
    const html = generateSignatureHTML({ ...base, personalPhone: "+94 77 555 0002" });
    expect(html).toContain("Mobile: +94 77 555 0002");
    expect(html).not.toContain("Work:");
  });

  it("shows both phones with pipe separator", () => {
    const html = generateSignatureHTML({
      ...base,
      workPhone: "+94 77 555 0001",
      personalPhone: "+94 77 555 0002",
    });
    expect(html).toContain("Work: +94 77 555 0001 | Mobile: +94 77 555 0002");
  });

  it("omits social row when no socials provided", () => {
    const html = generateSignatureHTML(base);
    expect(html).not.toContain('href="https://');
  });

  it("includes Medium link when medium provided", () => {
    const html = generateSignatureHTML({ ...base, medium: "https://medium.com/@jane" });
    expect(html).toContain('href="https://medium.com/@jane"');
    expect(html).toContain(">Medium<");
  });

  it("includes LinkedIn link when linkedin provided", () => {
    const html = generateSignatureHTML({ ...base, linkedin: "https://linkedin.com/in/jane" });
    expect(html).toContain('href="https://linkedin.com/in/jane"');
    expect(html).toContain(">LinkedIn<");
  });

  it("separates Medium and LinkedIn with pipe when both provided", () => {
    const html = generateSignatureHTML({
      ...base,
      medium: "https://medium.com/@jane",
      linkedin: "https://linkedin.com/in/jane",
    });
    expect(html).toContain("Medium</a> | <a");
  });

  it("includes custom URL with label when both provided", () => {
    const html = generateSignatureHTML({
      ...base,
      customUrl: "https://github.com/jane",
      customUrlLabel: "GitHub",
    });
    expect(html).toContain('href="https://github.com/jane"');
    expect(html).toContain(">GitHub<");
  });

  it("omits custom URL when only URL is provided without a label", () => {
    const html = generateSignatureHTML({ ...base, customUrl: "https://github.com/jane" });
    expect(html).not.toContain("https://github.com/jane");
  });

  it("omits custom URL when only label is provided without a URL", () => {
    const html = generateSignatureHTML({ ...base, customUrlLabel: "GitHub" });
    expect(html).not.toContain("GitHub");
  });

  it("appends custom link after LinkedIn with pipe separator", () => {
    const html = generateSignatureHTML({
      ...base,
      linkedin: "https://linkedin.com/in/jane",
      customUrl: "https://github.com/jane",
      customUrlLabel: "GitHub",
    });
    expect(html).toContain("LinkedIn</a> | <a");
    expect(html).toContain(">GitHub<");
  });
});

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
});

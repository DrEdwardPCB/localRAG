import { describe, expect, it } from "vitest";
import { extractTextFromHtml } from "./extractTextFromHtml.js";
import { SAMPLE_HTML_WITH_SCRIPT } from "../test/fixtures/htmlSamples.js";

describe("extractTextFromHtml", () => {
  it("strips scripts and returns visible text", () => {
    const t = extractTextFromHtml(SAMPLE_HTML_WITH_SCRIPT);
    expect(t).toContain("Hello");
    expect(t).toContain("world");
    expect(t).not.toMatch(/alert/);
  });
});

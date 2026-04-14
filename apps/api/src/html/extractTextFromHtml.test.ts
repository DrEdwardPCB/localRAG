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

  it("extracts text from a fragment without html/body wrapper", () => {
    expect(extractTextFromHtml("<p>Fragment <strong>ok</strong></p>")).toContain("Fragment");
    expect(extractTextFromHtml("<p>Fragment <strong>ok</strong></p>")).toContain("ok");
  });

  it("extracts text from article-only markup", () => {
    expect(extractTextFromHtml("<article><h1>T</h1><p>Body</p></article>")).toContain("T");
    expect(extractTextFromHtml("<article><h1>T</h1><p>Body</p></article>")).toContain("Body");
  });

  it("extracts plain text when there are no tags", () => {
    expect(extractTextFromHtml("Just plain words")).toBe("Just plain words");
  });
});

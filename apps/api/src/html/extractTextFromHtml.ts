import * as cheerio from "cheerio";

/**
 * Strip scripts/styles and return visible text from HTML (POC: no remote fetching).
 */
export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html, { xml: false });
  $("script, style, noscript").remove();
  const text = $("body").text() || $.root().text();
  return text.replace(/\s+/g, " ").trim();
}

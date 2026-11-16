import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { About } from "./About";
import { LGPL_COMPONENTS } from "./lgpl";

describe("the About page", () => {
  const html = renderToStaticMarkup(<About />);

  test("says the program includes JavaScriptCore and tinycc under the LGPL", () => {
    expect(html).toContain(
      "This program includes JavaScriptCore (WebKit) and tinycc, used under the GNU LGPL.",
    );
  });

  test("shows each library's copyright line", () => {
    expect(html).toContain(
      "JavaScriptCore (WebKit): Copyright the WebKit contributors",
    );
    expect(html).toContain(
      "tinycc: Copyright Fabrice Bellard and the tinycc contributors",
    );
    for (const c of LGPL_COMPONENTS) expect(html).toContain(c.copyright);
  });

  test("links the notices file, which carries the licenses, source and relinking steps", () => {
    expect(html).toContain('href="/about/third-party-notices.txt"');
    expect(html).toContain("licenses, source and relinking steps");
  });
});

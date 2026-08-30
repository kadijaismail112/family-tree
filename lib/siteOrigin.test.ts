import { afterEach, describe, expect, it } from "vitest";
import { emailReturnUrl, siteOrigin } from "./siteOrigin";

const original = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("the origin an emailed link points at", () => {
  it("uses the configured canonical origin when there is one", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trydynasty.app";
    expect(siteOrigin()).toBe("https://www.trydynasty.app");
  });

  it("does not leave a trailing slash to double up on the path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trydynasty.app/";
    expect(emailReturnUrl("/auth/callback")).toBe(
      "https://www.trydynasty.app/auth/callback"
    );
  });

  it("ignores an empty or blank setting rather than building a relative link", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    // no window in this environment, so it falls through to empty
    expect(siteOrigin()).toBe("");
  });

  it("keeps the query string of the path it is given", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trydynasty.app";
    expect(emailReturnUrl("/auth/callback?next=%2Finvite%2Fabc")).toBe(
      "https://www.trydynasty.app/auth/callback?next=%2Finvite%2Fabc"
    );
  });
});

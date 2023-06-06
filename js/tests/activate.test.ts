import "isomorphic-fetch";

import { browser, progressStatus } from "../src/index";

describe("Checks activate", () => {
  test("Check activate", () => {
    expect(browser);
    expect(progressStatus);
  });
});

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { Navigate } from "react-router-dom";

import { RecurringPage } from "./recurring-page";

describe("recurring page compatibility route", () => {
  it("redirects into the transactions recurring tab", () => {
    const element = RecurringPage();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(Navigate);
    expect(element.props).toMatchObject({
      to: "/transactions?tab=recurring",
      replace: true,
    });
  });
});

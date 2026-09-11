import { describe, expect, it } from "vitest";

import {
  classifyDeviceDeclaration,
  describeDeviceMismatch,
  dispatchIsBlockedBy,
} from "./device-declaration";

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BETO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("classifyDeviceDeclaration — fail to the picker, never to a default", () => {
  it("treats an absent declaration as undeclared", () => {
    expect(classifyDeviceDeclaration(null, ANA)).toBe("undeclared");
  });

  it("treats an empty declaration as undeclared rather than as the operator", () => {
    // Clearing site data must re-ask. An empty string that fell through to a
    // match would silently pick whoever happened to be signed in.
    expect(classifyDeviceDeclaration("", ANA)).toBe("undeclared");
  });

  it("treats a whitespace-only declaration as undeclared", () => {
    expect(classifyDeviceDeclaration("   ", ANA)).toBe("undeclared");
  });

  it("reports a match when the device declares the signed-in operator", () => {
    expect(classifyDeviceDeclaration(ANA, ANA)).toBe("match");
  });

  it("reports a mismatch when the device declares the OTHER operator", () => {
    // The case the whole mechanism exists for: the bride signed in on the
    // groom's phone, so a guest would receive an invitation from someone they
    // may not know.
    expect(classifyDeviceDeclaration(BETO, ANA)).toBe("mismatch");
  });

  it("reports a mismatch for a declaration naming nobody we know", () => {
    expect(
      classifyDeviceDeclaration("cccccccc-cccc-4ccc-8ccc-cccccccccccc", ANA),
    ).toBe("mismatch");
  });

  it("ignores surrounding whitespace on an otherwise valid declaration", () => {
    expect(classifyDeviceDeclaration(` ${ANA} `, ANA)).toBe("match");
  });
});

describe("dispatchIsBlockedBy", () => {
  it("allows dispatch only on a match", () => {
    expect(dispatchIsBlockedBy("match")).toBe(false);
  });

  it("blocks dispatch on a mismatch", () => {
    expect(dispatchIsBlockedBy("mismatch")).toBe(true);
  });

  it("blocks dispatch while nothing has been declared", () => {
    expect(dispatchIsBlockedBy("undeclared")).toBe(true);
  });
});

describe("describeDeviceMismatch", () => {
  it("names both sides so the operator can see which assumption is wrong", () => {
    const message = describeDeviceMismatch({
      sessionDisplayName: "Ana Operadora",
      declaredDisplayName: "Beto Operador",
    });

    expect(message.heading).toContain("no coincide");
    expect(message.body).toContain("Ana Operadora");
    expect(message.body).toContain("Beto Operador");
  });

  it("explains that the app cannot choose the sending account", () => {
    const message = describeDeviceMismatch({
      sessionDisplayName: "Ana Operadora",
      declaredDisplayName: "Beto Operador",
    });

    expect(message.body).toContain("wa.me");
  });

  it("offers both exits and nothing that dismisses the block", () => {
    const message = describeDeviceMismatch({
      sessionDisplayName: "Ana Operadora",
      declaredDisplayName: "Beto Operador",
    });

    expect(message.exits.map((exit) => exit.href)).toEqual([
      "/console/device",
      "/console/auth/sign-out",
    ]);
    expect(message.exits).toHaveLength(2);
  });

  it("stays readable when the declared account no longer exists", () => {
    const message = describeDeviceMismatch({
      sessionDisplayName: "Ana Operadora",
      declaredDisplayName: null,
    });

    expect(message.body).toContain("Ana Operadora");
    expect(message.body).not.toContain("null");
  });
});

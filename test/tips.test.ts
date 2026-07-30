import { describe, it, expect, beforeEach } from "vitest";
import {
  getPersonalTip, setPersonalTip, getRecallPromptEnabled, setRecallPromptEnabled, checkRecall,
} from "../lib/tips";

beforeEach(() => {
  localStorage.clear();
});

describe("checkRecall", () => {
  it("accepts an exact match", () => {
    expect(checkRecall("to have", "to have")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(checkRecall("TO HAVE", "to have")).toBe(true);
  });

  it("accepts when the guess is contained in a multi-part answer", () => {
    expect(checkRecall("can", "can, to be able to")).toBe(true);
  });

  it("accepts when the answer is contained in a longer guess", () => {
    expect(checkRecall("it means can", "can")).toBe(true);
  });

  it("rejects an unrelated guess", () => {
    expect(checkRecall("house", "to have")).toBe(false);
  });

  it("rejects a blank guess", () => {
    expect(checkRecall("", "to have")).toBe(false);
    expect(checkRecall("   ", "to have")).toBe(false);
  });

  it("is umlaut/normalize-tolerant like the rest of the app", () => {
    expect(checkRecall("schoen", "schön")).toBe(true);
  });
});

describe("personal tips (sl:tips)", () => {
  it("is empty for a word with no note yet", () => {
    expect(getPersonalTip("de-0001")).toBe("");
  });

  it("saves and retrieves a note per item id", () => {
    setPersonalTip("de-0001", "sein = to be, like 'zen' state of being");
    expect(getPersonalTip("de-0001")).toBe("sein = to be, like 'zen' state of being");
    expect(getPersonalTip("de-0002")).toBe(""); // other items unaffected
  });

  it("trims whitespace", () => {
    setPersonalTip("de-0001", "  my note  ");
    expect(getPersonalTip("de-0001")).toBe("my note");
  });

  it("clearing the note (empty string) removes it entirely", () => {
    setPersonalTip("de-0001", "a note");
    setPersonalTip("de-0001", "");
    expect(getPersonalTip("de-0001")).toBe("");
    expect(JSON.parse(localStorage.getItem("sl:tips")!)).toEqual({});
  });

  it("clearing with only whitespace also removes it", () => {
    setPersonalTip("de-0001", "a note");
    setPersonalTip("de-0001", "   ");
    expect(getPersonalTip("de-0001")).toBe("");
  });
});

describe("recall prompt preference", () => {
  it("defaults to enabled", () => {
    expect(getRecallPromptEnabled()).toBe(true);
  });

  it("remembers being turned off", () => {
    setRecallPromptEnabled(false);
    expect(getRecallPromptEnabled()).toBe(false);
  });

  it("can be turned back on", () => {
    setRecallPromptEnabled(false);
    setRecallPromptEnabled(true);
    expect(getRecallPromptEnabled()).toBe(true);
  });
});

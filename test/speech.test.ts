import { describe, it, expect } from "vitest";
import { normalize, similarity, pickBestVoice, type VoiceOption } from "../lib/speech";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("HALLO Welt")).toBe("hallo welt");
  });

  it("maps umlauts to their digraphs", () => {
    expect(normalize("schön")).toBe("schoen");
    expect(normalize("Mädchen")).toBe("maedchen");
    expect(normalize("müde")).toBe("muede");
  });

  it("maps ß to ss", () => {
    expect(normalize("groß")).toBe("gross");
    expect(normalize("Straße")).toBe("strasse");
  });

  it("strips punctuation and German quote marks", () => {
    expect(normalize("Hallo, Welt!")).toBe("hallo welt");
    expect(normalize("„Guten Tag“")).toBe("guten tag");
    expect(normalize("Wie geht's?")).toBe("wie gehts");
    expect(normalize("(Test)")).toBe("test");
  });

  it("collapses whitespace and trims", () => {
    expect(normalize("  viel   Platz  ")).toBe("viel platz");
  });

  it("lets a typed digraph match the umlaut spelling", () => {
    expect(normalize("schoen")).toBe(normalize("schön"));
    expect(normalize("Strasse")).toBe(normalize("Straße"));
  });
});

describe("similarity", () => {
  it("is 1 when every target word is present", () => {
    expect(similarity("Ich habe Zeit", "Ich habe Zeit")).toBe(1);
  });

  it("still matches when extra words are said", () => {
    expect(similarity("Ich habe Zeit", "Ja, ich habe heute Zeit")).toBe(1);
  });

  it("is a fraction when only some words are present", () => {
    // "ich" hits, "habe" and "zeit" miss -> 1/3
    expect(similarity("Ich habe Zeit", "Ich bin da")).toBeCloseTo(1 / 3);
  });

  it("is 0 when nothing matches", () => {
    expect(similarity("Ich habe Zeit", "Komplett anders")).toBe(0);
  });

  it("is case- and umlaut-insensitive", () => {
    expect(similarity("Ich bin müde", "ICH BIN MUEDE")).toBe(1);
  });
});

describe("pickBestVoice", () => {
  const remote: VoiceOption = { voiceURI: "remote-1", name: "Google Deutsch", lang: "de-DE", localService: false };
  const local: VoiceOption = { voiceURI: "local-1", name: "Microsoft Katja", lang: "de-DE", localService: true };
  const localAustrian: VoiceOption = { voiceURI: "local-2", name: "Microsoft Hannah", lang: "de-AT", localService: true };
  const english: VoiceOption = { voiceURI: "en-1", name: "Samantha", lang: "en-US", localService: true };

  it("prefers a localService voice over a remote one", () => {
    const voices = [remote, local];
    expect(pickBestVoice(voices, "de-DE")).toBe(local);
  });

  it("honours a stored preference over the localService default", () => {
    const voices = [remote, local];
    expect(pickBestVoice(voices, "de-DE", "remote-1")).toBe(remote);
  });

  it("ignores a stored preference that isn't in the list, falling back to localService", () => {
    const voices = [remote, local];
    expect(pickBestVoice(voices, "de-DE", "does-not-exist")).toBe(local);
  });

  it("ignores a stored preference for a different language", () => {
    const voices = [remote, local, english];
    expect(pickBestVoice(voices, "de-DE", "en-1")).toBe(local);
  });

  it("falls back to the first matching voice when none are localService", () => {
    const remote2: VoiceOption = { voiceURI: "remote-2", name: "Google Deutsch 2", lang: "de-DE", localService: false };
    const voices = [remote, remote2];
    expect(pickBestVoice(voices, "de-DE")).toBe(remote);
  });

  it("matches by language prefix regardless of region/case", () => {
    const voices = [localAustrian, english];
    expect(pickBestVoice(voices, "de-DE")).toBe(localAustrian);
    expect(pickBestVoice(voices, "DE-de")).toBe(localAustrian);
  });

  it("never matches a voice for a different language", () => {
    const voices = [english];
    expect(pickBestVoice(voices, "de-DE")).toBeUndefined();
  });

  it("falls back sanely with an empty voice list", () => {
    expect(pickBestVoice([], "de-DE")).toBeUndefined();
    expect(pickBestVoice([], "de-DE", "some-uri")).toBeUndefined();
  });
});

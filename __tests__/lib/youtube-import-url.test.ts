// Importar do YouTube — validação/normalização do link (módulo puro) e utilitários.
import { describe, expect, it } from "vitest";
import { parseYoutubeUrl } from "@/lib/youtube-import/url";
import { formatClockDuration, isDurationMismatch, parseIsoDuration } from "@/lib/youtube-import/types";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeUrl — links aceitos", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`http://youtube.com/watch?v=${ID}&t=42s&list=PL123&si=abc`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`https://m.youtube.com/watch?feature=share&v=${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`youtube.com/watch?v=${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}?si=XyZ&t=10`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/shorts/${ID}`, "short", `https://www.youtube.com/shorts/${ID}`],
    [`https://youtube.com/shorts/${ID}?feature=share`, "short", `https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/live/${ID}?si=1`, "live", `https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/embed/${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`  https://WWW.YOUTUBE.COM/watch?v=${ID}#comentarios  `, "video", `https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com:443/watch?v=${ID}`, "video", `https://www.youtube.com/watch?v=${ID}`],
  ])("%s", (input, kind, normalized) => {
    expect(parseYoutubeUrl(input)).toEqual({ ok: true, kind, videoId: ID, normalizedUrl: normalized });
  });
});

describe("parseYoutubeUrl — links recusados", () => {
  it.each([
    "",
    "não é link",
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtu.be.evil.com/${ID}`,
    `https://user:senha@www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com:8080/watch?v=${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    `javascript:alert(1)//www.youtube.com/watch?v=${ID}`,
    "https://www.youtube.com/watch?v=curto",
    `https://www.youtube.com/watch?v=${ID}x`,
    "https://www.youtube.com/watch?v=../../etc/pas",
    "https://youtu.be/",
    `https://youtu.be/${ID}/extra`,
    "http://169.254.169.254/latest/meta-data",
    "http://localhost:3000/api/admin",
    `https://www.youtube.com/watch?v=${ID} https://evil.com`,
  ])("INVALID_URL: %s", (input) => {
    const parsed = parseYoutubeUrl(input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe("INVALID_URL");
  });

  it.each(["https://www.youtube.com/@canal", "https://www.youtube.com/playlist?list=PL123", "https://www.youtube.com/", "https://www.youtube.com/results?search_query=x"])(
    "UNSUPPORTED: %s",
    (input) => {
      const parsed = parseYoutubeUrl(input);
      expect(parsed).toMatchObject({ ok: false, code: "UNSUPPORTED" });
    },
  );
});

describe("duração", () => {
  it("converte ISO 8601 do YouTube", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT59S")).toBe(59);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("PT")).toBeNull();
    expect(parseIsoDuration("4:13")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });

  it("formata e compara durações", () => {
    expect(formatClockDuration(253)).toBe("04:13");
    expect(formatClockDuration(3723)).toBe("1:02:03");
    expect(formatClockDuration(null)).toBe("—");
    expect(isDurationMismatch(60, 62)).toBe(false);
    expect(isDurationMismatch(30, 253)).toBe(true);
    expect(isDurationMismatch(30, null)).toBe(false);
  });
});

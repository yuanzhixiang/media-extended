// apps/app/src/web/url-match/jsdelivr.ts

import type { TempFragment } from "@/lib/hash/temporal-frag";
import { noHashUrl } from "@/lib/url";
import { MediaHost } from "../../info/supported";
import {
  removeHashTempFragment,
  type URLDetecter,
  type URLResolver,
} from "./base";

function parseJsdelivrUrl(
  url: URL
): { path: string; type: "audio" | "video" | null } | null {
  if (
    url.hostname !== "cdn.jsdelivr.net" &&
    !url.hostname.endsWith(".jsdelivr.net")
  ) {
    return null;
  }

  // 检查文件扩展名
  const ext = url.pathname.split(".").pop()?.toLowerCase();
  let type: "audio" | "video" | null = null;

  // 音频文件扩展名
  if (["mp3", "wav", "ogg", "m4a"].includes(ext || "")) {
    type = "audio";
  }
  // 视频文件扩展名
  else if (["mp4", "webm", "ogv"].includes(ext || "")) {
    type = "video";
  }

  // 如果不是支持的媒体文件，返回 null
  if (!type) {
    return null;
  }

  return {
    path: url.pathname,
    type,
  };
}

export const jsdelivrDetecter: URLDetecter = (url) => {
  const result = parseJsdelivrUrl(url);
  if (result === null) return null;
  return MediaHost.Jsdelivr;
};

export const jsdelivrResolver: URLResolver = (url) => {
  const result = parseJsdelivrUrl(url);
  if (result === null) {
    throw new Error("Invalid jsdelivr url");
  }

  const cleaned = noHashUrl(url);
  if (cleaned.hostname === "jsdelivr.net") {
    cleaned.hostname = "cdn.jsdelivr.net";
  }

  let source = new URL(cleaned);
  source = removeHashTempFragment(source);

  return {
    source,
    cleaned,
    tempFrag: null,
    id: result.path,
    type: result.type,
  };
};

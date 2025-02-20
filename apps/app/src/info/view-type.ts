/* eslint-disable @typescript-eslint/naming-convention */
import { assertNever } from "assert-never";
import { Component, debounce } from "obsidian";
import { URLPattern } from "urlpattern-polyfill";
import type { FileMediaInfo, MediaInfo } from "@/info/media-info";
import type {
  MediaFileViewType,
  MediaViewType,
  RemoteMediaViewType,
} from "@/media-view/view-type";
import {
  MEDIA_URL_VIEW_TYPE,
  MEDIA_EMBED_VIEW_TYPE,
  MEDIA_WEBPAGE_VIEW_TYPE,
  MEDIA_FILE_VIEW_TYPE,
} from "@/media-view/view-type";
import type MxPlugin from "@/mx-main";
import { MediaURL } from "./media-url";
import { MediaHost } from "./supported";

export type URLMatchPattern =
  | {
      baseURL?: string;
      username?: string;
      password?: string;
      protocol?: string;
      hostname?: string;
      port?: string;
      pathname?: string;
      search?: string;
      hash?: string;
    }
  | string;

export class URLViewType extends Component {
  constructor(public plugin: MxPlugin) {
    super();
    this.#updateMatcher();
  }
  matcher!: Map<RemoteMediaViewType, URLPattern[]>;
  #updateMatcher() {
    this.matcher = new Map(
      Object.entries(this.plugin.settings.getState().linkHandler).map(
        ([k, v]) => [
          k as RemoteMediaViewType,
          v.map((init) => new URLPattern(init)),
        ],
      ),
    );
  }

  onload(): void {
    const requestUpdateMatcher = debounce(
      () => this.#updateMatcher(),
      500,
      true,
    );
    this.register(
      this.plugin.settings.subscribe((curr, p) => {
        if (curr.linkHandler === p.linkHandler) return;
        requestUpdateMatcher();
      }),
    );
  }

  getPreferred(url: MediaURL, noFallback: true): RemoteMediaViewType | null;
  getPreferred(url: MediaURL): RemoteMediaViewType;
  getPreferred(url: MediaURL, noFallback?: true): RemoteMediaViewType | null {
    const supported = this.getSupported(url);
    let matched: { type: RemoteMediaViewType; specifity: number } | null = null;
    for (const type of supported) {
      for (const matcher of this.matcher.get(type)!) {
        if (!matcher.test(url)) continue;
        const specifity = getSpecifity(matcher);
        if (!matched || specifity > matched.specifity) {
          matched = { type, specifity };
        }
      }
    }
    return matched?.type ?? (noFallback ? null : supported[0]);
  }
  setPreferred(pattern: URLMatchPattern, type: RemoteMediaViewType) {
    this.plugin.settings.getState().setLinkHandler(pattern, type);
  }

  getSupported(url: MediaURL): RemoteMediaViewType[];
  getSupported(url: FileMediaInfo): MediaFileViewType[];
  getSupported(url: MediaInfo): MediaViewType[];
  getSupported(url: MediaInfo): MediaViewType[] {
    if (!(url instanceof MediaURL)) {
      return [MEDIA_FILE_VIEW_TYPE[url.type]];
    }
    if (url.type === MediaHost.Generic) {
      switch (url.inferredType) {
        case "video":
          return [MEDIA_URL_VIEW_TYPE.video, MEDIA_WEBPAGE_VIEW_TYPE];
        case "audio":
          return [MEDIA_URL_VIEW_TYPE.audio, MEDIA_WEBPAGE_VIEW_TYPE];
        default:
          return [
            MEDIA_WEBPAGE_VIEW_TYPE,
            MEDIA_URL_VIEW_TYPE.video,
            MEDIA_URL_VIEW_TYPE.audio,
          ];
      }
    }
    switch (url.type) {
      case MediaHost.YouTube:
      case MediaHost.Vimeo:
        return [MEDIA_WEBPAGE_VIEW_TYPE, MEDIA_EMBED_VIEW_TYPE];
      case MediaHost.Bilibili:
      case MediaHost.Coursera:
        return [MEDIA_WEBPAGE_VIEW_TYPE];
      case MediaHost.Jsdelivr:
        const ext = url.pathname.split('.').pop()?.toLowerCase();
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
          return [MEDIA_URL_VIEW_TYPE.audio];
        } else if (['mp4', 'webm', 'ogv'].includes(ext || '')) {
          return [MEDIA_URL_VIEW_TYPE.video];
        }
        return [MEDIA_WEBPAGE_VIEW_TYPE];
      default:
        assertNever(url.type);
    }
  }
}

function getSpecifity(url: URLPattern) {
  return (
    [
      "protocol",
      "username",
      "password",
      "hostname",
      "port",
      "pathname",
      "search",
      "hash",
    ] as const
  ).reduce((score, prop) => {
    const value = url[prop];
    return score + (value !== "*" ? 1 : 0);
  }, 0);
}

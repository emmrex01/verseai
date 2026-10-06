import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl();
  const pages: [string, number][] = [
    ["/", 1],
    ["/pricing", 0.8],
    ["/tools/consistency-checker", 0.9],
    ["/tools/word-counter", 0.7],
    ["/privacy", 0.4],
    ["/terms", 0.2],
  ];
  return pages.map(([path, priority]) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority }));
}

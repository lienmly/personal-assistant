import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      // Google account avatars, served through Auth.js.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    // Journal uploads go through a server action, and the default cap is 1MB —
    // which a single phone photo clears before the browser has finished reading
    // it, and a ten-second clip clears outright. The client downscales photos to
    // ~1600px and records clips at ~1.5Mbps, so both normally land well under
    // this; the headroom is for the case where it can't (a browser without
    // canvas support falls back to the original file). The real ceiling is
    // `MAX_MEDIA_BYTES` in `lib/media-store.ts`, deliberately set below this one
    // so an oversized file is refused with a message rather than by a truncated
    // request.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;

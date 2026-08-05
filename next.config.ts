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
    // Journal photo uploads go through a server action, and the default cap is
    // 1MB — which a single phone photo clears before the browser has finished
    // reading it. The client downscales to ~1600px first and normally lands
    // under 500KB, so this is headroom for the case where it can't (a browser
    // without canvas support falls back to the original file). The real ceiling
    // is `MAX_PHOTO_BYTES` in `lib/photo-store.ts`, deliberately set below this
    // one so an oversized image is refused with a message rather than by a
    // truncated request.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;

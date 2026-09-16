import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA headers
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        // ホーム・カレンダー等の動的ページはブラウザ・CDNにキャッシュさせない
        source: "/(|home|today|session/:path*|day/:path*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;

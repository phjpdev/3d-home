import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Bottom-left launcher (“N”) in dev — distracting over the 3D canvas */
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/EinsteinHouseDone.glb",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  /**
   * Dev tunneling (ngrok / Cloudflare Tunnel): browsers hit a public HTTPS origin while
   * `next dev` still listens on localhost. Next blocks those cross-origin `_next/` fetches
   * and webpack-hmr WS unless the tunnel host is listed here — otherwise chunks never load
   * (dynamic import stuck on “Preparing gallery…”).
   */
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;

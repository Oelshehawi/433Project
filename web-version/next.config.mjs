/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  images: {
    domains: ["localhost"],
  },
  webpack: (config) => {
    // Handle WebSocket connections
    config.externals = [
      ...(config.externals || []),
      {
        bufferutil: "bufferutil",
        "utf-8-validate": "utf-8-validate",
      },
    ];
    return config;
  },
};

export default nextConfig;

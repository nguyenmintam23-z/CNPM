import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Giữ nguyên các thiết lập hiện có của BrewLite.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        // Không thêm `as: "*.css"` tại đây.
        // Turbopack cần giữ nguyên đuôi .module.css để tạo map tên class.
      },
    },
  },
};

export default nextConfig;

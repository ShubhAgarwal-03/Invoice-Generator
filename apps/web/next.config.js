// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//   distDir: '.next',
// }

// module.exports = nextConfig


/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep your existing config...
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        canvas: 'commonjs canvas',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
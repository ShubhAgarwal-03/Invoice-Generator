// const { composePlugins, withNx } = require('@nx/next');

// const nextConfig = {
//   nx: { svgr: false },
//   experimental: {
//     turbo: {
//       root: '../../',
//     },
//   },
// };

// const plugins = [withNx];
// module.exports = composePlugins(...plugins)(nextConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
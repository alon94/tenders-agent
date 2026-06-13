/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    i18n: {
          locales: ['he', 'en'],
          defaultLocale: 'he',
    },
};

module.exports = nextConfig;

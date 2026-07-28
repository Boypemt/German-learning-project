/** @type {import('next').NextConfig} */
const nextConfig = {
  // We serve plain static images (no next/image), so the image-optimization
  // pipeline (sharp/libvips) is disabled entirely — removes its attack surface.
  images: { unoptimized: true },
};

export default nextConfig;

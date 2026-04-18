"use client";

import dynamic from "next/dynamic";

const PixelVisualizer = dynamic(
  () => import("@/components/PixelVisualizer"),
  { ssr: false }
);

export default function Home() {
  return <PixelVisualizer />;
}

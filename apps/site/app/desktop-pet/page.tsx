import type { Metadata } from "next";

import { DesktopPetApp } from "@/components/desktop-pet-app";

export const metadata: Metadata = {
  title: "Garden Lab Pet",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesktopPetPage() {
  return <DesktopPetApp />;
}

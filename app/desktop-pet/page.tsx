import type { Metadata } from "next";

import { DesktopPetApp } from "@/components/desktop-pet-app";

export const metadata: Metadata = {
  title: "Blog Pet",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesktopPetPage() {
  return <DesktopPetApp />;
}

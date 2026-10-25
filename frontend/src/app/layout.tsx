import "@/styles/globals.css";
import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { GlobalPlayer } from "@/components/player/GlobalPlayer";

export const metadata = {
  title: "Fombo Music AI — Production-Grade AI Music Studio & DAW",
  description:
    "High-fidelity AI audio generation, custom composition, stem separation, and browser multitrack DAW workstation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-studio-950 text-studio-100 min-h-screen antialiased selection:bg-neon-cyan/20 selection:text-neon-cyan">
        <AuthProvider>
          <AudioPlayerProvider>
            <div className="flex">
              <Sidebar />
              <div className="flex-1 ml-64 min-h-screen flex flex-col">
                <Topbar />
                <main className="flex-1 pt-16 pb-24 px-8 overflow-x-hidden">
                  {children}
                </main>
                <GlobalPlayer />
              </div>
            </div>
          </AudioPlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

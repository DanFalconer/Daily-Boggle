import type { Metadata } from "next";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
title: "Daily Boggle",
description: "A simple daily Boggle-like game (local only).",
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return (
<html lang="en">
<body>
        <div className="app-container">
          <header className="app-header">
            <div className="app-title">Daily Boggle</div>
            <div className="app-subtitle">
              One 2-minute round per day (local only)
            </div>
</header>
          <main className="app-main">{children}</main>
</div>
</body>
</html>
);
}
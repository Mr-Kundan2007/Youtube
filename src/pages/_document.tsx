import { Html, Head, Main, NextScript } from "next/document"

export default function Document() {
  const themeInitScript = `
    (function() {
      try {
        var raw = localStorage.getItem("youtube_theme_settings");
        var mode = "automatic";
        var activeTheme = null;
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              mode = parsed.themeMode || "automatic";
              if (parsed.activeTheme === "light" || parsed.activeTheme === "dark") {
                activeTheme = parsed.activeTheme;
              }
            }
          } catch(e) {}
        }
        if (mode === "light") {
          activeTheme = "light";
        } else if (mode === "dark") {
          activeTheme = "dark";
        } else {
          // Automatic mode based on Indian Standard Time (Asia/Kolkata, UTC+5:30)
          var now = new Date();
          var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
          var ist = new Date(utc + (5.5 * 3600000));
          var hour = ist.getHours();
          // 5:00 AM IST to 11:59 AM IST => Light, otherwise Dark
          activeTheme = (hour >= 5 && hour < 12) ? "light" : "dark";
        }

        var root = document.documentElement;
        if (activeTheme === "dark") {
          root.classList.add("dark");
          root.setAttribute("data-theme", "dark");
          root.style.colorScheme = "dark";
        } else {
          root.classList.remove("dark");
          root.setAttribute("data-theme", "light");
          root.style.colorScheme = "light";
        }
      } catch (err) {
        // Fallback gracefully without breaking page render
      }
    })();
  `

  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </Head>
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)]">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

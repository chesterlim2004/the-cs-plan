import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        surface: "#101214",
        panel: "#16191d",
        line: "#252a31",
        muted: "#8f98a3"
      }
    }
  },
  plugins: []
} satisfies Config;

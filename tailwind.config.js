/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        forest: {
          950: "#153B2D",
          900: "#194936",
          850: "#204F3D",
          800: "#245C45",
          700: "#347158",
          600: "#66826B",
        },
      },
    },
  },
  plugins: [],
};

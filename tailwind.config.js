module.exports = {
  purge: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: false, // or 'media' or 'class'
  theme: {
    fontFamily: {
      sans: ["Montserrat"],
    },
    extend: {
      colors: {
        megaplex: "#591c6b",
        "megaplex-tint": "#60346d",
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}

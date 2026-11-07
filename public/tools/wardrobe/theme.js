(() => {
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
  function updateTheme() {
    document.documentElement.dataset.theme = darkMode.matches ? "dark" : "light";
  }
  updateTheme();
  darkMode.addEventListener("change", updateTheme);
})();

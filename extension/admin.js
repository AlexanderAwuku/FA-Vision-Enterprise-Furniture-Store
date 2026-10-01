// Tells the FA Vision admin that the add-on is installed (price sync + autopilot).
const mark = () => {
  document.documentElement.dataset.favsyncExt = "1";
  document.documentElement.dataset.favautoExt = "2";
};
if (document.documentElement) mark(); else document.addEventListener("readystatechange", mark, { once: true });

// Tells the FA Vision admin that the sync add-on is installed.
const mark = () => { document.documentElement.dataset.favsyncExt = "1"; };
if (document.documentElement) mark(); else document.addEventListener("readystatechange", mark, { once: true });

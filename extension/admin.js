// Runs on the FA Vision admin: tells the page the add-on is installed, and
// passes jobs from the autopilot screen (Facebook and Instagram) to the add-on.
const mark = () => {
  document.documentElement.dataset.favsyncExt = "1";
  document.documentElement.dataset.favautoExt = "4";   // 4 = can post on Instagram
};
if (document.documentElement) mark(); else document.addEventListener("readystatechange", mark, { once: true });

window.addEventListener("message", e => {
  if (e.source !== window || e.origin !== location.origin || !e.data || e.data.type !== "favauto-start") return;
  chrome.runtime.sendMessage({ type: "start", url: e.data.url, job: e.data.job }, r => {
    if (!r || !r.ok) window.postMessage({ type: "favauto-start-failed" }, location.origin);
  });
});

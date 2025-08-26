const urls = [
  "https://www.linkedin.com/in/yi-wu-75919035b/en/",
  "https://www.linkedin.com/in/bigyan-chhetri-395084266/",
  "https://www.linkedin.com/in/tehilah-sifa-bb5791344/"
];
document.getElementById("connectBtn").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ action: "connectMultiple", urls });
});

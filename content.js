function sendConnectionRequest() {
  const connectBtn = [...document.querySelectorAll("button")].find(
    (btn) => btn.innerText.trim() === "Connect"
  );

  if (connectBtn) {
    connectBtn.click();

    setTimeout(() => {
      const addNoteBtn = document.querySelector('button[aria-label="Add a note"]');
      if (addNoteBtn) {
        addNoteBtn.click();

        setTimeout(() => {
          const textarea = document.querySelector("textarea[name='message']");
          if (textarea) {
            textarea.value = "Hi, I’d love to connect with you!";
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }

          const sendBtn = [...document.querySelectorAll("button")].find(
            (btn) => btn.innerText.trim() === "Send"
          );
          if (sendBtn) sendBtn.click();
        }, 1000);
      }
    }, 1000);
  } else {
    console.log("No Connect button found on this profile.");
  }
}

sendConnectionRequest();

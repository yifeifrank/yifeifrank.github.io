(() => {
  "use strict";

  const AAD = new TextEncoder().encode("opportunity-research-desk-v1");
  const decode = value => {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(normalized);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  };
  const notFound = () => {
    document.title = "404 · Not Found";
    document.body.classList.add("locked");
    const screen = document.getElementById("private-lock-screen");
    if (screen) { screen.hidden = false; screen.textContent = "404 · Not Found"; }
  };

  async function unlock() {
    const encodedKey = location.hash.slice(1).trim().split("/", 1)[0];
    if (!encodedKey) return notFound();
    let keyBytes;
    try { keyBytes = decode(encodedKey); } catch { return notFound(); }
    if (keyBytes.byteLength !== 32) return notFound();
    try {
      const envelope = await fetch("data.enc.json", {cache: "no-store", credentials: "omit"}).then(response => {
        if (!response.ok) throw new Error("missing data");
        return response.json();
      });
      if (envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM") throw new Error("unsupported envelope");
      const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
      const plaintext = await crypto.subtle.decrypt(
        {name: "AES-GCM", iv: decode(envelope.nonce), additionalData: AAD},
        key,
        decode(envelope.ciphertext),
      );
      window.JOB_SEARCH_DATA = JSON.parse(new TextDecoder().decode(plaintext));
      window.PRIVATE_LINK_KEY = encodedKey;
      document.getElementById("private-lock-screen")?.remove();
      document.body.classList.remove("locked");
      const script = document.createElement("script");
      script.src = "app.js";
      script.defer = true;
      document.body.appendChild(script);
    } catch {
      notFound();
    } finally {
      keyBytes.fill(0);
    }
  }

  unlock();
})();

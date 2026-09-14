/**
 * Fit a portrait to the card. 512×512 is the size the game stores and shows.
 */
export const PORTRAIT_SIZE = 512;

export function isImageAvatar(url) {
  if (!url) return false;
  return /\/avatars\/[a-f0-9]+\.jpg(?:\?|$)/i.test(url) || /\.(png|jpe?g|webp)(?:\?|$)/i.test(url);
}

export function fileToPortrait(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that picture"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = PORTRAIT_SIZE;
        canvas.height = PORTRAIT_SIZE;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(PORTRAIT_SIZE / img.width, PORTRAIT_SIZE / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        ctx.drawImage(img, (PORTRAIT_SIZE - width) / 2, (PORTRAIT_SIZE - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("That file isn't a picture"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadPortrait(file) {
  const image = await fileToPortrait(file);
  const res = await fetch("/api/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!res.ok) throw new Error("Couldn't save that picture");
  const data = await res.json();
  if (!data?.url) throw new Error("Couldn't save that picture");
  return data.url;
}

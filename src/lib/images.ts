/** Reads an image file and shrinks it so a handful of photos fit in browser storage. */
export function fileToDataUrl(file: File, maxSide = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`We couldn’t read ${file.name}.`));
    reader.onload = () => {
      const src = String(reader.result);
      if (!file.type.startsWith("image/")) return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error(`${file.name} isn’t a picture we can open.`));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Photos from Unsplash come at whatever width the URL says. Ask for the width that is shown, as webp/jpeg at a sane quality,
 * so a card does not download a 1200px picture. Other sources (uploads, data URLs) are left alone.
 */
export function sizedPhoto(src: string, width: number): string {
  try {
    const u = new URL(src);
    if (u.hostname !== "images.unsplash.com") return src;
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", "70");
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "crop");
    return u.toString();
  } catch {
    return src;
  }
}

export function photoSrcSet(src: string, widths: number[]): string | undefined {
  const sized = widths.map((w) => `${sizedPhoto(src, w)} ${w}w`);
  return sized.length > 0 && sizedPhoto(src, widths[0]!) !== src ? sized.join(", ") : undefined;
}

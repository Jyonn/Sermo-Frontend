import QRCode from "qrcode";

export async function downloadFriendInviteImage(options: {
  link: string;
  title: string;
  space: string;
  validity: string;
  label: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  await document.fonts.ready;
  const font = getComputedStyle(document.body).fontFamily;
  const text = (value: string, y: number, size: number, color: string, bold = false) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${font}`;
    while (ctx.measureText(value).width > 880 && size > 20) {
      size -= 1;
      ctx.font = `${bold ? 700 : 400} ${size}px ${font}`;
    }
    ctx.fillStyle = color;
    ctx.fillText(value, 540, y);
  };
  ctx.fillStyle = "#f5f4ef";
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.roundRect(40, 40, 1000, 1360, 64);
  ctx.fill();
  ctx.textAlign = "center";
  text("Frienden 友间", 150, 34, "#087d60", true);
  text(options.title, 250, 48, "#182f27", true);
  text(options.space, 320, 30, "#65766e");
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, options.link, {
    errorCorrectionLevel: "H", margin: 4, width: 800,
    color: { dark: "#111827", light: "#ffffff" },
  });
  // Export a clean code without an avatar overlay to maximize scan reliability.
  ctx.drawImage(qr, 140, 390, 800, 800);
  text(options.label, 1250, 38, "#182f27", true);
  text(options.validity, 1320, 28, "#65766e");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("image_export_failed")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Frienden-friend-qr-${Date.now()}.png`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

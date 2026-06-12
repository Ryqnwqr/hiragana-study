export function launchConfetti(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Scale the backing store to the device pixel ratio so pieces stay crisp,
  // then work in CSS pixels for all the physics below.
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: 70 }, () => ({
    x: Math.random() * W,
    y: -10,
    r: Math.random() * 6 + 3,
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 4 + 2,
    color: ["#e06b8b", "#5ec98a", "#d4a847", "#6b9fe8", "#f09db8"][
      Math.floor(Math.random() * 5)
    ],
    alpha: 1,
  }));

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = false;

    for (const piece of pieces) {
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.vy += 0.13;
      piece.alpha -= 0.011;

      if (piece.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = piece.alpha;
        ctx.fillStyle = piece.color;
        ctx.beginPath();
        ctx.arc(piece.x, piece.y, piece.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (alive) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  draw();
}

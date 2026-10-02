// 今日成果卡：canvas 合成插畫＋情境＋天數，支援系統分享（LINE／IG），不支援就下載 PNG。
const W = 1080, H = 1350;
const FONT = '"PingFang TC","Noto Sans TC",system-ui,sans-serif';
const SERIF = '"Noto Serif TC","PingFang TC",serif';
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function seal(g, text, x, y, size, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-size / 2, -size / 2, size, size);
  g.strokeStyle = '#c23a2b'; g.lineWidth = 8; g.strokeRect(-size / 2, -size / 2, size, size);
  g.fillStyle = '#c23a2b'; g.font = `700 ${size * (text.length > 1 ? 0.36 : 0.62)}px ${SERIF}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 4);
  g.restore();
}

// info: { id3, day, date, titleZh, sub, streak, days, voice, said }
export async function makeCard(info) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f1e7'; g.fillRect(0, 0, W, H);
  const img = await loadImg(`img/${info.id3}.webp`);
  if (img) g.drawImage(img, 0, 0, W, 810);
  seal(g, '完成', W - 120, 110, 150, -0.2);
  if (info.said) seal(g, '說', W - 290, 120, 130, 0.14);
  g.fillStyle = '#1c1c1c'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = `600 36px ${FONT}`; g.fillStyle = '#7a7368'; g.fillText(`名句日日聽 · 第 ${info.day} 天 · ${info.date}`, 64, 900);
  g.font = `700 76px ${SERIF}`; g.fillStyle = '#1c1c1c'; g.fillText(info.titleZh, 64, 1000);
  g.font = `400 44px ${FONT}`; g.fillStyle = '#4a4540'; g.fillText(info.sub, 64, 1066);
  g.font = `700 44px ${FONT}`; g.fillStyle = '#c23a2b';
  g.fillText(`連續 ${info.streak} 天 · 累計 ${info.days} 天${info.voice ? ` · 開口 ${info.voice} 次` : ''}`, 64, 1170);
  g.font = `400 32px ${FONT}`; g.fillStyle = '#7a7368'; g.fillText('daily-quotes-365.pages.dev', 64, 1270);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

export async function shareCard(info) {
  const blob = await makeCard(info);
  if (!blob) return;
  const file = new File([blob], `名句日日聽-第${info.day}天.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '名句日日聽', text: `今天練完「${info.titleZh}」` }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

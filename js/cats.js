// 主題 → 背景圖 slug（bg/<slug>.webp）
export const CAT_BG = {
  '立志抱負': 'lizhi', '勤學讀書': 'qinxue', '惜時光陰': 'xishi', '友情知己': 'youqing',
  '親情家庭': 'qinqing', '愛情相思': 'aiqing', '離別鄉愁': 'libie', '山水自然': 'shanshui',
  '人生哲理': 'zheli', '修身品德': 'xiushen', '教育啟蒙': 'jiaoyu', '逆境勇氣': 'nijing',
};
export const bgFor = cat => `bg/${CAT_BG[cat] || 'generic'}.webp`;
export function setPageBg(url) {
  let el = document.getElementById('pageBg');
  if (!el) { el = document.createElement('div'); el.id = 'pageBg'; document.body.prepend(el); }
  const img = new Image();
  img.onload = () => { el.style.backgroundImage = `url("${url}")`; el.classList.add('show'); };
  img.onerror = () => { el.classList.remove('show'); };
  img.src = url;
}

import fs from 'fs';
import path from 'path';

// 定義覆蓋率摘要檔案與目標 Badge 檔案的路徑
const SUMMARY_PATH = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
const BADGE_PATH = path.join(process.cwd(), 'coverage-badge.svg');

try {
  // 檢查覆蓋率報告是否存在
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.error('❌ 找不到 coverage/coverage-summary.json，請先執行測試並產生覆蓋率報告。');
    process.exit(1);
  }

  // 讀取並解析 JSON 報告
  const data = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  const pct = data.total.statements.pct; // 取得總語句覆蓋率百分比
  const roundedPct = Math.round(pct); // 四捨五入至整數

  // 根據覆蓋率百分比決定 Badge 的顏色
  let color = '#e05d44'; // 預設紅色 (<60%)
  if (roundedPct >= 90) {
    color = '#31c854'; // 綠色
  } else if (roundedPct >= 80) {
    color = '#a4a61d'; // 黃綠色
  } else if (roundedPct >= 70) {
    color = '#dfb317'; // 黃色
  } else if (roundedPct >= 60) {
    color = '#fe7d37'; // 橘色
  }

  // 動態設定寬度與文字定位，確保顯示美觀
  const label = 'coverage';
  const valStr = `${roundedPct}%`;
  const leftWidth = 62;
  const rightWidth = valStr.length * 8 + 12; // 依文字長度動態調整右側寬度
  const totalWidth = leftWidth + rightWidth;

  // 產生 SVG Badge 內容
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${valStr}">
  <title>${label}: ${valStr}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${(leftWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${leftWidth * 10 - 120}">${label}</text>
    <text x="${(leftWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" textLength="${leftWidth * 10 - 120}">${label}</text>
    <text aria-hidden="true" x="${leftWidth * 10 + (rightWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${rightWidth * 10 - 120}">${valStr}</text>
    <text x="${leftWidth * 10 + (rightWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" textLength="${rightWidth * 10 - 120}">${valStr}</text>
  </g>
</svg>`;

  // 將 SVG 寫入目標檔案
  fs.writeFileSync(BADGE_PATH, svg);
  console.log(`✅ 成功產生測試覆蓋率 Badge (${valStr}) 於 ${BADGE_PATH}`);
} catch (err) {
  console.error('❌ 產生 Badge 時發生錯誤:', err.message);
  process.exit(1);
}

// @ts-check
/**
 * =====================================================================
 * 🧩 Dry-run 管線共用核心 (Pipeline Core)
 * =====================================================================
 * [技術] 集中 dry-run 管線與驗證腳本共用的純函式：
 *        - generateSlug:     檔名 slug 規則（單一事實來源，避免 scan 與 verify 各寫一份漂移）
 *        - getMockReview:    離線模擬樂評的 Markdown 模板
 *        - validateReleases: mock-releases.json 的 schema 驗證，壞資料要大聲失敗
 * [童趣] 這是魔法噴泉的「配方書」：小精靈跟檢查員都讀同一本，才不會各說各話！
 * =====================================================================
 */

/** 將字串轉為 URL 友善的 Slug 格式（與 GitBook 發布器一致） */
export function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    // 繁體中文註解：將減號置於字元類別末尾以代表字面減號，避免範圍解讀與不必要的斜線轉義
    .replace(/[^\w一-龥-]+/g, '')
    .replace(/--+/g, '-');
}

/**
 * 由 release 物件導出檔名 slug。
 * 邊界處理：名稱全為符號時 slug 會退化為 '' 或 '-'（例如 '!!!-???' → '-'），
 * 此時退回使用 release id，避免產生 '-.md' 這類無效檔名。
 */
export function releaseSlug(release) {
  const slug = generateSlug(`${release.primary_artist}-${release.name}`).replace(/^-+|-+$/g, '');
  return slug || release.id;
}

/** 模擬生成 AI 深度樂評（離線、確定性輸出） */
export function getMockReview(album) {
  return `![專輯封面](${album.image})

### 音樂靈魂的深度共振：${album.primary_artist}《${album.name}》模擬樂評

這是一篇由離線模擬器生成的樂評。針對 ${album.primary_artist} 的最新作品《${album.name}》進行音樂風格剖析。
本作品發行類型為 ${album.type === 'single' ? '單曲 (Single)' : '完整專輯 (Album)'}，共包含 ${album.total_tracks} 首曲目。
流派風格定位為：${album.artist_genres.join(', ') || '綜合拉丁風格'}。

#### 音樂性與風格剖析：模擬導聽
- **節奏編排**：傳統打擊樂與現代爵士和聲完美交融。
- **人聲展現**：歌手極富磁性的嗓音在變幻莫測的節奏中展現出高超的控制力。

#### 綜合總結與評分
情感評分：**9.2 / 10**

**《${album.name}》是一首充滿生命力的傑作。${album.primary_artist} 再次證明了他在該領域無可撼動的藝術地位。這不僅僅是聽覺的享受，更是心靈的洗禮！**

🎧 立即聆聽《${album.name}》：
[${album.url}](${album.url})
`;
}

/** 單筆 release 的必填欄位與型別規則 */
// 繁體中文註解：定義驗證規格的 JSDoc 元組型別，使 TypeScript 能正確推導 check 函式
/** @type {Array<[string, (v: any) => boolean, string]>} */
const RELEASE_FIELD_RULES = [
  ['id', (v) => typeof v === 'string' && v.length > 0, '必須是非空字串'],
  ['name', (v) => typeof v === 'string' && v.trim().length > 0, '必須是非空字串'],
  ['primary_artist', (v) => typeof v === 'string' && v.trim().length > 0, '必須是非空字串'],
  ['type', (v) => v === 'album' || v === 'single', '必須是 "album" 或 "single"'],
  ['total_tracks', (v) => Number.isInteger(v) && v > 0, '必須是正整數'],
  ['release_date', (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v), '必須是 YYYY-MM-DD 格式字串'],
  ['url', (v) => typeof v === 'string' && v.startsWith('http'), '必須是 http(s) 連結'],
  ['artist_genres', (v) => Array.isArray(v), '必須是陣列（可為空）']
];

/**
 * 驗證 releases 資料；任何問題都丟出帶有索引與欄位名稱的錯誤（大聲失敗）。
 * @param {unknown} releases - 解析後的 mock-releases.json 內容
 * @returns {Array} 通過驗證的 releases
 */
export function validateReleases(releases) {
  if (!Array.isArray(releases)) {
    throw new Error('mock releases 資料必須是 JSON 陣列');
  }

  if (releases.length === 0) {
    throw new Error('mock releases 陣列為空，管線沒有可處理的發行');
  }

  const problems = [];

  releases.forEach((release, index) => {
    if (typeof release !== 'object' || release === null) {
      problems.push(`releases[${index}] 不是物件`);
      return;
    }

    for (const [field, check, rule] of RELEASE_FIELD_RULES) {
      if (!check(release[field])) {
        problems.push(`releases[${index}].${field} ${rule}（目前值: ${JSON.stringify(release[field])}）`);
      }
    }
  });

  if (problems.length > 0) {
    throw new Error(`mock releases schema 驗證失敗:\n  - ${problems.join('\n  - ')}`);
  }

  return releases;
}

/** demo:verify 用來判斷「樂評內容沒壞掉」的必要標記 */
export const REVIEW_REQUIRED_MARKERS = [
  { label: '專輯封面圖片', build: () => '![專輯封面](' },
  { label: '樂評主標題', build: (r) => `### 音樂靈魂的深度共振：${r.primary_artist}《${r.name}》` },
  { label: '情感評分', build: () => '情感評分：' },
  { label: '聆聽連結', build: (r) => r.url }
];

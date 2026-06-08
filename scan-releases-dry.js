/**
 * =====================================================================
 * 🎮 離線模擬管線運行器 (Dry Run CLI Replay Orchestrator)
 * =====================================================================
 * [技術] 讀取本地 `data/mock-releases.json` 發行快照，模擬真實掃描流程。
 *        跳過實際的外部 API (Spotify / Gemini) 與 Git 遠端推送，
 *        在本地 `data/mock-gitbook` 中產生與更新測試檔案，確保 100% 離線可跑。
 * [童趣] 魔法音樂模擬噴泉：假裝小精靈出發去採集糖果，在小沙箱裡把故事寫在模擬魔法書上！
 * =====================================================================
 */
import fs from 'fs/promises';
import path from 'path';

// 定義本地模擬 GitBook 的沙箱目錄
const MOCK_GITBOOK_DIR = path.resolve('data/mock-gitbook');
const MOCK_RELEASES_DIR = path.join(MOCK_GITBOOK_DIR, 'new-releases');
const MOCK_SUMMARY_PATH = path.join(MOCK_GITBOOK_DIR, 'SUMMARY.md');
const MOCK_DATA_PATH = path.resolve('data/mock-releases.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 輔助函式：將字串轉為 URL 友善的 Slug 格式，需與 GitBook 發布器一致
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, '')
    .replace(/\-\-+/g, '-');
}

// 模擬生成 AI 深度樂評
function getMockReview(album) {
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

// 確保沙箱目錄存在
async function ensureSandboxStructure() {
  await fs.mkdir(MOCK_GITBOOK_DIR, { recursive: true });
  await fs.mkdir(MOCK_RELEASES_DIR, { recursive: true });

  // 1. 確保 README.md (沙箱首頁) 存在
  const readmePath = path.join(MOCK_GITBOOK_DIR, 'README.md');
  try {
    await fs.access(readmePath);
  } catch {
    const defaultReadme = `# 🏠 模擬 - 藝人新發行 AI 樂評中心\n\n這是一個由離線 Dry-run 模擬器生成的測試沙箱。`;
    await fs.writeFile(readmePath, defaultReadme, 'utf-8');
  }

  // 2. 確保 new-releases/README.md 存在，防範 SUMMARY.md 產生失效連結 (Broken Link)
  const releasesReadmePath = path.join(MOCK_RELEASES_DIR, 'README.md');
  try {
    await fs.access(releasesReadmePath);
  } catch {
    const defaultReleasesReadme = `# 🎵 模擬 - 最新藝人新發行樂評\n\n這裡收錄了所有模擬產生的最新專輯與單曲樂評。`;
    await fs.writeFile(releasesReadmePath, defaultReleasesReadme, 'utf-8');
  }

  // 3. 確保 SUMMARY.md 目錄大綱存在
  try {
    await fs.access(MOCK_SUMMARY_PATH);
  } catch {
    const defaultSummary = `# Table of contents\n\n* [🏠 首頁](README.md)\n* [🎵 最新藝人新發行樂評](new-releases/README.md)\n`;
    await fs.writeFile(MOCK_SUMMARY_PATH, defaultSummary, 'utf-8');
  }
}

// 更新目錄大綱
async function updateSandboxSummary(title, relativePath) {
  let summaryContent = await fs.readFile(MOCK_SUMMARY_PATH, 'utf-8');
  const linkEntry = `  * [${title}](${relativePath})`;

  if (summaryContent.includes(relativePath)) {
    return;
  }

  const lines = summaryContent.split('\n');
  const targetIndex = lines.findIndex(line => line.includes('new-releases/README.md'));

  if (targetIndex !== -1) {
    lines.splice(targetIndex + 1, 0, linkEntry);
    summaryContent = lines.join('\n');
  } else {
    summaryContent += `\n${linkEntry}`;
  }

  await fs.writeFile(MOCK_SUMMARY_PATH, summaryContent, 'utf-8');
}

async function main() {
  console.log('\x1b[36m🏁【開始執行 Spotify 關注藝人新發行掃描與 GitBook 同步模擬管線 (Dry Run)】\x1b[0m\n');
  
  try {
    // 1. 讀取模擬發行資料
    console.log('📡 [Spotify/Client] 正在從本地模擬資料庫獲取關注藝人清單...');
    await sleep(800);
    console.log('🔍 [Spotify/Scanner] 正在搜尋近 30 天內的新發行專輯與單曲...');
    await sleep(1000);

    const mockContent = await fs.readFile(MOCK_DATA_PATH, 'utf-8');
    const releases = JSON.parse(mockContent);

    console.log(`\n🎉 [Spotify/Scanner] 本批次模擬掃描完成！尋獲 \x1b[32m${releases.length}\x1b[0m 個近 30 天內的新發行！\n`);
    await sleep(500);

    // 確保模擬沙箱目錄完整
    await ensureSandboxStructure();

    let successCount = 0;

    // 2. 逐一模擬處理新發行
    for (let i = 0; i < releases.length; i++) {
      const album = releases[i];
      const title = `${album.primary_artist} - ${album.name}`;
      const slug = generateSlug(`${album.primary_artist}-${album.name}`) || album.id;
      
      console.log(`─────────────────────────────────────────────`);
      console.log(`📦 [${i + 1}/${releases.length}] 正在模擬處理: \x1b[33m${title}\x1b[0m`);
      console.log(`   - 類型: ${album.type} | 曲目: ${album.total_tracks} 首 | 日期: ${album.release_date}`);
      
      // 模擬 AI 生成時間
      console.log(`   ☁️  [Reviewer/Cloud] 正在呼叫雲端 Gemini 進行模擬分析...`);
      await sleep(1500); // 模擬生成延遲
      
      const reviewMarkdown = getMockReview(album);
      console.log(`   ✅ [Reviewer/Cloud] 雲端 Gemini 樂評模擬生成成功！`);

      // 寫入本地沙箱目錄
      const fileName = `${slug}.md`;
      const relativeFilePath = `new-releases/${fileName}`;
      const fullFilePath = path.join(MOCK_RELEASES_DIR, fileName);

      await fs.writeFile(fullFilePath, reviewMarkdown, 'utf-8');
      console.log(`   📝 [GitBook/Publisher] 成功將模擬樂評寫入沙箱: \x1b[34m${fullFilePath}\x1b[0m`);

      // 更新模擬目錄
      await updateSandboxSummary(title, relativeFilePath);
      console.log(`   🔗 [GitBook/Summary] 模擬目錄 SUMMARY.md 大綱更新成功！`);
      successCount++;
    }

    // 3. 模擬 GitOps 推送
    if (successCount > 0) {
      console.log(`\n─────────────────────────────────────────────`);
      console.log(`\n📡 [GitBook/GitOps] 正在偵測當前 Git 分支...`);
      await sleep(500);
      console.log(`   📍 當前分支為: \x1b[35mfeat/music-release-dashboard-dry-run\x1b[0m`);
      console.log(`   ➕ 正在將模擬 GitBook 變更加入暫存區...`);
      await sleep(400);
      console.log(`   💾 正在提交模擬變更: "docs(music): batch add ${successCount} mock reviews via dry run"...`);
      await sleep(600);
      console.log(`   🚀 正在推送至 GitHub 遠端倉庫 [origin/feat/music-release-dashboard-dry-run]...`);
      await sleep(1200);
      console.log(`   \x1b[32m🎉 [GitBook/GitOps] 模擬 GitOps 推送完成！已成功模擬遠端同步管線。\x1b[0m`);
    }

    console.log(`\n─────────────────────────────────────────────`);
    console.log(`🎉【模擬全流程執行完畢】`);
    console.log(`📊 掃描總數: ${releases.length} | 成功處理數: ${successCount}`);
    console.log(`💡 請至 \x1b[34mdata/mock-gitbook/\x1b[0m 目錄下查看模擬生成的 Markdown 文件與 SUMMARY.md 大綱！\n`);

  } catch (error) {
    console.error('\x1b[31m❌ 模擬執行過程中發生錯誤:\x1b[0m', error.message || error);
    process.exit(1);
  }
}

main();

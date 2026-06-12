/* global window, document */
import { test, expect } from '@playwright/test';

test.describe('Music Release Dashboard E2E Tests', () => {
  test('should load albums, fetch lyrics, and publish to social', async ({ page }) => {
    // 攔截獲取所有專輯的 API 請求，避免依賴本地 spotify-cache.json 導致 CI 環境失敗
    // 【小朋友解釋法】：
    // 在 GitHub 雲端測試中心是沒有這個快取檔案的，所以我們會製造一個「虛擬糖果櫃」(Mock Albums)，
    // 讓測試小人能順利看到專輯並點擊，測試就不會卡住當機囉！
    await page.route('**/api/api/albums', async (route) => {
      // 確保匹配正確的路徑
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-album-1',
            name: 'Mock Album 1',
            artistName: 'Mock Artist 1',
            release_date: '2026-06-01',
            image: 'https://example.com/cover.png'
          }
        ]),
      });
    });
    // 相容並包 /api/albums 的攔截
    await page.route('**/api/albums', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-album-1',
            name: 'Mock Album 1',
            artistName: 'Mock Artist 1',
            release_date: '2026-06-01',
            image: 'https://example.com/cover.png'
          }
        ]),
      });
    });

    // 攔截封面圖片請求，返回 1x1 像素透明 PNG，避免 html2canvas 載入懸掛或跨域失敗
    await page.route('https://example.com/cover.png', async (route) => {
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: transparentPng,
      });
    });

    // 1. 攔截 AI 歌詞 API 請求，返回模擬的雙語歌詞 Markdown 內容
    await page.route('**/api/lyrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: '### 歌曲介紹\n這是一首測試歌曲的意境。\n\n### 歌詞對照\n**Hello World**\n你好，世界\n\n**Antigravity Agent**\n無重力代理人'
        }),
      });
    });

    // 1.5 攔截專輯曲目 API，避免沒有 Spotify credentials 時載入失敗
    await page.route('**/api/albums/*/tracks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-track-1',
            name: 'Test Track 1',
            track_number: 1,
            duration_ms: 180000,
            uri: 'spotify:track:mock1',
            url: 'https://open.spotify.com/track/mock1'
          }
        ]),
      });
    });

    // 1.6 攔截專輯評論 API
    await page.route('**/api/review*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          introduction: '這是一張很棒的模擬專輯。',
          summary: '這是一首測試歌曲的意境'
        }),
      });
    });

    // 2. 攔截社群發佈 API 請求，返回模擬的 Job ID
    await page.route('**/api/social/publish', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId: 'mock-job-99999-abcdefg'
        }),
      });
    });

    // 3. 進入 Dashboard 首頁
    await page.goto('/');

    // 4. 驗證首頁載入，且顯示引導文字
    await expect(page.locator('text=請從左側選擇一張最新專輯')).toBeVisible();

    // 5. 點擊側邊欄的第一張專輯卡片
    const firstAlbumButton = page.locator('aside button').first();
    await expect(firstAlbumButton).toBeVisible();
    await firstAlbumButton.click();

    // 6. 驗證 URL 是否更新為帶有 /album/ 的路徑
    await expect(page).toHaveURL(/\/album\//);

    // 7. 驗證專輯頁：AlbumInfo 置中展示（不再有催促選歌的佔位卡）
    await expect(page.locator('text=專輯資訊')).toBeVisible();
    await expect(page.locator('text=專輯曲目清單')).toBeVisible();

    // 8. 點擊曲目清單的第一首歌曲以跳轉至單曲專屬路由
    const firstTrackBtn = page.locator('button:has-text("Test Track 1")');
    await expect(firstTrackBtn).toBeVisible();
    await firstTrackBtn.click();

    // 8.5 驗證 URL 是否更新為帶有 /song/ 的路徑
    await expect(page).toHaveURL(/\/song\//);

    // 9-10. 選歌即自動載入：模擬的雙語歌詞內容直接渲染，無需再按按鈕
    await expect(page.locator('text=這是一首測試歌曲的意境').first()).toBeVisible();
    await expect(page.locator('text=你好，世界').first()).toBeVisible();

    // 11. 點擊「發佈到社群」按鈕
    const publishBtn = page.locator('text=發佈到社群');
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // 12. 驗證發佈成功 Toast 訊息是否包含模擬的 JobId
    await expect(page.locator('text=發文已排程成功！JobId: mock-job').first()).toBeVisible();
  });

  test('XSS: malicious lyrics payload must render as inert text, never execute', async ({ page }) => {
    // 瀏覽器層級的 XSS 滲透驗證：把惡意 Markdown 餵進歌詞 API，
    // 確認 (a) 注入腳本沒有執行、(b) 內容以「純文字」呈現、(c) DOM 中沒有危險元素。
    // 單元測試（tests/markdown-renderer.test.js）鎖定轉譯器輸出字串；
    // 這條測試鎖定「真的進了 DOM 之後」的最終行為。

    // 任一 dialog（alert/confirm/prompt）出現都視為 XSS 成功 → 測試失敗
    let dialogFired = false;
    page.on('dialog', async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await page.route('**/api/albums', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-album-xss',
            name: 'XSS Probe Album',
            artistName: 'Evil Artist',
            release_date: '2026-06-01',
            image: 'https://example.com/cover.png'
          }
        ]),
      });
    });

    await page.route('https://example.com/cover.png', async (route) => {
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
    });

    await page.route('**/api/albums/*/tracks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-track-xss',
            name: 'XSS Track',
            track_number: 1,
            duration_ms: 180000,
            uri: 'spotify:track:xss1',
            url: 'https://open.spotify.com/track/xss1'
          }
        ]),
      });
    });

    await page.route('**/api/review*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ introduction: 'intro', summary: 'summary' }),
      });
    });

    // 惡意 payload：涵蓋 script、事件處理器注入、Markdown 各格式分支內的注入
    const maliciousMarkdown = [
      '### 歌曲介紹',
      '<script>window.__xssExecuted = true</script>',
      '<img src=x onerror="window.__xssExecuted = true">',
      '- **<svg onload="window.__xssExecuted = true">** list injection',
      '**<iframe src="javascript:window.__xssExecuted=true"></iframe>**',
      'normal line with <b onclick="window.__xssExecuted = true">bold</b>'
    ].join('\n');

    await page.route('**/api/lyrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: maliciousMarkdown }),
      });
    });

    await page.goto('/');
    await page.locator('aside button').first().click();
    await page.locator('button:has-text("XSS Track")').click();
    // 選歌即自動載入歌詞 — 惡意 payload 直接進入渲染管線

    // (a) 注入內容以「純文字」呈現在畫面上（轉義後的 <script> 是可見文字）
    await expect(page.getByText('window.__xssExecuted', { exact: false }).first()).toBeVisible();

    // (b) 注入的全域旗標不存在 → 沒有任何一條注入路徑被執行
    const xssExecuted = await page.evaluate(() => window.__xssExecuted);
    expect(xssExecuted).toBeUndefined();

    // (c) DOM 中不存在任何危險元素（事件處理器屬性、iframe、svg onload）
    const dangerousElementCount = await page.evaluate(
      () => document.querySelectorAll('img[onerror], svg[onload], iframe, [onclick]').length
    );
    expect(dangerousElementCount).toBe(0);

    // (d) 沒有任何 alert/confirm/prompt 出現
    expect(dialogFired).toBe(false);
  });

  // 共用的 API 攔截設定：讓 deep link 測試不依賴真實快取資料
  async function mockAlbumApis(page) {
    const album = {
      id: 'deeplink-album-1',
      name: 'Deep Link Album',
      artistName: 'Deep Link Artist',
      release_date: '2026-06-01',
      image: 'https://example.com/cover.png'
    };
    await page.route('**/api/albums', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([album]) });
    });
    await page.route('https://example.com/cover.png', async (route) => {
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
    });
    await page.route('**/api/albums/*/tracks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'deeplink-track-1', name: 'Deep Link Track', track_number: 1, duration_ms: 200000, uri: 'spotify:track:dl1', url: 'https://open.spotify.com/track/dl1' },
          { id: 'deeplink-track-2', name: 'Second Track', track_number: 2, duration_ms: 180000, uri: 'spotify:track:dl2', url: 'https://open.spotify.com/track/dl2' }
        ]),
      });
    });
    await page.route('**/api/review*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ introduction: 'intro', summary: 'sum' }) });
    });
    // 選歌會自動載入歌詞，deep link 測試也要攔截
    await page.route('**/api/lyrics', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: '### 自動載入\n深層連結的歌詞內容', source: 'lrclib', translated: false }) });
    });
  }

  test('deep link: opening /album/x/song/y directly renders the song page', async ({ page }) => {
    // 把分享連結貼給朋友：直接打開單曲 URL（不經過首頁點擊）必須能渲染
    await mockAlbumApis(page);
    await page.goto('/album/deeplink-album-1/song/deeplink-track-1');

    // 單曲面板渲染：音波出現、歌詞自動載入，且側欄曲目清單高亮對應歌曲
    // （timeout 放寬：vite 冷啟動首次轉換模組可能觸發依賴重新最佳化與整頁重載）
    await expect(page.getByTestId('waveform')).toHaveAttribute('data-seed', 'deeplink-track-1', { timeout: 15000 });
    await expect(page.locator('text=深層連結的歌詞內容').first()).toBeVisible();
    await expect(page.locator('h2:has-text("Deep Link Track")').first()).toBeVisible();
    // 不應出現 404 或骨架屏殘留
    await expect(page.getByTestId('track-not-found')).toHaveCount(0);
    await expect(page.getByTestId('song-page-skeleton')).toHaveCount(0);

    // provenance：LRCLIB 來源 → verified 徽章
    const badge = page.getByTestId('lyrics-source-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-tone', 'verified');
  });

  test('provenance: AI-recall lyrics show a neutral commentary badge', async ({ page }) => {
    // 誠實標示：當後端標記 source=llm-recall（無原文歌詞，僅有 AI 背景分析），UI 應呈現 neutral 徽章說明
    await mockAlbumApis(page);
    await page.route('**/api/lyrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: '### 歌詞說明\n⚠️ 找不到本首歌曲的可驗證歌詞來源。', source: 'llm-recall', translated: false })
      });
    });
    await page.goto('/album/deeplink-album-1/song/deeplink-track-1');

    const badge = page.getByTestId('lyrics-source-badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveAttribute('data-tone', 'neutral');
    await expect(badge).toContainText('無歌詞原文');
  });


  test('deep link 404: unknown trackId shows friendly fallback with other tracks', async ({ page }) => {
    // 過期/錯誤的分享連結：不能白屏，要推薦同專輯其他曲目
    await mockAlbumApis(page);
    await page.goto('/album/deeplink-album-1/song/this-track-does-not-exist');

    const notFound = page.getByTestId('track-not-found');
    await expect(notFound).toBeVisible({ timeout: 15000 });
    await expect(notFound.locator('text=找不到這首歌')).toBeVisible();

    // 推薦清單可點擊，導向存在的歌曲後正常渲染（歌詞自動載入）
    await notFound.locator('button:has-text("Deep Link Track")').click();
    await expect(page).toHaveURL(/song\/deeplink-track-1/);
    await expect(page.locator('text=深層連結的歌詞內容').first()).toBeVisible();
  });

  test('copy link: button copies the song deep link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockAlbumApis(page);
    await page.goto('/album/deeplink-album-1/song/deeplink-track-1');

    const copyBtn = page.locator('button:has-text("複製連結")');
    await expect(copyBtn).toBeVisible({ timeout: 15000 });
    await copyBtn.click();

    // UI 回饋切換為「已複製」
    await expect(page.locator('button:has-text("已複製")')).toBeVisible();

    // 剪貼簿內容是完整的歌曲深層連結
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/album/deeplink-album-1/song/deeplink-track-1');
  });

  test('keyboard nav + waveform: j/k switches tracks, each track gets its own deterministic waveform', async ({ page }) => {
    await mockAlbumApis(page);
    await page.goto('/album/deeplink-album-1/song/deeplink-track-1');

    // 音波渲染，且記下第一首歌的波形（rect 高度序列）
    const waveform = page.getByTestId('waveform');
    await expect(waveform).toHaveAttribute('data-seed', 'deeplink-track-1', { timeout: 15000 });
    const barsTrack1 = await waveform.locator('rect').evaluateAll(
      (rects) => rects.map((r) => r.getAttribute('height')).join(',')
    );

    // 按 j → 下一首（先等 React 以新 seed 重繪波形，再讀取，避免 race）
    await page.keyboard.press('j');
    await expect(page).toHaveURL(/song\/deeplink-track-2/);
    await expect(waveform).toHaveAttribute('data-seed', 'deeplink-track-2');

    // 第二首的波形與第一首不同（每首歌有自己的指紋）
    const barsTrack2 = await waveform.locator('rect').evaluateAll(
      (rects) => rects.map((r) => r.getAttribute('height')).join(',')
    );
    expect(barsTrack2).not.toBe(barsTrack1);

    // 按 k → 回上一首，波形回到第一首的樣子（確定性）
    await page.keyboard.press('k');
    await expect(page).toHaveURL(/song\/deeplink-track-1/);
    await expect(waveform).toHaveAttribute('data-seed', 'deeplink-track-1');
    const barsBack = await waveform.locator('rect').evaluateAll(
      (rects) => rects.map((r) => r.getAttribute('height')).join(',')
    );
    expect(barsBack).toBe(barsTrack1);

    // 邊界：第一首再按 k 不動（不會掉出懸崖）
    await page.keyboard.press('k');
    await expect(page).toHaveURL(/song\/deeplink-track-1/);
  });

  test('mobile: two-level back navigation (song -> album -> list)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 級寬度
    await mockAlbumApis(page);
    await page.goto('/album/deeplink-album-1/song/deeplink-track-1');

    // 歌曲頁：返回鍵顯示「返回專輯」
    const backToAlbum = page.locator('button[aria-label="返回專輯"]');
    await expect(backToAlbum).toBeVisible({ timeout: 15000 });
    await backToAlbum.click();

    // 第一層：回到專輯頁（URL 不含 /song/，顯示置中的專輯資訊）
    await expect(page).toHaveURL(/\/album\/deeplink-album-1$/);
    await expect(page.locator('text=專輯資訊')).toBeVisible();

    // 第二層：返回鍵變成「返回列表」，點擊回到專輯清單（手機上 Sidebar 重新出現）
    const backToList = page.locator('button[aria-label="返回列表"]');
    await expect(backToList).toBeVisible();
    await backToList.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('text=Latest Releases')).toBeVisible();
  });

  test('OG meta: backend share endpoint serves crawler-readable tags', async ({ request }) => {
    // 直接打後端（:3011）：爬蟲視角 — 不執行 JS，只看門口海報
    const response = await request.get('http://localhost:3011/album/og-unknown-album');
    expect(response.status()).toBe(404); // 未知專輯 → 404 + 通用 meta
    const html = await response.text();
    expect(html).toContain('og:site_name');
    expect(html).toContain('og:title');
    expect(html).toContain('http-equiv="refresh"'); // 真人仍會被導向 SPA
  });
});

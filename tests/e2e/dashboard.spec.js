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

    // 7. 驗證專輯明細面板已載入，且右側顯示引導選擇單曲的佔位文字
    await expect(page.locator('text=請從左側曲目清單中選擇一首歌曲以開始 AI 雙語歌詞與音樂賞析')).toBeVisible();

    // 8. 點擊曲目清單的第一首歌曲以跳轉至單曲專屬路由
    const firstTrackBtn = page.locator('button:has-text("Test Track 1")');
    await expect(firstTrackBtn).toBeVisible();
    await firstTrackBtn.click();

    // 8.5 驗證 URL 是否更新為帶有 /song/ 的路徑
    await expect(page).toHaveURL(/\/song\//);

    // 9. 驗證「尋找歌詞與 AI 翻譯」按鈕已在右側面板顯示並點擊
    const fetchLyricsBtn = page.locator('text=尋找歌詞與 AI 翻譯');
    await expect(fetchLyricsBtn).toBeVisible();
    await fetchLyricsBtn.click();

    // 10. 驗證模擬的雙語歌詞內容是否渲染出來
    await expect(page.locator('text=這是一首測試歌曲的意境').first()).toBeVisible();
    await expect(page.locator('text=你好，世界').first()).toBeVisible();

    // 11. 點擊「發佈到社群」按鈕
    const publishBtn = page.locator('text=發佈到社群');
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // 12. 驗證發佈成功 Toast 訊息是否包含模擬的 JobId
    await expect(page.locator('text=發文已排程成功！JobId: mock-job').first()).toBeVisible();
  });
});

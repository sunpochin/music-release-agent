/**
 * 契約 drift 測試 — lyrics handoff schema
 *
 * 單一事實來源在 ../lyrics-vault-service/contracts/lyrics-handoff.schema.json，
 * 本 repo 持有副本（contracts/lyrics-handoff.schema.json）供內建 mock 與
 * verify 腳本離線使用。兩檔內容若漂移，這裡會抓到。
 * 姊妹 repo 不存在時（evaluator 只 clone 本 repo）跳過比對、只驗證副本可用。
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadLyricsHandoffSchema, validateAgainstDefinition } from '../../src/services/contract-validator.js';

const sisterSchemaPath = path.resolve('..', 'lyrics-vault-service', 'contracts', 'lyrics-handoff.schema.json');

describe('lyrics handoff 契約副本', () => {
  it('副本可載入且包含全部 definitions', () => {
    const schema = loadLyricsHandoffSchema();
    for (const name of ['lyricsRequest', 'lyricsResponse', 'clearRequest', 'clearResponse', 'healthResponse', 'errorResponse']) {
      expect(schema.definitions[name], `missing definition: ${name}`).toBeDefined();
    }
  });

  it('核心 proxy 的轉發請求通過 lyricsRequest 契約', () => {
    const schema = loadLyricsHandoffSchema();
    const outbound = { artistName: 'A', trackName: 'B', trackId: null, translate: true, refresh: false };
    expect(validateAgainstDefinition(schema, 'lyricsRequest', outbound).valid).toBe(true);
  });

  it.skipIf(!fs.existsSync(sisterSchemaPath))(
    '與姊妹 repo 的單一事實來源內容一致（drift 偵測）',
    () => {
      const local = JSON.parse(fs.readFileSync(path.resolve('contracts', 'lyrics-handoff.schema.json'), 'utf-8'));
      const sister = JSON.parse(fs.readFileSync(sisterSchemaPath, 'utf-8'));
      expect(local).toEqual(sister);
    }
  );
});

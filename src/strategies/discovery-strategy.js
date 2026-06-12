/**
   * 新發行探索策略之抽象基底類別 (ReleaseDiscoveryStrategy)
   * 遵循 OCP (開放封閉原則) 與 LSP (里氏代換原則)，所有具體策略必須實現 execute 介面。
   */
export class ReleaseDiscoveryStrategy {
  /**
   * 策略名稱描述 (例如: 'Spotify' 或 'MusicBrainz')
   * @type {string}
   */
  name = 'BaseStrategy';

  /**
   * 執行新發行探測的主入口
   * @param {object} artist - 藝人物件 { id, name, genres, uri, url }
   * @param {number} days - 追溯天數
   * @returns {Promise<Array<object>>} 正規化後的 NormalizedAlbum 陣列
   */
  async execute(_artist, _days) {
    throw new Error('execute() must be implemented by concrete strategies');
  }
}

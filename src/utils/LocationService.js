// src/utils/LocationService.js
// 位置情報を詳細な住所に変換するサービス
export class LocationService {
  constructor() {
    this.cache = new Map();
    this.lastRequestTime = 0;
    this.requestDelay = 1000; // 1秒に1回まで
  }

  // 緯度・経度から詳細住所を取得
  async getDetailedLocation(latitude, longitude) {
    console.log(`🔍 住所検索開始: ${latitude}, ${longitude}`);
    try {
      const cacheKey = this.getCacheKey(latitude, longitude);
      if (this.cache.has(cacheKey)) {
        const cachedAddress = this.cache.get(cacheKey);
        console.log(`📦 キャッシュから取得: ${cachedAddress}`);
        return cachedAddress;
      }

      await this.waitForRateLimit();
      const detailedAddress = await this.fetchFromNominatim(latitude, longitude);
      if (detailedAddress && detailedAddress !== '住所取得中') {
        this.cache.set(cacheKey, detailedAddress);
        console.log(`🌍 API取得成功: ${detailedAddress}`);
        return detailedAddress;
      }

      const basicArea = this.getBasicArea({ latitude, longitude });
      console.log(`⚠️ APIフォールバック: ${basicArea}`);
      return basicArea;
    } catch (error) {
      console.error('❌ 住所取得エラー:', error);
      return this.getBasicArea({ latitude, longitude });
    }
  }

  // Nominatim APIから住所を取得
  async fetchFromNominatim(latitude, longitude) {
    const url =
      `https://nominatim.openstreetmap.org/reverse?` +
      `format=json&lat=${latitude}&lon=${longitude}&` +
      `addressdetails=1&accept-language=ja&zoom=18`;
    console.log(`🌐 API呼び出し: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AttendanceApp/1.0'
      }
    });
    if (!response.ok) {
      throw new Error(`API エラー: ${response.status}`);
    }
    const data = await response.json();
    console.log('📄 APIレスポンス:', data);
    return this.formatJapaneseAddress(data);
  }

  // 日本の住所形式に変換
  formatJapaneseAddress(data) {
    if (!data || !data.address) return null;
    const addr = data.address;
    let formattedAddress = '';
    console.log('🔧 住所データ:', addr);

    if (addr.prefecture || addr.state) {
      formattedAddress += addr.prefecture || addr.state;
    }
    if (addr.city) {
      formattedAddress += addr.city;
    } else if (addr.town) {
      formattedAddress += addr.town;
    } else if (addr.village) {
      formattedAddress += addr.village;
    }
    if (addr.city_district) {
      formattedAddress += addr.city_district;
    }
    if (addr.suburb) {
      formattedAddress += addr.suburb;
    } else if (addr.district) {
      formattedAddress += addr.district;
    } else if (addr.quarter) {
      formattedAddress += addr.quarter;
    } else if (addr.neighbourhood) {
      formattedAddress += addr.neighbourhood;
    }

    console.log(`✅ 整形された住所: ${formattedAddress}`);
    return (
      formattedAddress ||
      this.getBasicArea({
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon)
      })
    );
  }

  // API呼び出し間隔制御（1秒待機）
  async waitForRateLimit() {
    const now = Date.now();
    const diff = now - this.lastRequestTime;
    if (diff < this.requestDelay) {
      const waitTime = this.requestDelay - diff;
      console.log(`⏳ ${waitTime}ms 待機中...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  // キャッシュ用キー生成
  getCacheKey(lat, lng, precision = 0.001) {
    const roundedLat = Math.round(lat / precision) * precision;
    const roundedLng = Math.round(lng / precision) * precision;
    return `${roundedLat.toFixed(4)},${roundedLng.toFixed(4)}`;
  }

  // フォールバック：粗い地域判定
  getBasicArea(location) {
    if (!location) return '不明';
    const lat = location.latitude;
    const lng = location.longitude;
    console.log(`🗾 基本地域判定: ${lat}, ${lng}`);

    if (lat >= 35.5 && lat <= 36.0 && lng >= 139.0 && lng <= 140.0) {
      if (lat >= 35.675 && lat <= 35.7 && lng >= 139.74 && lng <= 139.78) {
        return '東京都千代田区';
      } else if (lat >= 35.66 && lat <= 35.695 && lng >= 139.74 && lng <= 139.80) {
        return '東京都中央区';
      } else if (lat >= 35.63 && lat <= 35.68 && lng >= 139.72 && lng <= 139.76) {
        return '東京都港区';
      } else if (lat >= 35.685 && lat <= 35.72 && lng >= 139.68 && lng <= 139.73) {
        return '東京都新宿区';
      } else if (lat >= 35.65 && lat <= 35.685 && lng >= 139.68 && lng <= 139.72) {
        return '東京都渋谷区';
      } else {
        return '東京都';
      }
    } else if (lat >= 35.1 && lat <= 35.6 && lng >= 139.3 && lng <= 139.8) {
      return '神奈川県';
    } else if (lat >= 34.3 && lat <= 35.0 && lng >= 135.3 && lng <= 135.8) {
      return '大阪府';
    } else if (lat >= 24.0 && lat <= 46.0 && lng >= 123.0 && lng <= 146.0) {
      return '日本';
    } else {
      return '海外';
    }
  }

  // キャッシュクリア
  clearCache() {
    this.cache.clear();
    console.log('🗑️ キャッシュをクリアしました');
  }
  
  getCacheSize() {
    return this.cache.size;
  }
}
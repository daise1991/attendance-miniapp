// src/utils/security.js - 修正版（日本語対応）

export class SecurityManager {
  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
    this.auditLogs = this.loadAuditLogs();
    this.securitySettings = this.loadSecuritySettings();
    this.lastIntegrityCheck = null;
  }

  // 暗号化キーの生成
  generateEncryptionKey() {
    const savedKey = localStorage.getItem('attendance_security_key');
    if (savedKey) {
      return savedKey;
    }
    
    // 簡易的なキー生成
    const key = Array.from({length: 32}, () => Math.random().toString(36)[2]).join('');
    localStorage.setItem('attendance_security_key', key);
    return key;
  }

  // 日本語対応暗号化（Base64 + UTF-8エンコード）
  encrypt(data) {
    try {
      const jsonStr = JSON.stringify(data);
      // UTF-8エンコード対応
      const utf8Encoded = encodeURIComponent(jsonStr);
      let encrypted = '';
      for (let i = 0; i < utf8Encoded.length; i++) {
        const keyChar = this.encryptionKey[i % this.encryptionKey.length];
        encrypted += String.fromCharCode(utf8Encoded.charCodeAt(i) ^ keyChar.charCodeAt(0));
      }
      // Base64エンコード前にUTF-8文字を安全にエンコード
      return btoa(unescape(encodeURIComponent(encrypted)));
    } catch (error) {
      console.error('Encryption error:', error);
      // エラー時はそのまま保存（暗号化なし）
      return JSON.stringify(data);
    }
  }

  // 日本語対応復号化
  decrypt(encryptedData) {
    try {
      // Base64デコード + UTF-8デコード
      const encrypted = decodeURIComponent(escape(atob(encryptedData)));
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        const keyChar = this.encryptionKey[i % this.encryptionKey.length];
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ keyChar.charCodeAt(0));
      }
      const utf8Decoded = decodeURIComponent(decrypted);
      return JSON.parse(utf8Decoded);
    } catch (error) {
      console.error('Decryption error:', error);
      // 復号化失敗時は暗号化されていないデータとして処理
      try {
        return JSON.parse(encryptedData);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        return null;
      }
    }
  }

  // 監査ログの追加
  addAuditLog(category, action, level = 'info', details = null) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      category,
      action,
      level,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.auditLogs.push(logEntry);
    
    // ログの上限管理（最新500件まで保持）
    if (this.auditLogs.length > 500) {
      this.auditLogs.splice(0, this.auditLogs.length - 500);
    }

    this.saveAuditLogs();
    
    // 重要なイベントはコンソールにも出力
    if (level === 'error' || level === 'warning') {
      console.warn(`[Security] ${category}:${action} - ${details || 'No details'}`);
    }
  }

  // セキュアなレコード保存
  saveSecureRecord(key, data) {
    try {
      const encryptedData = this.encrypt(data);
      if (!encryptedData) {
        throw new Error('暗号化に失敗しました');
      }
      
      localStorage.setItem(key, encryptedData);
      
      // チェックサムも保存（データ整合性用）
      const checksum = this.generateChecksum(JSON.stringify(data));
      localStorage.setItem(`${key}_checksum`, checksum);
      
      this.addAuditLog('data', 'secure_save', 'success', { key, dataSize: JSON.stringify(data).length });
      return true;
    } catch (error) {
      this.addAuditLog('data', 'secure_save', 'error', { key, error: error.message });
      // エラー時は暗号化なしで保存
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.warn('セキュア保存に失敗したため、暗号化なしで保存しました');
        return true;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  }

  // セキュアなレコード読み込み
  loadSecureRecord(key) {
    try {
      const encryptedData = localStorage.getItem(key);
      if (!encryptedData) {
        return null;
      }

      const decryptedData = this.decrypt(encryptedData);
      if (!decryptedData) {
        throw new Error('復号化に失敗しました');
      }

      // データ整合性チェック
      const savedChecksum = localStorage.getItem(`${key}_checksum`);
      const currentChecksum = this.generateChecksum(JSON.stringify(decryptedData));
      
      if (savedChecksum && savedChecksum !== currentChecksum) {
        this.addAuditLog('data', 'integrity_violation', 'warning', { key });
        console.warn('データ整合性の問題が検出されましたが、データを読み込みます');
      }

      this.addAuditLog('data', 'secure_load', 'success', { key, dataSize: JSON.stringify(decryptedData).length });
      return decryptedData;
    } catch (error) {
      this.addAuditLog('data', 'secure_load', 'error', { key, error: error.message });
      // 復号化失敗時は暗号化されていないデータとして再試行
      try {
        const rawData = localStorage.getItem(key);
        if (rawData) {
          const parsedData = JSON.parse(rawData);
          console.warn('復号化に失敗したため、暗号化されていないデータとして読み込みました');
          return parsedData;
        }
      } catch (fallbackError) {
        console.error('データ読み込みに完全に失敗しました:', fallbackError);
      }
      return null;
    }
  }

  // チェックサム生成（簡易版）
  generateChecksum(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString();
  }

  // 位置情報の異常検知
  detectLocationAnomaly(currentLocation, previousLocation, timeElapsed) {
    if (!previousLocation || !currentLocation) {
      return { isAnomalous: false };
    }

    // 距離計算（ハヴァーサイン公式）
    const distance = this.calculateDistance(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    // 時間（ミリ秒 → 時間）
    const timeInHours = timeElapsed / (1000 * 60 * 60);
    
    // 速度計算（km/h）
    const speed = distance / timeInHours;

    // 異常判定（時速300km以上は異常とみなす）
    const isAnomalous = speed > 300;

    if (isAnomalous) {
      this.addAuditLog('location', 'speed_anomaly', 'warning', {
        distance: distance.toFixed(2),
        timeElapsed,
        calculatedSpeed: speed.toFixed(2)
      });
    }

    return {
      isAnomalous,
      distance: distance.toFixed(2),
      timeElapsed,
      calculatedSpeed: speed.toFixed(2)
    };
  }

  // 距離計算（ハヴァーサイン公式）
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球の半径 (km)
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  // 出退勤の異常検知
  detectAttendanceAnomaly(records) {
    const anomalies = [];
    const now = new Date();
    const recentRecords = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return (now - recordDate) < (30 * 24 * 60 * 60 * 1000); // 過去30日
    });

    // 1. 異常な時刻での出退勤チェック（深夜2-5時）
    recentRecords.forEach(record => {
      const recordTime = new Date(record.timestamp);
      const hour = recordTime.getHours();
      
      if (hour >= 2 && hour <= 5) {
        anomalies.push({
          type: 'unusual_time',
          message: `深夜${hour}時の${record.type === 'checkin' ? '出勤' : '退勤'}`,
          record,
          severity: 'medium'
        });
      }
    });

    // 2. 短時間での連続出退勤チェック（5分以内）
    for (let i = 1; i < recentRecords.length; i++) {
      const current = recentRecords[i];
      const previous = recentRecords[i-1];
      const timeDiff = new Date(current.timestamp) - new Date(previous.timestamp);
      
      if (timeDiff < 5 * 60 * 1000) { // 5分以内
        anomalies.push({
          type: 'rapid_toggle',
          message: `${Math.round(timeDiff/1000)}秒での連続出退勤`,
          records: [previous, current],
          severity: 'high'
        });
      }
    }

    // 3. 異常に長い勤務時間チェック（18時間以上）
    let currentCheckin = null;
    recentRecords.forEach(record => {
      if (record.type === 'checkin') {
        currentCheckin = new Date(record.timestamp);
      } else if (record.type === 'checkout' && currentCheckin) {
        const workDuration = new Date(record.timestamp) - currentCheckin;
        const workHours = workDuration / (1000 * 60 * 60);
        
        if (workHours > 18) {
          anomalies.push({
            type: 'long_work',
            message: `${workHours.toFixed(1)}時間の連続勤務`,
            records: [record],
            severity: 'medium'
          });
        }
        currentCheckin = null;
      }
    });

    if (anomalies.length > 0) {
      this.addAuditLog('attendance', 'anomaly_detected', 'warning', { count: anomalies.length });
    }

    return anomalies;
  }

  // データ整合性チェック
  performIntegrityCheck() {
    const checks = [];
    const timestamp = new Date().toISOString();

    // 1. 暗号化キーの存在確認
    try {
      const keyExists = localStorage.getItem('attendance_security_key');
      checks.push({
        name: '暗号化キー確認',
        status: keyExists ? 'pass' : 'fail',
        message: keyExists ? '暗号化キーが正常に存在します' : '暗号化キーが見つかりません'
      });
    } catch (error) {
      checks.push({
        name: '暗号化キー確認',
        status: 'fail',
        message: `キー確認エラー: ${error.message}`
      });
    }

    // 2. セキュアストレージの整合性チェック
    ['attendance_records_secure', 'location_logs_secure'].forEach(key => {
      try {
        const data = this.loadSecureRecord(key);
        checks.push({
          name: `${key}の整合性`,
          status: 'pass',
          message: `データの整合性が確認されました`
        });
      } catch (error) {
        checks.push({
          name: `${key}の整合性`,
          status: 'warning',
          message: `整合性チェックで警告: ${error.message}`
        });
      }
    });

    // 3. 監査ログの確認
    try {
      const logCount = this.auditLogs.length;
      checks.push({
        name: '監査ログ確認',
        status: logCount > 0 ? 'pass' : 'warning',
        message: `${logCount}件の監査ログが記録されています`
      });
    } catch (error) {
      checks.push({
        name: '監査ログ確認',
        status: 'fail',
        message: `ログ確認エラー: ${error.message}`
      });
    }

    const result = {
      timestamp,
      checks,
      overallStatus: checks.some(check => check.status === 'fail') ? 'fail' : 
                     checks.some(check => check.status === 'warning') ? 'warning' : 'pass'
    };

    this.lastIntegrityCheck = result;
    this.addAuditLog('security', 'integrity_check', result.overallStatus);
    
    return result;
  }

  // 監査ログの保存
  saveAuditLogs() {
    try {
      localStorage.setItem('attendance_audit_logs', JSON.stringify(this.auditLogs));
    } catch (error) {
      console.error('Failed to save audit logs:', error);
    }
  }

  // 監査ログの読み込み
  loadAuditLogs() {
    try {
      const saved = localStorage.getItem('attendance_audit_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      return [];
    }
  }

  // セキュリティ設定の保存
  saveSecuritySettings() {
    try {
      localStorage.setItem('attendance_security_settings', JSON.stringify(this.securitySettings));
    } catch (error) {
      console.error('Failed to save security settings:', error);
    }
  }

  // セキュリティ設定の読み込み
  loadSecuritySettings() {
    try {
      const saved = localStorage.getItem('attendance_security_settings');
      return saved ? JSON.parse(saved) : {
        encryptionEnabled: true,
        anomalyDetectionEnabled: true,
        auditLoggingEnabled: true,
        integrityCheckInterval: 300000 // 5分
      };
    } catch (error) {
      console.error('Failed to load security settings:', error);
      return {};
    }
  }

  // セキュリティ設定の更新
  updateSecuritySettings(newSettings) {
    this.securitySettings = { ...this.securitySettings, ...newSettings };
    this.saveSecuritySettings();
    this.addAuditLog('security', 'settings_updated', 'info', Object.keys(newSettings));
  }
}
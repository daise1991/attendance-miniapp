// src/utils/worldcoin.js - Worldcoin MiniKit管理クラス
export class WorldcoinManager {
  constructor() {
    this.miniKit = null;
    this.isInitialized = false;
    this.appId = process.env.REACT_APP_WORLDCOIN_APP_ID || 'app_staging_default';
    this.action = process.env.REACT_APP_WORLDCOIN_ACTION || 'attendance_app_auth';
    this.isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'development';
  }

  // MiniKit初期化
  async initialize() {
    try {
      if (typeof window === 'undefined') {
        console.warn('Server-side environment detected');
        return false;
      }

      // MiniKitの存在確認
      if (typeof window.MiniKit === 'undefined') {
        if (this.isDevelopment) {
          console.warn('🔧 開発環境: MiniKit未検出、モックモードで動作');
          this.isInitialized = true;
          return true;
        } else {
          throw new Error('MiniKit SDK が読み込まれていません');
        }
      }

      // MiniKit初期化
      this.miniKit = window.MiniKit;
      
      // MiniApp環境かチェック
      const isMiniApp = await this.checkMiniAppEnvironment();
      if (!isMiniApp && !this.isDevelopment) {
        throw new Error('この機能はWorldcoin MiniApp環境でのみ利用可能です');
      }

      await this.miniKit.install({
        appId: this.appId,
        action: this.action
      });

      this.isInitialized = true;
      console.log('✅ WorldCoin MiniKit 初期化完了');
      return true;

    } catch (error) {
      console.error('❌ MiniKit初期化エラー:', error);
      
      // 開発環境では初期化を続行
      if (this.isDevelopment) {
        this.isInitialized = true;
        return true;
      }
      
      throw error;
    }
  }

  // MiniApp環境チェック
  async checkMiniAppEnvironment() {
    try {
      if (!this.miniKit) return false;
      
      // User-Agentチェック
      const userAgent = navigator.userAgent;
      const isMiniApp = userAgent.includes('WorldApp') || userAgent.includes('MiniKit');
      
      // 追加の環境チェック
      const hasWalletFeatures = typeof this.miniKit.user === 'function';
      
      return isMiniApp || hasWalletFeatures;
    } catch (error) {
      console.error('環境チェックエラー:', error);
      return false;
    }
  }

  // World ID認証実行
  async verifyUser(signal = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 開発環境でのモック認証
      if (this.isDevelopment && !this.miniKit) {
        return this.createMockVerification();
      }

      if (!this.miniKit) {
        throw new Error('MiniKit が初期化されていません');
      }

      // 実際のWorld ID認証
      const verificationResult = await this.miniKit.verify({
        action: this.action,
        signal: signal || window.location.origin,
        verification_level: 'orb' // 'orb' または 'device'
      });

      if (!verificationResult.verified) {
        throw new Error('World ID認証に失敗しました');
      }

      // 認証成功時のユーザー情報作成
      const userInfo = {
        worldId: verificationResult.nullifier_hash,
        nullifierHash: verificationResult.nullifier_hash,
        merkleRoot: verificationResult.merkle_root,
        proof: verificationResult.proof,
        verificationLevel: 'orb',
        verified: true,
        verifiedAt: new Date().toISOString(),
        appId: this.appId,
        action: this.action
      };

      return userInfo;

    } catch (error) {
      console.error('❌ World ID認証エラー:', error);
      throw error;
    }
  }

  // 開発用モック認証
  createMockVerification() {
    const mockUser = {
      worldId: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nullifierHash: `mock_nullifier_${Date.now()}`,
      merkleRoot: 'mock_merkle_root',
      proof: 'mock_proof_data',
      verificationLevel: 'device',
      verified: true,
      verifiedAt: new Date().toISOString(),
      appId: this.appId,
      action: this.action,
      isDevelopmentMode: true
    };

    console.log('🔧 開発環境: モック認証を使用', mockUser);
    return mockUser;
  }

  // ユーザー情報取得
  async getCurrentUser() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isDevelopment && !this.miniKit) {
        // 開発環境で保存された認証情報を確認
        const stored = localStorage.getItem('worldid_user');
        return stored ? JSON.parse(stored) : null;
      }

      if (!this.miniKit || typeof this.miniKit.user !== 'function') {
        return null;
      }

      const user = await this.miniKit.user();
      return user;

    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
      return null;
    }
  }

  // サインアウト
  async signOut() {
    try {
      if (this.miniKit && typeof this.miniKit.signOut === 'function') {
        await this.miniKit.signOut();
      }
      
      // ローカルストレージクリア
      localStorage.removeItem('worldid_user');
      localStorage.removeItem('worldid_session');
      
      console.log('✅ World ID サインアウト完了');
      return true;

    } catch (error) {
      console.error('サインアウトエラー:', error);
      throw error;
    }
  }

  // 認証状態の確認
  isAuthenticated() {
    try {
      const stored = localStorage.getItem('worldid_user');
      if (!stored) return false;

      const user = JSON.parse(stored);
      
      // 認証の有効期限チェック（24時間）
      const verifiedAt = new Date(user.verifiedAt);
      const now = new Date();
      const hoursSinceVerification = (now - verifiedAt) / (1000 * 60 * 60);
      
      return hoursSinceVerification < 24 && user.verified;

    } catch (error) {
      console.error('認証状態確認エラー:', error);
      return false;
    }
  }

  // 認証情報の検証
  async validateAuthData(userData) {
    try {
      if (!userData || !userData.nullifierHash) {
        return false;
      }

      // 基本的な検証
      const requiredFields = ['worldId', 'nullifierHash', 'verified', 'verifiedAt'];
      const hasAllFields = requiredFields.every(field => userData[field] !== undefined);
      
      if (!hasAllFields) {
        return false;
      }

      // 開発環境ではより緩い検証
      if (this.isDevelopment && userData.isDevelopmentMode) {
        return true;
      }

      // 本番環境での追加検証
      if (userData.proof && userData.merkleRoot) {
        // 実際のproof検証は本番環境でのみ
        return true;
      }

      return false;

    } catch (error) {
      console.error('認証データ検証エラー:', error);
      return false;
    }
  }

  // デバッグ情報取得
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      hasMiniKit: !!this.miniKit,
      isDevelopment: this.isDevelopment,
      appId: this.appId,
      action: this.action,
      userAgent: navigator.userAgent,
      isAuthenticated: this.isAuthenticated()
    };
  }
}

// シングルトンインスタンス
export const worldcoinManager = new WorldcoinManager();
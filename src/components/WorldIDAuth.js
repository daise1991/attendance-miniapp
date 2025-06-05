// src/components/WorldIDAuth.js - World ID認証コンポーネント
import React, { useState, useEffect } from 'react';
import { worldcoinManager } from '../utils/worldcoin';

export const WorldIDAuth = ({ 
  onAuthSuccess, 
  onAuthError, 
  requireAuth = false,
  showCompactView = false 
}) => {
  const [authState, setAuthState] = useState('loading'); // 'loading', 'required', 'authenticated', 'error'
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState('loading');
      
      // Worldcoin Manager初期化
      await worldcoinManager.initialize();
      
      // 既存の認証状態確認
      const isAuth = worldcoinManager.isAuthenticated();
      if (isAuth) {
        const stored = localStorage.getItem('worldid_user');
        if (stored) {
          const user = JSON.parse(stored);
          const isValid = await worldcoinManager.validateAuthData(user);
          
          if (isValid) {
            setUserInfo(user);
            setAuthState('authenticated');
            onAuthSuccess?.(user);
            return;
          }
        }
      }

      // 認証が必要な場合
      if (requireAuth) {
        setAuthState('required');
      } else {
        setAuthState('optional');
      }

    } catch (error) {
      console.error('認証初期化エラー:', error);
      setError(error.message);
      setAuthState('error');
      onAuthError?.(error);
    }
  };

  const handleAuthenticate = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      // World ID認証実行
      const verificationResult = await worldcoinManager.verifyUser();
      
      // 認証データの検証
      const isValid = await worldcoinManager.validateAuthData(verificationResult);
      if (!isValid) {
        throw new Error('認証データの検証に失敗しました');
      }

      // 認証情報保存
      localStorage.setItem('worldid_user', JSON.stringify(verificationResult));
      localStorage.setItem('worldid_session', JSON.stringify({
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }));

      setUserInfo(verificationResult);
      setAuthState('authenticated');
      onAuthSuccess?.(verificationResult);

    } catch (error) {
      console.error('認証エラー:', error);
      setError(error.message);
      setAuthState('error');
      onAuthError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await worldcoinManager.signOut();
      setUserInfo(null);
      setAuthState(requireAuth ? 'required' : 'optional');
      setError(null);
    } catch (error) {
      console.error('サインアウトエラー:', error);
      setError('サインアウトに失敗しました');
    }
  };

  // コンパクトビュー（認証済み時の小さな表示）
  if (showCompactView && authState === 'authenticated') {
    return (
      <div className="worldid-compact">
        <div className="compact-status">
          <span className="verified-badge">✅ 認証済み</span>
          <span className="user-id">
            {userInfo?.isDevelopmentMode ? '開発' : 'ID'}: {userInfo?.worldId?.substring(0, 6)}...
          </span>
        </div>
      </div>
    );
  }

  // ローディング状態
  if (authState === 'loading') {
    return (
      <div className="worldid-loading">
        <div className="loading-animation">
          <div className="worldcoin-spinner">🌍</div>
        </div>
        <p>World ID システムを初期化中...</p>
      </div>
    );
  }

  // 認証済み状態
  if (authState === 'authenticated' && userInfo) {
    return (
      <div className="worldid-authenticated">
        <div className="auth-header">
          <div className="verification-badge">
            <span className="badge-icon">✅</span>
            <div className="badge-content">
              <h3>World ID 認証完了</h3>
              <p className="verification-level">
                {userInfo.verificationLevel === 'orb' ? '🔮 Orb認証' : '📱 デバイス認証'}
                {userInfo.isDevelopmentMode && ' (開発モード)'}
              </p>
            </div>
          </div>
        </div>

        <div className="auth-details">
          <div className="detail-row">
            <span className="label">World ID:</span>
            <span className="value">{userInfo.worldId?.substring(0, 12)}...</span>
          </div>
          <div className="detail-row">
            <span className="label">認証日時:</span>
            <span className="value">
              {new Date(userInfo.verifiedAt).toLocaleString('ja-JP')}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">ステータス:</span>
            <span className="value status-active">✅ アクティブ</span>
          </div>
        </div>

        <div className="auth-actions">
          <button 
            className="signout-button"
            onClick={handleSignOut}
          >
            🚪 サインアウト
          </button>
        </div>

        {/* セキュリティ情報 */}
        <div className="security-info">
          <h4>🔒 セキュリティ機能</h4>
          <ul>
            <li>✅ なりすまし防止</li>
            <li>✅ 位置偽装検知</li>
            <li>✅ データ完全性保証</li>
            <li>✅ 監査ログ記録</li>
          </ul>
        </div>
      </div>
    );
  }

  // エラー状態
  if (authState === 'error') {
    return (
      <div className="worldid-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>認証エラー</h3>
          <p className="error-message">{error}</p>
          
          <div className="error-actions">
            <button 
              className="retry-button"
              onClick={initializeAuth}
            >
              🔄 再試行
            </button>
          </div>

          {/* デバッグ情報（開発環境のみ） */}
          {process.env.NODE_ENV === 'development' && (
            <details className="debug-info">
              <summary>🔧 デバッグ情報</summary>
              <pre>{JSON.stringify(worldcoinManager.getDebugInfo(), null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  // 認証要求状態
  return (
    <div className="worldid-auth-prompt">
      <div className="prompt-header">
        <div className="worldcoin-logo">🌍</div>
        <h2>World ID認証</h2>
        <p className="prompt-subtitle">
          {requireAuth 
            ? '出退勤記録にはWorld ID認証が必要です' 
            : '認証により、より安全な出退勤記録が可能になります'
          }
        </p>
      </div>

      <div className="auth-benefits">
        <h3>World ID認証の利点</h3>
        <div className="benefits-grid">
          <div className="benefit-item">
            <span className="benefit-icon">🛡️</span>
            <div className="benefit-content">
              <h4>なりすまし防止</h4>
              <p>本人確認により不正な出退勤を防止</p>
            </div>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">📍</span>
            <div className="benefit-content">
              <h4>位置偽装検知</h4>
              <p>GPSスプーフィングを検出・防止</p>
            </div>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">📊</span>
            <div className="benefit-content">
              <h4>データ信頼性</h4>
              <p>監査可能な勤怠記録の生成</p>
            </div>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🔒</span>
            <div className="benefit-content">
              <h4>プライバシー保護</h4>
              <p>ゼロ知識証明による個人情報保護</p>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-action">
        <button
          className="worldid-auth-button"
          onClick={handleAuthenticate}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="processing">
              <span className="spinner">⏳</span>
              認証中...
            </span>
          ) : (
            <span className="auth-text">
              <span className="worldcoin-icon">🌍</span>
              World IDで認証
            </span>
          )}
        </button>

        {!requireAuth && (
          <button
            className="skip-button"
            onClick={() => setAuthState('skipped')}
          >
            後で認証する
          </button>
        )}
      </div>

      <div className="auth-footer">
        <p className="privacy-note">
          🔐 World IDは分散型身元証明システムです。個人情報は暗号化され、プライバシーが保護されます。
        </p>
      </div>
    </div>
  );
};

export default WorldIDAuth;
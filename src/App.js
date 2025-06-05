// src/App.js - 完全版（全関数定義込み）
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { WorldIDAuth } from './components/WorldIDAuth';
import { SecurityManager } from './utils/security';
import { LocationService } from './utils/LocationService';
import { worldcoinManager } from './utils/worldcoin';
import './App.css';

function App() {
  // ─── 状態管理 ─────────────────────────────────────────────────────────
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [records, setRecords] = useState([]);
  const [totalWorkTime, setTotalWorkTime] = useState(0);

  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState('unknown');
  const [currentArea, setCurrentArea] = useState(null);

  // eslint-disable-next-line no-unused-vars
  const [isWatchingLocation, setIsWatchingLocation] = useState(false);
  const [watchId, setWatchId] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);

  const [notificationPermission, setNotificationPermission] = useState('default');

  // Phase 4: セキュリティ & ダッシュボード関連
  const [securityManager] = useState(() => new SecurityManager());
  const [locationService] = useState(() => new LocationService());
  const [showDashboard, setShowDashboard] = useState(false);
  const [locationLogs, setLocationLogs] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [isSecurityEnabled, setIsSecurityEnabled] = useState(true);

  // 🌍 World ID 関連の新しい状態
  const [isWorldIDAuthenticated, setIsWorldIDAuthenticated] = useState(false);
  const [worldIDUser, setWorldIDUser] = useState(null);
  const [showWorldIDAuth, setShowWorldIDAuth] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [worldIDRequired, setWorldIDRequired] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [authenticationMode, setAuthenticationMode] = useState('optional');

  // ページ管理
  const [currentPage, setCurrentPage] = useState('main');

  // 設定周り
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    vibrationEnabled: true,
    locationAccuracyThreshold: 100,
    requireLocationForAttendance: true,
    enableDataEncryption: true,
    enableAnomalyDetection: true,
    // 🌍 World ID 設定
    worldIDRequired: false,
    worldIDVerificationLevel: 'orb',
    enableAdvancedSecurity: true,
    preventLocationSpoofing: true
  });

  // ─── useEffect群 ─────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    initializeApp();
    getCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isSecurityEnabled) {
      const cleanup = initializeSecurity();
      return () => cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecurityEnabled, records]);

  useEffect(() => {
    if (locationPermission === 'granted') {
      startLocationWatching();
    } else {
      stopLocationWatching();
    }
    return () => stopLocationWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationPermission]);

  useEffect(() => {
    checkWorldIDAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── World ID 関連の関数 ─────────────────────────────────────────────
  const checkWorldIDAuthStatus = async () => {
    try {
      const isAuth = worldcoinManager.isAuthenticated();
      if (isAuth) {
        const stored = localStorage.getItem('worldid_user');
        if (stored) {
          const user = JSON.parse(stored);
          const isValid = await worldcoinManager.validateAuthData(user);
          if (isValid) {
            setWorldIDUser(user);
            setIsWorldIDAuthenticated(true);
            securityManager.addAuditLog('worldid', 'auth_restored', 'success', {
              worldId: user.worldId?.substring(0, 8),
              verificationLevel: user.verificationLevel
            });
            return;
          }
        }
      }
      setIsWorldIDAuthenticated(false);
      setWorldIDUser(null);
      if (settings.worldIDRequired || authenticationMode === 'required') {
        setShowWorldIDAuth(true);
      }
    } catch (error) {
      console.error('World ID認証状態確認エラー:', error);
      securityManager.addAuditLog('worldid', 'auth_check_failed', 'error', error.message);
    }
  };

  const handleWorldIDAuthSuccess = (user) => {
    setWorldIDUser(user);
    setIsWorldIDAuthenticated(true);
    setShowWorldIDAuth(false);

    securityManager.addAuditLog('worldid', 'auth_success', 'success', {
      worldId: user.worldId?.substring(0, 8),
      verificationLevel: user.verificationLevel,
      isDevelopment: user.isDevelopmentMode || false
    });

    sendNotification(
      '🌍 World ID認証完了',
      '安全な出退勤記録が利用可能になりました',
      '✅'
    );

    if (settings.enableAdvancedSecurity) {
      enableAdvancedSecurityFeatures(user);
    }
  };

  const handleWorldIDAuthError = (error) => {
    console.error('World ID認証エラー:', error);
    securityManager.addAuditLog('worldid', 'auth_failed', 'error', error.message);

    setSecurityAlerts(prev => [
      ...prev,
      {
        id: Date.now(),
        type: 'error',
        message: `World ID認証に失敗しました: ${error.message}`,
        timestamp: new Date().toISOString()
      }
    ]);

    if (!settings.worldIDRequired && authenticationMode !== 'required') {
      setShowWorldIDAuth(false);
    }
  };

  const enableAdvancedSecurityFeatures = (user) => {
    try {
      securityManager.updateSecuritySettings({
        worldIDEnabled: true,
        worldIDUser: user.worldId,
        verificationLevel: user.verificationLevel,
        enhancedLocationValidation: true,
        timestampValidation: true
      });

      console.log('✅ 高度なセキュリティ機能が有効になりました');
    } catch (error) {
      console.error('セキュリティ機能有効化エラー:', error);
    }
  };

  // ─── 初期化関数群 ─────────────────────────────────────────────────────
  const initializeApp = async () => {
    try {
      await checkLocationPermission();
      await checkNotificationPermission();
      loadSavedRecords();
      loadSettings();
      loadLocationLogs();

      if (shouldPerformCleanup()) {
        performAutoDataCleanup();
      }

      securityManager.addAuditLog('app', 'initialize', 'info');
    } catch (error) {
      console.error('App initialization error:', error);
      securityManager.addAuditLog('app', 'initialize', 'error', error.message);
    }
  };

  const initializeSecurity = () => {
    try {
      migrateToSecureStorage();
      const securityInterval = setInterval(() => {
        performSecurityChecks();
      }, 5 * 60 * 1000);

      return () => clearInterval(securityInterval);
    } catch (error) {
      console.error('Security initialization error:', error);
      setSecurityAlerts(prev => [
        ...prev,
        {
          id: Date.now(),
          type: 'error',
          message: 'セキュリティ機能の初期化に失敗しました',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  const migrateToSecureStorage = () => {
    try {
      const existingRecords = localStorage.getItem('attendance_records');
      const existingLogs = localStorage.getItem('location_logs');

      if (existingRecords && !localStorage.getItem('attendance_records_secure')) {
        const recs = JSON.parse(existingRecords);
        securityManager.saveSecureRecord('attendance_records_secure', recs);
        securityManager.addAuditLog('migration', 'attendance_records', 'success', { count: recs.length });
      }
      if (existingLogs && !localStorage.getItem('location_logs_secure')) {
        const logs = JSON.parse(existingLogs);
        securityManager.saveSecureRecord('location_logs_secure', logs);
        securityManager.addAuditLog('migration', 'location_logs', 'success', { count: logs.length });
      }
    } catch (error) {
      securityManager.addAuditLog('migration', 'secure_storage', 'error', error.message);
    }
  };

  const performSecurityChecks = () => {
    try {
      const integrityResult = securityManager.performIntegrityCheck();
      const anomalies = securityManager.detectAttendanceAnomaly(records);

      if (anomalies.length > 0) {
        setSecurityAlerts(prev => [
          ...prev,
          {
            id: Date.now(),
            type: 'warning',
            message: `${anomalies.length}件の異常を検出しました`,
            timestamp: new Date().toISOString(),
            details: anomalies
          }
        ]);
      }

      const failedChecks = integrityResult.checks.filter(check => check.status === 'fail');
      if (failedChecks.length > 0) {
        setSecurityAlerts(prev => [
          ...prev,
          {
            id: Date.now(),
            type: 'error',
            message: 'データ整合性エラーが検出されました',
            timestamp: new Date().toISOString(),
            details: failedChecks
          }
        ]);
      }
    } catch (error) {
      securityManager.addAuditLog('security_check', 'periodic', 'error', error.message);
    }
  };

  // ─── 位置情報関連 ─────────────────────────────────────────────────────
  const checkLocationPermission = async () => {
    if ('geolocation' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(permission.state);
        permission.addEventListener('change', () => {
          setLocationPermission(permission.state);
          securityManager.addAuditLog('location', 'permission_change', 'info', permission.state);
        });
      } catch (error) {
        console.log('Permission API not supported');
        setLocationPermission('unknown');
      }
    } else {
      setLocationError('お使いのブラウザは位置情報に対応していません');
      securityManager.addAuditLog('location', 'unsupported_browser', 'warning');
    }
  };

  const checkNotificationPermission = async () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  const getCurrentLocation = () => {
    setIsLocationLoading(true);
    setLocationError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        setCurrentLocation(location);
        setIsLocationLoading(false);
        setLocationPermission('granted');
        try {
          await updateCurrentArea(location);
        } catch (err) {
          console.error('エリア更新エラー:', err);
        }
        securityManager.addAuditLog('location', 'manual_get', 'success');
      },
      (error) => {
        handleLocationError(error);
        setIsLocationLoading(false);
      },
      options
    );
  };

  const startLocationWatching = () => {
    if (!navigator.geolocation || watchId) return;

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 60000
    };

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };

        if (currentLocation && settings.enableAnomalyDetection) {
          const timeElapsed = new Date() - new Date(currentLocation.timestamp);
          const anomaly = securityManager.detectLocationAnomaly(
            location, currentLocation, timeElapsed
          );
          if (anomaly.isAnomalous) {
            setSecurityAlerts(prev => [
              ...prev,
              {
                id: Date.now(),
                type: 'warning',
                message: `異常な移動速度を検出: 時速${anomaly.calculatedSpeed}km`,
                timestamp: new Date().toISOString()
              }
            ]);
          }
        }

        setCurrentLocation(location);
        setLocationError(null);
        setLastLocationUpdate(new Date());

        try {
          await updateCurrentArea(location);
        } catch (err) {
          console.error('エリア更新エラー:', err);
        }
        saveLocationLog(location);
      },
      (error) => {
        handleLocationError(error);
      },
      options
    );

    setWatchId(id);
    setIsWatchingLocation(true);
    securityManager.addAuditLog('location', 'start_watching', 'info');
  };

  const stopLocationWatching = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setIsWatchingLocation(false);
      securityManager.addAuditLog('location', 'stop_watching', 'info');
    }
  };

  const updateCurrentArea = async (location) => {
    try {
      setCurrentArea('住所取得中...');
      const detailedArea = await locationService.getDetailedLocation(
        location.latitude,
        location.longitude
      );
      setCurrentArea(detailedArea);
      console.log('✅ エリア更新完了:', detailedArea);
      securityManager.addAuditLog('location', 'area_detected', 'info', {
        area: detailedArea,
        method: 'nominatim_api'
      });
    } catch (error) {
      console.error('❌ エリア取得エラー:', error);
      setCurrentArea('エリア取得失敗');
      securityManager.addAuditLog('location', 'area_detection_failed', 'error', error.message);
    }
  };

  const handleLocationError = (error) => {
    let errorMessage = '';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の利用が拒否されました';
        setLocationPermission('denied');
        securityManager.addAuditLog('location', 'permission_denied', 'warning');
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報を取得できませんでした';
        securityManager.addAuditLog('location', 'unavailable', 'error');
        break;
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました';
        securityManager.addAuditLog('location', 'timeout', 'warning');
        break;
      default:
        errorMessage = '位置情報の取得中にエラーが発生しました';
        securityManager.addAuditLog('location', 'unknown_error', 'error', error.message);
        break;
    }
    setLocationError(errorMessage);
    setIsWatchingLocation(false);
  };

  const saveLocationLog = async (location) => {
    const now = new Date();
    const lastLog = localStorage.getItem('last_location_log');
    if (lastLog) {
      const lastLogTime = new Date(lastLog);
      const timeDiff = (now - lastLogTime) / (1000 * 60);
      if (timeDiff < 5) return;
    }
    try {
      const detailedArea = await locationService.getDetailedLocation(
        location.latitude,
        location.longitude
      );
      const storedLogs = securityManager.loadSecureRecord('location_logs_secure') || [];
      const newLog = {
        id: Date.now(),
        timestamp: now.toISOString(),
        area: detailedArea,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        type: 'location_update'
      };
      storedLogs.push(newLog);
      if (storedLogs.length > 1000) {
        storedLogs.splice(0, storedLogs.length - 1000);
      }
      securityManager.saveSecureRecord('location_logs_secure', storedLogs);
      setLocationLogs(storedLogs);
      localStorage.setItem('last_location_log', now.toISOString());
    } catch (error) {
      console.error('Failed to save secure location log:', error);
      const basicArea = getLocationArea(location);
      const existing = JSON.parse(localStorage.getItem('location_logs') || '[]');
      const fallbackLog = {
        id: Date.now(),
        timestamp: now.toISOString(),
        area: basicArea,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        type: 'location_update'
      };
      existing.push(fallbackLog);
      localStorage.setItem('location_logs', JSON.stringify(existing));
    }
  };

  const getLocationArea = (loc) => {
    if (!loc) return '不明';
    const lat = loc.latitude;
    const lng = loc.longitude;
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
  };

  // ─── 勤務時間・記録関連 ─────────────────────────────────────────────
  const calculateTodayWorkTime = (todayRecords) => {
    let totalMinutes = 0;
    let lastCheckin = null;
    todayRecords.forEach(record => {
      if (record.type === 'checkin') {
        lastCheckin = new Date(record.timestamp);
      } else if (record.type === 'checkout' && lastCheckin) {
        const checkoutTime = new Date(record.timestamp);
        totalMinutes += (checkoutTime - lastCheckin) / (1000 * 60);
        lastCheckin = null;
      }
    });
    setTotalWorkTime(Math.round(totalMinutes));
  };

  const saveRecord = async (type, loc = currentLocation, area = null) => {
    try {
      if (settings.worldIDRequired && !isWorldIDAuthenticated) {
        alert('出退勤記録にはWorld ID認証が必要です。');
        setShowWorldIDAuth(true);
        return;
      }

      let finalArea = area;
      if (!finalArea && loc) {
        finalArea = await locationService.getDetailedLocation(loc.latitude, loc.longitude);
      }

      const newRecord = {
        id: Date.now(),
        type,
        timestamp: new Date().toISOString(),
        date: new Date().toDateString(),
        location: loc
          ? {
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              coordinates: formatLocation(loc),
            }
          : null,
        area: finalArea || currentArea || '不明',
        addressMethod: 'nominatim_api',

        worldID: isWorldIDAuthenticated ? {
          verified: true,
          worldId: worldIDUser?.worldId,
          verificationLevel: worldIDUser?.verificationLevel,
          nullifierHash: worldIDUser?.nullifierHash,
          verifiedAt: worldIDUser?.verifiedAt,
          isDevelopment: worldIDUser?.isDevelopmentMode || false
        } : {
          verified: false,
          reason: 'not_authenticated'
        },

        securityHash: generateRecordHash({
          type,
          timestamp: new Date().toISOString(),
          location: loc,
          worldId: worldIDUser?.worldId
        })
      };

      const updatedRecords = [...records, newRecord];
      setRecords(updatedRecords);

      try {
        securityManager.saveSecureRecord('attendance_records_secure', updatedRecords);
        securityManager.addAuditLog('attendance', type, 'success', {
          area: finalArea,
          hasLocation: !!loc,
          hasWorldID: isWorldIDAuthenticated,
          worldId: worldIDUser?.worldId?.substring(0, 8),
          verificationLevel: worldIDUser?.verificationLevel
        });
      } catch (error) {
        console.error('Failed to save secure record:', error);
        localStorage.setItem('attendance_records', JSON.stringify(updatedRecords));
        securityManager.addAuditLog('attendance', type, 'warning', 'fallback_storage_used');
      }

      const today = new Date().toDateString();
      const todayRec = updatedRecords.filter(r => new Date(r.timestamp).toDateString() === today);
      calculateTodayWorkTime(todayRec);

    } catch (error) {
      console.error('記録保存エラー:', error);
      securityManager.addAuditLog('attendance', 'save_failed', 'error', error.message);
    }
  };

  const generateRecordHash = (recordData) => {
    try {
      const dataString = JSON.stringify(recordData);
      let hash = 0;
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    } catch (error) {
      return 'hash_error';
    }
  };

  const handleAttendance = () => {
    if (settings.worldIDRequired && !isWorldIDAuthenticated) {
      alert('出退勤記録にはWorld ID認証が必要です。まず認証を完了してください。');
      setShowWorldIDAuth(true);
      return;
    }

    if (settings.requireLocationForAttendance && !currentLocation) {
      alert('出退勤記録には位置情報が必要です。位置情報を有効にしてください。');
      securityManager.addAuditLog('attendance', 'failed_no_location', 'warning');
      return;
    }

    if (isWorldIDAuthenticated && settings.preventLocationSpoofing && currentLocation) {
      const isSuspicious = detectLocationSpoofing(currentLocation);
      if (isSuspicious) {
        const confirm = window.confirm(
          '位置情報に異常が検出されました。本当にこの場所で出退勤しますか？\n\n' +
          'この操作は監査ログに記録されます。'
        );
        if (!confirm) {
          securityManager.addAuditLog('attendance', 'suspicious_location_cancelled', 'warning', {
            location: currentLocation,
            worldId: worldIDUser?.worldId?.substring(0, 8)
          });
          return;
        }
      }
    }

    if (currentLocation && currentLocation.accuracy > settings.locationAccuracyThreshold) {
      const ok = window.confirm(
        `位置精度が低い状態です（±${Math.round(currentLocation.accuracy)}m）。このまま記録しますか？`
      );
      if (!ok) {
        securityManager.addAuditLog('attendance', 'cancelled_low_accuracy', 'info');
        return;
      }
    }

    const locationInfo = currentArea || '不明な場所';
    const timestamp = new Date();
    const authInfo = isWorldIDAuthenticated ? ' (World ID認証済み)' : '';

    if (isCheckedIn) {
      setIsCheckedIn(false);
      saveRecord('checkout');
      sendNotification(
        '🌟 退勤完了' + authInfo,
        `${locationInfo}で${timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}に退勤しました`,
        '👋'
      );
    } else {
      setIsCheckedIn(true);
      saveRecord('checkin');
      sendNotification(
        '✨ 出勤完了' + authInfo,
        `${locationInfo}で${timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}に出勤しました`,
        '💪'
      );
    }
  };

  const detectLocationSpoofing = (location) => {
    try {
      if (location.accuracy === 1 || location.accuracy === 0) {
        return true;
      }

      if (currentLocation && worldIDUser) {
        const distance = securityManager.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          location.latitude,
          location.longitude
        );

        const timeDiff = (new Date() - new Date(currentLocation.timestamp)) / 1000;
        const maxSpeed = 300;
        const calculatedSpeed = (distance / timeDiff) * 3600;

        if (calculatedSpeed > maxSpeed) {
          securityManager.addAuditLog('location', 'spoofing_suspected', 'warning', {
            calculatedSpeed: calculatedSpeed.toFixed(2),
            distance: distance.toFixed(2),
            timeDiff,
            worldId: worldIDUser.worldId?.substring(0, 8)
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('位置偽装検知エラー:', error);
      return false;
    }
  };

  // ─── データ読み込み・保存関連 ─────────────────────────────────────────
  const loadSavedRecords = () => {
    try {
      const secureRecords = securityManager.loadSecureRecord('attendance_records_secure');
      let parsedRecords = secureRecords;
      if (!parsedRecords) {
        const savedRecords = localStorage.getItem('attendance_records');
        if (savedRecords) {
          parsedRecords = JSON.parse(savedRecords);
          securityManager.saveSecureRecord('attendance_records_secure', parsedRecords);
        }
      }
      if (parsedRecords) {
        setRecords(parsedRecords);
        const today = new Date().toDateString();
        const todayRecords = parsedRecords.filter(r => new Date(r.timestamp).toDateString() === today);
        if (todayRecords.length > 0) {
          const last = todayRecords[todayRecords.length - 1];
          setIsCheckedIn(last.type === 'checkin');
        }
        calculateTodayWorkTime(todayRecords);
        securityManager.addAuditLog('data', 'load_records', 'success', { count: parsedRecords.length });
      }
    } catch (error) {
      console.error('Failed to load records:', error);
      securityManager.addAuditLog('data', 'load_records', 'error', error.message);
      const saved = localStorage.getItem('attendance_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        setRecords(parsed);
      }
    }
  };

  const loadLocationLogs = () => {
    try {
      const secureLogs = securityManager.loadSecureRecord('location_logs_secure');
      let logs = secureLogs;
      if (!logs) {
        const savedLogs = localStorage.getItem('location_logs');
        if (savedLogs) {
          logs = JSON.parse(savedLogs);
          securityManager.saveSecureRecord('location_logs_secure', logs);
        }
      }
      if (logs) {
        setLocationLogs(logs);
      }
    } catch (error) {
      console.error('Failed to load location logs:', error);
      securityManager.addAuditLog('data', 'load_location_logs', 'error', error.message);
    }
  };

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('attendance_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const saveSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('attendance_settings', JSON.stringify(updated));
    securityManager.addAuditLog('settings', 'update', 'info', Object.keys(newSettings));
  };

  // ─── データクリーンアップ関連 ─────────────────────────────────────────
  const shouldPerformCleanup = () => {
    try {
      const lastCleanup = localStorage.getItem('last_auto_cleanup');
      if (!lastCleanup) {
        return true;
      }
      const lastCleanupDate = new Date(lastCleanup);
      const now = new Date();
      const daysSinceLastCleanup = (now - lastCleanupDate) / (1000 * 60 * 60 * 24);
      return daysSinceLastCleanup >= 7;
    } catch (error) {
      console.error('クリーンアップ判定エラー:', error);
      return true;
    }
  };

  const performAutoDataCleanup = () => {
    try {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

      console.log(`🧹 自動クリーンアップ開始: ${threeMonthsAgo.toLocaleDateString('ja-JP')} 以前のデータを削除`);

      const originalRecordsCount = records.length;
      const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= threeMonthsAgo;
      });

      const originalLogsCount = locationLogs.length;
      const filteredLogs = locationLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= threeMonthsAgo;
      });

      const recordsDeleted = originalRecordsCount - filteredRecords.length;
      const logsDeleted = originalLogsCount - filteredLogs.length;

      if (recordsDeleted > 0 || logsDeleted > 0) {
        setRecords(filteredRecords);
        setLocationLogs(filteredLogs);

        try {
          securityManager.saveSecureRecord('attendance_records_secure', filteredRecords);
          securityManager.saveSecureRecord('location_logs_secure', filteredLogs);
        } catch (error) {
          localStorage.setItem('attendance_records', JSON.stringify(filteredRecords));
          localStorage.setItem('location_logs', JSON.stringify(filteredLogs));
        }

        securityManager.addAuditLog('maintenance', 'auto_cleanup', 'success', {
          recordsDeleted,
          logsDeleted,
          cutoffDate: threeMonthsAgo.toISOString(),
          remainingRecords: filteredRecords.length,
          remainingLogs: filteredLogs.length
        });

        console.log(`✅ 自動クリーンアップ完了: 出退勤 ${recordsDeleted}件、位置ログ ${logsDeleted}件を削除`);

        const today = new Date().toDateString();
        const todayRecords = filteredRecords.filter(r => new Date(r.timestamp).toDateString() === today);
        calculateTodayWorkTime(todayRecords);

        if (todayRecords.length > 0) {
          const lastToday = todayRecords[todayRecords.length - 1];
          setIsCheckedIn(lastToday.type === 'checkin');
        } else {
          setIsCheckedIn(false);
        }

      } else {
        console.log('🧹 クリーンアップ: 削除対象のデータなし');
        securityManager.addAuditLog('maintenance', 'auto_cleanup', 'info', 'no_data_to_delete');
      }

      localStorage.setItem('last_auto_cleanup', now.toISOString());

    } catch (error) {
      console.error('❌ 自動クリーンアップエラー:', error);
      securityManager.addAuditLog('maintenance', 'auto_cleanup', 'error', error.message);
    }
  };

  const performManualCleanup = () => {
    if (window.confirm('過去3か月以前のデータを削除しますか？\n\n⚠️ この操作は元に戻せません。')) {
      performAutoDataCleanup();
      alert('✅ 古いデータのクリーンアップが完了しました');
    }
  };

  const getDataRetentionStatus = () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const oldRecords = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate < threeMonthsAgo;
    });

    const oldLogs = locationLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate < threeMonthsAgo;
    });

    const lastCleanup = localStorage.getItem('last_auto_cleanup');

    return {
      cutoffDate: threeMonthsAgo,
      currentRecords: records.length,
      currentLogs: locationLogs.length,
      oldRecords: oldRecords.length,
      oldLogs: oldLogs.length,
      lastCleanup: lastCleanup ? new Date(lastCleanup) : null,
      nextCleanup: lastCleanup ? new Date(new Date(lastCleanup).getTime() + 7 * 24 * 60 * 60 * 1000) : new Date()
    };
  };

  // ─── CSV出力関連 ─────────────────────────────────────────────────────
  const exportIntegratedCSV = () => {
    try {
      const attendanceData = records.map(record => ({
        timestamp: record.timestamp,
        dataType: record.type === 'checkin' ? '出勤' : '退勤',
        area: record.area || '不明',
        worldIDVerified: record.worldID?.verified ? 'Yes' : 'No',
        verificationLevel: record.worldID?.verificationLevel || 'N/A',
        securityHash: record.securityHash || 'N/A'
      }));

      const locationData = locationLogs.map(log => ({
        timestamp: log.timestamp,
        dataType: '位置更新',
        area: log.area || '不明',
        worldIDVerified: 'N/A',
        verificationLevel: 'N/A',
        securityHash: 'N/A'
      }));

      const allData = [...attendanceData, ...locationData]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (allData.length === 0) {
        alert('エクスポートするデータがありません。');
        return;
      }

      const headers = isWorldIDAuthenticated 
        ? ['日付', '時刻', '種別', '勤務地域', '曜日', 'World ID認証', '認証レベル', 'セキュリティハッシュ']
        : ['日付', '時刻', '種別', '勤務地域', '曜日'];

      const csvData = allData.map(item => {
        const date = new Date(item.timestamp);
        const baseRow = [
          date.toLocaleDateString('ja-JP'),
          date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          item.dataType,
          item.area,
          date.toLocaleDateString('ja-JP', { weekday: 'long' })
        ];

        if (isWorldIDAuthenticated) {
          baseRow.push(item.worldIDVerified, item.verificationLevel, item.securityHash);
        }

        return baseRow;
      });

      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const suffix = isWorldIDAuthenticated ? '_WorldID対応' : '';
      link.setAttribute('download', `統合勤怠記録${suffix}_${new Date().toISOString().split('T')[0]}.csv`);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      securityManager.addAuditLog('export', 'csv_integrated', 'success');
      alert(`✅ CSVエクスポート完了\n📊 合計: ${allData.length}件`);
    } catch (error) {
      console.error('CSV export error:', error);
      alert('❌ CSVエクスポートでエラーが発生しました。');
    }
  };

  const exportMonthlyCSV = (monthsAgo = 0) => {
    try {
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      const filteredAttendance = records.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= startOfMonth && recordDate <= endOfMonth;
      }).map(record => ({
        timestamp: record.timestamp,
        dataType: record.type === 'checkin' ? '出勤' : '退勤',
        area: record.area || '不明',
        worldIDVerified: record.worldID?.verified ? 'Yes' : 'No',
        verificationLevel: record.worldID?.verificationLevel || 'N/A',
        securityHash: record.securityHash || 'N/A'
      }));

      if (filteredAttendance.length === 0) {
        const monthName = targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
        alert(`${monthName}のデータがありません。`);
        return;
      }

      const headers = isWorldIDAuthenticated 
        ? ['日付', '時刻', '種別', '勤務地域', '曜日', 'World ID認証', '認証レベル', 'セキュリティハッシュ']
        : ['日付', '時刻', '種別', '勤務地域', '曜日'];

      const csvData = filteredAttendance.map(item => {
        const date = new Date(item.timestamp);
        const baseRow = [
          date.toLocaleDateString('ja-JP'),
          date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          item.dataType,
          item.area,
          date.toLocaleDateString('ja-JP', { weekday: 'long' })
        ];

        if (isWorldIDAuthenticated) {
          baseRow.push(item.worldIDVerified, item.verificationLevel, item.securityHash);
        }

        return baseRow;
      });

      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      const monthName = targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
      const suffix = isWorldIDAuthenticated ? '_WorldID対応' : '';
      link.setAttribute('download', `勤怠記録${suffix}_${monthName}_${new Date().toISOString().split('T')[0]}.csv`);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      securityManager.addAuditLog('export', 'csv_monthly_worldid', 'success', { 
        month: monthName,
        recordCount: filteredAttendance.length,
        worldIdRecords: filteredAttendance.filter(r => r.worldIDVerified === 'Yes').length
      });

      const worldIdCount = filteredAttendance.filter(r => r.worldIDVerified === 'Yes').length;
      alert(`✅ ${monthName}のCSVエクスポート完了\n📊 合計: ${filteredAttendance.length}件${isWorldIDAuthenticated ? `\n🌍 World ID認証済み: ${worldIdCount}件` : ''}`);
    } catch (error) {
      console.error('CSV export error:', error);
      alert('❌ CSVエクスポートでエラーが発生しました。');
    }
  };

  const getMonthName = (monthsAgo) => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    return targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  };

  const getMonthlyDataCount = (monthsAgo) => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    const attendanceCount = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startOfMonth && recordDate <= endOfMonth;
    }).length;

    const locationCount = locationLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startOfMonth && logDate <= endOfMonth;
    }).length;

    return attendanceCount + locationCount;
  };

  const getMonthlyWorldIDCount = (monthsAgo) => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    return records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startOfMonth && recordDate <= endOfMonth && record.worldID?.verified;
    }).length;
  };

  // ─── ユーティリティ関数 ─────────────────────────────────────────────
  const getTodayRecords = () => {
    const today = new Date().toDateString();
    return records.filter(r => new Date(r.timestamp).toDateString() === today);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatWorkTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  const formatLocation = (loc) => {
    if (!loc) return '位置情報なし';
    const lat = loc.latitude.toFixed(4);
    const lng = loc.longitude.toFixed(4);
    return `${lat}, ${lng}`;
  };

  const sendNotification = (title, body, icon = '🕐') => {
    if (!settings.notificationsEnabled || notificationPermission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
      requireInteraction: true,
      tag: 'attendance-app'
    });

    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    setTimeout(() => notification.close(), 3000);
  };

  const dismissSecurityAlert = (alertId) => {
    setSecurityAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  // ─── レンダリング ─────────────────────────────────────────────────────
  const todayRecords = getTodayRecords();

  if (showDashboard) {
    return (
      <Dashboard
        records={records}
        locationLogs={locationLogs}
        onBack={() => setShowDashboard(false)}
      />
    );
  }

  if (showWorldIDAuth || (settings.worldIDRequired && !isWorldIDAuthenticated)) {
    return (
      <div className="app">
        <div className="container">
          <header className="header">
            <h1>🌍 World ID認証</h1>
            {!settings.worldIDRequired && (
              <button
                className="skip-auth-button"
                onClick={() => setShowWorldIDAuth(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#9ca3af',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                スキップ
              </button>
            )}
          </header>

          <WorldIDAuth
            onAuthSuccess={handleWorldIDAuthSuccess}
            onAuthError={handleWorldIDAuthError}
            requireAuth={settings.worldIDRequired}
          />
        </div>
      </div>
    );
  }

  if (currentPage === 'main') {
    return (
      <div className="app">
        <div className="container">
          {/* セキュリティアラート */}
          {securityAlerts.length > 0 && (
            <div className="security-alerts">
              {securityAlerts.slice(-3).map(alert => (
                <div key={alert.id} className={`security-alert ${alert.type}`}>
                  <div className="alert-content">
                    <span className="alert-icon">
                      {alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                    </span>
                    <span className="alert-message">{alert.message}</span>
                  </div>
                  <button
                    className="alert-dismiss"
                    onClick={() => dismissSecurityAlert(alert.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 🌍 World ID認証状態表示 */}
          {isWorldIDAuthenticated && (
            <WorldIDAuth 
              onAuthSuccess={handleWorldIDAuthSuccess}
              onAuthError={handleWorldIDAuthError}
              showCompactView={true}
            />
          )}

          {/* ヘッダー */}
          <header className="header">
            <div className="header-top">
              <h1>出退勤管理 {isWorldIDAuthenticated && '🌍'}</h1>
              <div className="header-buttons">
                <button
                  className="nav-button"
                  onClick={() => setCurrentPage('history')}
                  title="履歴・出力ページ"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    marginRight: '8px',
                    boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  📋
                </button>
                <button
                  className="dashboard-button"
                  onClick={() => setShowDashboard(true)}
                  title="管理ダッシュボードを開く"
                >
                  📊
                </button>
                {!isWorldIDAuthenticated && (
                  <button
                    className="worldid-auth-trigger"
                    onClick={() => setShowWorldIDAuth(true)}
                    title="World ID認証"
                    style={{
                      background: 'linear-gradient(135deg, #000000 0%, #434343 100%)',
                      color: 'white',
                      border: 'none',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      marginLeft: '8px',
                      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    🌍
                  </button>
                )}
              </div>
            </div>
            <div className="date">{formatDate(currentTime)}</div>
            <div className="time">{formatTime(currentTime)}</div>
          </header>

          {/* 現在エリア表示 */}
          {currentArea && (
            <div className="current-area-section">
              <h3>📍 現在のエリア</h3>
              <div className="area-info">
                <div className="area-name">{currentArea}</div>
                {currentLocation && (
                  <div className="area-accuracy">
                    精度: ±{Math.round(currentLocation.accuracy)}m
                    {isWorldIDAuthenticated && settings.preventLocationSpoofing && (
                      <span className="spoofing-protection"> 🛡️ 偽装検知有効</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 位置情報取得ボタン（位置情報がない場合のみ） */}
          {!currentLocation && locationPermission !== 'denied' && (
            <div className="location-section">
              <h3>📍 位置情報</h3>
              <button
                className="location-button"
                onClick={getCurrentLocation}
                disabled={isLocationLoading}
              >
                {isLocationLoading ? '取得中...' : '📍 位置情報を取得'}
              </button>
              {locationError && (
                <div className="location-error">⚠️ {locationError}</div>
              )}
            </div>
          )}

          {/* 勤務状態 */}
          <div className="status">
            <div className={`status-indicator ${isCheckedIn ? 'checked-in' : 'checked-out'}`}>
              {isCheckedIn ? '勤務中' : '勤務外'}
              {isWorldIDAuthenticated && <span className="worldid-badge">🌍</span>}
            </div>
          </div>

          {/* 本日の勤務時間 */}
          <div className="work-time">
            <h3>本日の勤務時間</h3>
            <div className="work-time-value">{formatWorkTime(totalWorkTime)}</div>
          </div>

          {/* 出退勤ボタン */}
          <div className="button-container">
            <button
              className={`attendance-button ${isCheckedIn ? 'checkout' : 'checkin'}`}
              onClick={handleAttendance}
            >
              {isCheckedIn ? '退勤する' : '出勤する'}
              {isWorldIDAuthenticated && (
                <span className="worldid-secure-badge">🛡️ セキュア</span>
              )}
            </button>
          </div>

          {/* 今日の記録（最新3件のみ） */}
          {todayRecords.length > 0 && (
            <div className="records">
              <h3>本日の記録</h3>
              <div className="records-list">
                {todayRecords.slice(-3).map((record) => (
                  <div key={record.id} className="record-item">
                    <div className="record-main">
                      <div className="record-type-container">
                        <span className={`record-type ${record.type}`}>
                          {record.type === 'checkin' ? '出勤' : '退勤'}
                        </span>
                        {record.worldID?.verified && (
                          <span className="worldid-verified-badge">🌍</span>
                        )}
                      </div>
                      <span className="record-time">
                        {formatTime(new Date(record.timestamp))}
                      </span>
                    </div>
                    {record.area && (
                      <div className="record-office">
                        <div className="office-badge">📍 {record.area}</div>
                        {record.worldID?.verified && (
                          <div className="security-badge">
                            🔒 {record.worldID.verificationLevel === 'orb' ? 'Orb認証' : 'デバイス認証'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {todayRecords.length > 3 && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => setCurrentPage('history')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    📋 全ての履歴を見る
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentPage === 'history') {
    return (
      <div className="app">
        <div className="container">
          {/* ヘッダー */}
          <header className="header">
            <div className="header-top">
              <h1>📋 履歴・出力 {isWorldIDAuthenticated && '🌍'}</h1>
              <button
                className="nav-button"
                onClick={() => setCurrentPage('main')}
                title="メイン画面に戻る"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  border: 'none',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                ←
              </button>
            </div>
          </header>

          {/* 🌍 World ID統計情報 */}
          {isWorldIDAuthenticated && (
            <div className="worldid-stats">
              <h3>🌍 World ID統計</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">認証済み記録</span>
                  <span className="stat-value">
                    {records.filter(r => r.worldID?.verified).length}件
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">認証レベル</span>
                  <span className="stat-value">
                    {worldIDUser?.verificationLevel === 'orb' ? '🔮 Orb' : '📱 Device'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">セキュリティ強度</span>
                  <span className="stat-value">
                    {settings.enableAdvancedSecurity ? '🔒 高' : '🔓 標準'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 月別データエクスポートセクション（World ID対応） */}
          <div className="export-section">
            <h3>📊 月別データエクスポート {isWorldIDAuthenticated && '(World ID対応)'}</h3>
            <div className="export-controls">
              {/* メイン統合エクスポートボタン（全期間） */}
              <button
                className="export-button"
                onClick={exportIntegratedCSV}
                disabled={records.length === 0 && locationLogs.length === 0}
                style={{
                  background: isWorldIDAuthenticated 
                    ? 'linear-gradient(135deg, #000000 0%, #10b981 100%)' 
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  padding: '16px 24px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  marginBottom: '16px',
                  width: '100%',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  boxShadow: isWorldIDAuthenticated 
                    ? '0 8px 20px rgba(0, 0, 0, 0.3)' 
                    : '0 8px 20px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                {isWorldIDAuthenticated ? '🌍 World ID対応CSV出力（全期間）' : '📋 統合CSV出力（全期間）'}
              </button>

              {/* 月別エクスポートボタン（過去3か月） */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                {[0, 1, 2].map(monthsAgo => (
                  <button
                    key={monthsAgo}
                    className="export-month-button"
                    onClick={() => exportMonthlyCSV(monthsAgo)}
                    disabled={getMonthlyDataCount(monthsAgo) === 0}
                    style={{
                      background: getMonthlyDataCount(monthsAgo) > 0 
                        ? (isWorldIDAuthenticated ? 'rgba(0, 0, 0, 0.2)' : 'rgba(59, 130, 246, 0.2)') 
                        : 'rgba(255, 255, 255, 0.1)', 
                      color: getMonthlyDataCount(monthsAgo) > 0 
                        ? (isWorldIDAuthenticated ? '#ffffff' : '#60a5fa') 
                        : '#6b7280', 
                      border: `1px solid ${getMonthlyDataCount(monthsAgo) > 0 
                        ? (isWorldIDAuthenticated ? 'rgba(0, 0, 0, 0.3)' : 'rgba(59, 130, 246, 0.3)') 
                        : 'rgba(255, 255, 255, 0.2)'}`, 
                      padding: '12px 8px', 
                      borderRadius: '12px', 
                      cursor: getMonthlyDataCount(monthsAgo) > 0 ? 'pointer' : 'not-allowed', 
                      transition: 'all 0.3s ease', 
                      fontSize: '0.9rem', 
                      textAlign: 'center' 
                    }}
                    title={`${getMonthName(monthsAgo)} (${getMonthlyDataCount(monthsAgo)}件)`}
                  >
                    📅 {getMonthName(monthsAgo).replace('年', '/').replace('月', '')}
                    <br />
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {getMonthlyDataCount(monthsAgo)}件
                    </span>
                    {isWorldIDAuthenticated && getMonthlyDataCount(monthsAgo) > 0 && (
                      <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                        🌍 {getMonthlyWorldIDCount(monthsAgo)}件認証済み
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* データ概要表示（World ID統計付き） */}
              {(records.length > 0 || locationLogs.length > 0) && (
                <div className="export-info">
                  💾 出退勤記録: {records.length}件
                  <br />
                  📍 位置ログ: {locationLogs.length}件
                  {isWorldIDAuthenticated && (
                    <>
                      <br />
                      🌍 World ID認証済み: {records.filter(r => r.worldID?.verified).length}件
                      <br />
                      🔮 Orb認証: {records.filter(r => r.worldID?.verificationLevel === 'orb').length}件
                    </>
                  )}
                  <br />
                  📊 統合データ: {records.length + locationLogs.length}件
                  <br />
                  💡 CSVには日付・時刻・種別・勤務地域・曜日{isWorldIDAuthenticated ? '・World ID認証情報・セキュリティハッシュ' : ''}が含まれます
                </div>
              )}
            </div>
          </div>

          {/* 全履歴表示（World ID情報付き） */}
          <div className="records">
            <h3>📝 出退勤履歴（全{records.length}件）</h3>
            {records.length > 0 ? (
              <div className="records-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {records.slice().reverse().map((record) => (
                  <div key={record.id} className="record-item">
                    <div className="record-main">
                      <div className="record-type-container">
                        <span className={`record-type ${record.type}`}>
                          {record.type === 'checkin' ? '出勤' : '退勤'}
                        </span>
                        {record.worldID?.verified && (
                          <span className="worldid-verified-badge">🌍</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span className="record-time">
                          {new Date(record.timestamp).toLocaleDateString('ja-JP')} {formatTime(new Date(record.timestamp))}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {new Date(record.timestamp).toLocaleDateString('ja-JP', { weekday: 'long' })}
                        </span>
                      </div>
                    </div>
                    {record.area && (
                      <div className="record-office">
                        <div className="office-badge">📍 {record.area}</div>
                        {record.worldID?.verified && (
                          <div className="security-badge">
                            🔒 {record.worldID.verificationLevel === 'orb' ? 'Orb認証' : 'デバイス認証'}
                            {record.worldID.isDevelopment && ' (Dev)'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                📭 出退勤記録がありません
              </div>
            )}
          </div>

          {/* データ保持状況セクション */}
          <div className="data-retention-section">
            <h3>📊 データ保持状況</h3>
            <div className="retention-info">
              {(() => {
                const status = getDataRetentionStatus();
                return (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '0.9rem',
                    color: '#cbd5e1'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      📅 <strong>保持期間:</strong> 過去3か月分（{status.cutoffDate.toLocaleDateString('ja-JP')} 以降）
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      📋 <strong>現在のデータ:</strong> 出退勤 {status.currentRecords}件、位置ログ {status.currentLogs}件
                    </div>
                    {isWorldIDAuthenticated && (
                      <div style={{ marginBottom: '8px' }}>
                        🌍 <strong>World ID認証:</strong> {records.filter(r => r.worldID?.verified).length}件 ({((records.filter(r => r.worldID?.verified).length / records.length) * 100).toFixed(1)}%)
                      </div>
                    )}
                    {status.oldRecords > 0 || status.oldLogs > 0 ? (
                      <div style={{ marginBottom: '8px', color: '#fbbf24' }}>
                        ⚠️ <strong>古いデータ:</strong> 出退勤 {status.oldRecords}件、位置ログ {status.oldLogs}件
                        <button
                          onClick={performManualCleanup}
                          style={{
                            background: 'rgba(251, 191, 36, 0.2)',
                            color: '#fbbf24',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            marginLeft: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          今すぐクリーンアップ
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '8px', color: '#10b981' }}>
                        ✅ <strong>データ最適化済み</strong>
                      </div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      🔄 自動クリーンアップ: 7日ごと実行
                      {status.lastCleanup && (
                        <span> | 前回: {status.lastCleanup.toLocaleDateString('ja-JP')}</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;

// src/pages/HomePage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = ({
  isCheckedIn,
  handleAttendance,
  currentArea,
  totalWorkTime
}) => {
  const navigate = useNavigate();

  return (
    <div className="container">
      <h2>出退勤アプリ</h2>

      {/* 出退勤ボタン */}
      <div className="button-container" style={{ margin: '40px 0' }}>
        <button
          className={`attendance-button ${isCheckedIn ? 'checkout' : 'checkin'}`}
          onClick={handleAttendance}
          style={{ width: '100%', padding: '16px', fontSize: '1.2rem' }}
        >
          {isCheckedIn ? '退勤する' : '出勤する'}
        </button>
      </div>

      {/* 現在のエリアと今日の勤務時間 */}
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <p>現在のエリア：{currentArea || '未取得'}</p>
        <p>今日の合計勤務時間：{`${Math.floor(totalWorkTime/60)}h ${totalWorkTime%60}m`}</p>
      </div>

      {/* 履歴ページへのリンク */}
      <div>
        <button
          onClick={() => navigate('/history')}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          📋 履歴・エクスポートを見る
        </button>
      </div>
    </div>
  );
};

export default HomePage;

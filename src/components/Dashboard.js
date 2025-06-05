// src/components/Dashboard.js
import React from 'react';

const Dashboard = ({ records, locationLogs, onBack }) => {
  // 今月の記録数を計算
  const thisMonthRecords = records.filter(record => {
    const recordDate = new Date(record.timestamp);
    const now = new Date();
    return recordDate.getMonth() === now.getMonth() && 
           recordDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-top">
            <h1>📊 管理ダッシュボード</h1>
            <button className="nav-button" onClick={onBack}>
              ← 戻る
            </button>
          </div>
        </header>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h2>記録の統計</h2>
          <p>総記録数: {records.length}件</p>
          <p>今月の記録: {thisMonthRecords}件</p>
          <p>位置情報ログ: {locationLogs.length}件</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
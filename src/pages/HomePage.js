// src/pages/HistoryPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HistoryPage = ({
  records,
  locationLogs,
  exportToCSV,
  exportFullLocationCSV,
  exportIntegratedCSV,
  exportIntegratedCSVByPeriod
}) => {
  const navigate = useNavigate();
  const totalCount = records.length + locationLogs.length;

  return (
    <div className="container">
      <h2>履歴・CSVエクスポート</h2>

      {/* 戻るボタン */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#e2e8f0',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.9rem'
          }}
        >
          ← 戻る
        </button>
      </div>

      {/* 履歴の簡易リスト */}
      <div style={{ marginBottom: '24px', textAlign: 'left' }}>
        <h3>■ 本日の記録（最新5件）</h3>
        {records.slice(-5).reverse().map(rec => {
          const d = new Date(rec.timestamp);
          return (
            <div key={rec.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>
                {d.toLocaleDateString('ja-JP')} {d.toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})} –
                {rec.type === 'checkin' ? '出勤' : '退勤'} @ {rec.area || '不明'}
              </span>
            </div>
          );
        })}
        {records.length === 0 && <p>出退勤記録がありません。</p>}
      </div>

      {/* 簡易エクスポートボタン群 */}
      <div className="export-controls" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          className="export-button"
          onClick={exportFullLocationCSV}
          disabled={records.length + locationLogs.length === 0}
          style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          📍 詳細位置込み CSV 出力
        </button>

        <button
          className="export-button"
          onClick={exportToCSV}
          disabled={records.length === 0}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          📥 出退勤記録のみ CSV 出力
        </button>

        <button
          className="export-button"
          onClick={exportIntegratedCSV}
          disabled={totalCount === 0}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          📋 統合CSV出力（全期間）
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => exportIntegratedCSVByPeriod(7)}
            disabled={totalCount === 0}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              padding: '10px',
              borderRadius: '6px',
              flex: 1,
              fontSize: '0.9rem'
            }}
          >
            📅 過去7日
          </button>
          <button
            onClick={() => exportIntegratedCSVByPeriod(30)}
            disabled={totalCount === 0}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              padding: '10px',
              borderRadius: '6px',
              flex: 1,
              fontSize: '0.9rem'
            }}
          >
            📅 過去30日
          </button>
          <button
            onClick={() => exportIntegratedCSVByPeriod(90)}
            disabled={totalCount === 0}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              padding: '10px',
              borderRadius: '6px',
              flex: 1,
              fontSize: '0.9rem'
            }}
          >
            📅 過去90日
          </button>
        </div>
      </div>

      {/* 履歴件数の概要 */}
      <div style={{ marginTop: '24px', fontSize: '0.9rem', color: '#cbd5e1' }}>
        出退勤 件数: {records.length}件 ／ 位置更新 件数: {locationLogs.length}件 ／
        統合データ 件数: {totalCount}件
      </div>
    </div>
  );
};

export default HistoryPage;

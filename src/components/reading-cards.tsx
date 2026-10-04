'use client';

import { Sparkles, ZoomIn } from 'lucide-react';
import { getCard } from '@/data/tarot';
import { getSpread } from '@/data/spreads';
import type { DrawnCard, Reading } from '@/types/tarot';
import { RiderWaiteArtwork } from './rider-waite-artwork';
import styles from './reading-cards.module.css';

export function ReadingCards({ reading, loading, onZoom, onMessage }: {
  reading: Reading;
  loading: boolean;
  onZoom: (card: DrawnCard) => void;
  onMessage: () => void;
}) {
  return (
    <section id="reading-cards" className={styles.section} aria-label="Các lá đã rút">
      <div className={styles.heading}>
        <span className="eyebrow">CÁC LÁ BẠN ĐÃ RÚT</span>
        <h3>{reading.cards.length} lá · {getSpread(reading.spreadId).name}</h3>
        <p>{reading.cards.length > 1 ? 'Vuốt để xem từng lá. ' : ''}Chạm vào ảnh để phóng to.</p>
      </div>
      <ul className={`${styles.cards} ${reading.cards.length === 1 ? styles.single : ''}`}>
        {reading.cards.map((drawn, index) => {
          const card = getCard(drawn.cardId);
          return <li key={drawn.cardId} className={styles.card}>
            <span className={styles.position}>{index + 1} · {drawn.position}</span>
            <button type="button" className={styles.artworkButton} onClick={() => onZoom(drawn)} aria-label={`Xem chi tiết ${card.nameVi}, ${drawn.orientation === 'upright' ? 'xuôi' : 'ngược'}`}>
              <RiderWaiteArtwork cardId={drawn.cardId} orientation={drawn.orientation} />
              <span className={styles.zoom}><ZoomIn size={15} aria-hidden="true" />Phóng to</span>
            </button>
            <h4>{card.nameVi}</h4>
            <span className={styles.orientation}>{drawn.orientation === 'upright' ? 'Xuôi ↑' : 'Ngược ↓'}</span>
          </li>;
        })}
      </ul>
      <button type="button" className={`primary-button ${styles.messageButton}`} onClick={onMessage} disabled={loading}>
        <Sparkles size={17} aria-hidden="true" />{loading ? 'Đang đọc thông điệp…' : 'Khám phá thông điệp'}
      </button>
      <p className={styles.note}>Diễn giải từng lá và phân tích tổng {reading.cards.length} lá theo câu hỏi của bạn.</p>
    </section>
  );
}

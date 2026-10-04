'use client';

import { useState } from 'react';
import { getCard } from '@/data/tarot';
import type { Orientation } from '@/types/tarot';

interface ArtworkProps {
  cardId: string;
  orientation?: Orientation;
  className?: string;
  loading?: 'eager' | 'lazy';
  retryable?: boolean;
}

/** Always renders the canonical PNG for this ID. Errors never substitute art. */
export function RiderWaiteArtwork({
  cardId,
  orientation = 'upright',
  className = '',
  loading = 'eager',
  retryable = false,
}: ArtworkProps) {
  const card = getCard(cardId);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  function retry() {
    setFailed(false);
    setAttempt(previous => previous + 1);
  }

  return (
    <div className={`rider-waite-artwork ${className}`} data-card-id={cardId}>
      {failed ? (
        <div className="artwork-error" role="status">
          <p>Chưa tải được ảnh Rider–Waite của {card.nameVi}.</p>
          {retryable && (
            <button type="button" className="text-button" onClick={retry}>
              Thử tải lại ảnh
            </button>
          )}
        </div>
      ) : (
        <img
          key={`${cardId}-${attempt}`}
          src={card.image}
          alt={card.name}
          className={orientation === 'reversed' ? 'reversed' : ''}
          width={420}
          height={700}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

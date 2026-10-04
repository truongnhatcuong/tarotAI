'use client';

import { useState } from 'react';
import { Check, Copy, Download, Heart } from 'lucide-react';
import { Dialog } from './dialog';
import styles from './donation-panel.module.css';

const ACCOUNT_NUMBER = '0372204152';
const QR_IMAGE = '/donate/mb-0372204152.png';

export function DonationPanel() {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <>
      <button type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setCopyStatus('idle'); setOpen(true); }}>
        <Heart size={14} aria-hidden="true" />Ủng hộ
      </button>
      {open && <Dialog title="Tiếp sức cho Arcana" onClose={() => setOpen(false)}><div className={styles.panel}>
      <div className={styles.intro}>
        <p>Nếu những lá bài mang lại cho bạn một góc nhìn hữu ích, bạn có thể gửi một chút ủng hộ để mình tiếp tục chăm chút Arcana.</p>
      </div>

      <figure className={styles.qr}>
        <div className={styles.qrFrame}><img src={QR_IMAGE} width={490} height={490} alt="Mã VietQR ủng hộ Arcana, ngân hàng MB, số tài khoản 0372204152" /></div>
        <figcaption>Quét mã để ủng hộ<small>Bạn tự chọn số tiền</small></figcaption>
      </figure>

      <div className={styles.details}>
        <div className={styles.bank}><span className={styles.bankMark}>MB<span aria-hidden="true">✦</span></span><span>Ngân hàng Quân đội<small>Chuyển khoản qua VietQR</small></span></div>
        <span className={styles.accountLabel}>Số tài khoản</span>
        <span className={styles.account}>{ACCOUNT_NUMBER}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.copyButton} onClick={copyAccount}>
            {copyStatus === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copyStatus === 'copied' ? 'Đã sao chép' : 'Sao chép STK'}
          </button>
          <a href={QR_IMAGE} download="Arcana-VietQR-MB-0372204152.png" className={styles.downloadLink}><Download size={14} aria-hidden="true" />Tải mã QR</a>
        </div>
        <p className={styles.copyStatus} role="status">{copyStatus === 'error' ? 'Chưa sao chép được. Bạn có thể chọn và sao chép số tài khoản phía trên.' : copyStatus === 'copied' ? 'Đã sao chép số tài khoản MB.' : ''}</p>
      </div>

      <p className={styles.thanks}>Cảm ơn bạn đã đồng hành <span aria-hidden="true">✧</span></p>
      </div></Dialog>}
    </>
  );
}

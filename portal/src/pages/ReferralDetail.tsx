import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReferral, type Referral } from '../lib/api';

const DEFAULT_STATUS: Record<string, string> = {
  new: 'Enviat',
  sent: 'Enviat al departament comercial',
  contacted: 'Client contactat',
  completed: 'Completat',
  cancelled: 'Cancel·lat',
};

const STATUS_ORDER = ['new', 'sent', 'contacted', 'completed', 'cancelled'];

export default function ReferralDetail() {
  const { id } = useParams<{ id: string }>();
  const [referral, setReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getReferral(id)
      .then((r) => {
        if (active) {
          setReferral(r.data ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page-inner">
        <p className="muted">Carregant…</p>
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="page-inner">
        <h1 className="page-title">Referit no trobat</h1>
        <p className="muted">No s\'ha pogut carregar aquest referit.</p>
        <Link className="btn btn-primary" to="/referrals">Torna als meus referits</Link>
      </div>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(referral.status);
  const isCancelled = referral.status === 'cancelled';
  const effectiveIndex = isCancelled ? STATUS_ORDER.indexOf('sent') : currentIndex;

  return (
    <div className="page-inner">
      <Link className="back" to="/referrals">← Els meus referits</Link>
      <h1 className="page-title">{referral.product}</h1>
      <p className="page-sub">Enviat el {formatDate(referral.date_created)}</p>

      <section className="section">
        <h2 className="section-title">Estat</h2>
        <div className="timeline">
          {STATUS_ORDER.map((s, i) => {
            const reached = isCancelled ? i <= 1 : i <= effectiveIndex;
            const current = s === referral.status;
            return (
              <div
                key={s}
                className={
                  'timeline-step' +
                  (reached ? ' reached' : '') +
                  (current ? ' current' : '') +
                  (isCancelled && current ? ' cancelled' : '')
                }
              >
                <span className="timeline-dot" />
                <div className="timeline-body">
                  <strong>{DEFAULT_STATUS[s]}</strong>
                  {current && isCancelled && <em>Cancel·lat</em>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return 'Data desconeguda';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Data desconeguda';
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getServices, getReferrals, getWalletLedger, type Service, type Referral, type WalletEntry } from '../lib/api';
import { FileIcon, ChevronRightIcon } from '../components/Icons';

const FALLBACK_SERVICES: Service[] = [
  { id: 'demo-alarma', code: 'pis', name: 'Alarma per a la llar', category: 'alarma', sector: 'residencial', alta_fee: 599, monthly_fee: 27.99, iva_included: true, details: null, active: true },
  { id: 'demo-cctv', code: 'videovigilancia', name: 'Videovigilància', category: 'videovigilancia', sector: 'residencial', alta_fee: 320, monthly_fee: 12, iva_included: true, details: null, active: true },
  { id: 'demo-acces', code: 'amida', name: 'Control d\'accessos', category: 'manteniment', sector: 'negocio', alta_fee: 250, monthly_fee: 10, iva_included: false, details: null, active: true },
];

const CATEGORY_LABEL: Record<string, string> = {
  alarma: 'Alarma',
  videovigilancia: 'Videovigilància',
  manteniment: 'Manteniment',
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>(FALLBACK_SERVICES);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [ledger, setLedger] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getServices(), getReferrals(), getWalletLedger()])
      .then(([s, r, w]) => {
        if (!active) return;
        if (s.status === 'fulfilled') setServices(s.value.data ?? FALLBACK_SERVICES);
        if (r.status === 'fulfilled') setReferrals(r.value.data ?? []);
        if (w.status === 'fulfilled') setLedger(w.value.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sent = referrals.length;
  const completed = referrals.filter((r) => r.status === 'instalado').length;
  const accumulatedCommission = ledger
    .filter((e) => ['high', 'recurring', 'adjustment'].includes(e.type))
    .reduce((sum, e) => sum + e.amount, 0);
  const walletBalance = ledger.reduce((sum, e) => sum + e.amount, 0);

  const counters = [
    { label: 'Referits enviats', value: sent },
    { label: 'Referits completats', value: completed },
    { label: 'Comissions acumulades', value: fmtEuro(accumulatedCommission) },
    { label: 'Saldo de la cartera', value: fmtEuro(walletBalance) },
  ];

  return (
    <div className="page-inner">
      <h1 className="page-title">Hola, partner 👋</h1>
      <p className="page-sub">Aquest és el resum de la vostra activitat.</p>

      {loading ? (
        <p className="muted">Carregant…</p>
      ) : (
        <>
          <div className="grid-counters">
            {counters.map((c) => (
              <div className="counter" key={c.label}>
                <span className="counter-value">{c.value}</span>
                <span className="counter-label">{c.label}</span>
              </div>
            ))}
          </div>

          <section className="section">
            <h2 className="section-title">Els nostres productes</h2>
            <div className="product-list">
              {services.map((p) => (
                <div className="product-card" key={p.id}>
                  <div className="product-info">
                    <span className="product-cat">{CATEGORY_LABEL[p.category] ?? p.category}</span>
                    <h3>{p.name}</h3>
                    <div className="product-meta">
                      <span>Alta: <strong>{p.alta_fee ? fmtEuro(p.alta_fee) : 'Pressupost'}</strong></span>
                      <span>Quota mensual: <strong>{p.monthly_fee ? fmtEuro(p.monthly_fee) : '—'}</strong></span>
                    </div>
                  </div>
                  <Link className="btn btn-primary" to="/referrals/new" state={{ product: p.name }}>
                    Nou referit
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <Link className="quick-card" to="/materials">
              <span className="quick-card-icon" aria-hidden="true">
                <FileIcon />
              </span>
              <span className="quick-card-text">
                <strong>Materials i recursos</strong>
                <span>Contractes, manuals i documents per a la vostra activitat comercial.</span>
              </span>
              <ChevronRightIcon />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
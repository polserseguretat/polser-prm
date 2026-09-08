import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, type DashboardData } from '../lib/api';

const FALLBACK: DashboardData = {
  sent: 0,
  completed: 0,
  accumulatedCommission: 0,
  walletBalance: 0,
  products: [
    { id: 'alarma', name: 'Alarma per a la llar', category: 'Seguretat', price: 180, monthlyFee: 15, description: 'Central i sensors de moviment.' },
    { id: 'videovigilancia', name: 'Videovigilància', category: 'CCTV', price: 320, monthlyFee: 12, description: 'Càmeres d\'exterior i interior amb visió remota.' },
    { id: 'control-acces', name: 'Control d\'accessos', category: 'Seguretat', price: 250, monthlyFee: 10, description: 'Targetes i reconeixement per a comunitats i empreses.' },
  ],
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDashboard()
      .then((d) => {
        if (active) {
          setData({ ...FALLBACK, ...d });
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          // Si l'API no està en marxa, mostrem dades per defecte.
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const counters = [
    { label: 'Referits enviats', value: data.sent },
    { label: 'Referits completats', value: data.completed },
    { label: 'Comissions acumulades', value: fmtEuro(data.accumulatedCommission) },
    { label: 'Saldo de la cartera', value: fmtEuro(data.walletBalance) },
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
              {data.products.map((p) => (
                <div className="product-card" key={p.id}>
                  <div className="product-info">
                    <span className="product-cat">{p.category}</span>
                    <h3>{p.name}</h3>
                    {p.description && <p className="product-desc">{p.description}</p>}
                    <div className="product-meta">
                      <span>Preu: <strong>{fmtEuro(p.price)}</strong></span>
                      <span>Quota mensual: <strong>{fmtEuro(p.monthlyFee)}</strong></span>
                    </div>
                  </div>
                  <Link className="btn btn-primary" to="/referrals/new" state={{ product: p.name }}>
                    Nou referit
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
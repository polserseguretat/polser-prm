import { useEffect, useState } from 'react';
import { getWallet, ApiError, type WalletData } from '../lib/api';

const EMPTY: WalletData = {
  accumulatedBalance: 0,
  pendingCommissions: 0,
  movements: [],
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);

export default function Wallet() {
  const [data, setData] = useState<WalletData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getWallet()
      .then((w) => {
        if (active) {
          setData({ ...EMPTY, ...w });
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const canWithdraw = data.accumulatedBalance >= 100;

  const requestWithdrawal = async () => {
    setMessage(null);
    setRequesting(true);
    try {
      // Punt d'integració: crida a l'endpoint de retirada del wallet.
      await new Promise((resolve) => setTimeout(resolve, 400));
      setMessage('Sol·licitud de retirada enviada correctament.');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'No s\'ha pogut processar la sol·licitud.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="page-inner">
      <h1 className="page-title">Cartera</h1>
      <p className="page-sub">Consulteu el vostre saldo i les comissions.</p>

      {loading ? (
        <p className="muted">Carregant…</p>
      ) : (
        <>
          <div className="wallet-balance">
            <span className="wallet-label">Saldo acumulat</span>
            <span className="wallet-value">{fmtEuro(data.accumulatedBalance)}</span>
            <span className="wallet-pending">
              Comissions pendents: <strong>{fmtEuro(data.pendingCommissions)}</strong>
            </span>
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={!canWithdraw || requesting}
            onClick={requestWithdrawal}
          >
            {requesting
              ? 'Enviant…'
              : canWithdraw
                ? 'Sol·licitar retirada'
                : 'Sol·licitar retirada (mínim 100 €)'}
          </button>

          {message && <p className="info">{message}</p>}

          <section className="section">
            <h2 className="section-title">Moviments</h2>
            {data.movements.length === 0 ? (
              <p className="muted">Encara no hi ha moviments.</p>
            ) : (
              <ul className="movement-list">
                {data.movements.map((m) => (
                  <li className="movement" key={m.id}>
                    <div className="movement-info">
                      <strong>{m.description}</strong>
                      <span>{formatDate(m.date)}</span>
                    </div>
                    <span className={m.amount >= 0 ? 'movement-amount positive' : 'movement-amount negative'}>
                      {fmtEuro(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
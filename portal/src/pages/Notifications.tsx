import { useEffect, useState } from 'react';
import { getNotifications, type NotificationItem } from '../lib/api';

const FALLBACK: NotificationItem[] = [
  { id: 'n1', title: 'Benvingut al portal', body: 'Gràcies per formar part de la xarxa de partners de POLSER SEGURETAT. Ja podeu registrar referits i consultar la vostra cartera.', created_at: '2026-09-05T09:00:00Z', read: true },
  { id: 'n2', title: 'Nou referit registrat', body: 'El referit del servei «pis» per a Barcelona s\'ha registrat correctament i ja l\'estem gestionant.', created_at: '2026-09-07T11:30:00Z', read: false },
  { id: 'n3', title: 'Comissió acumulada', body: 'S\'ha acreditat la comissió d\'alta de 60,00 € a la vostra cartera.', created_at: '2026-09-08T08:00:00Z', read: false },
  { id: 'n4', title: 'Campanya Setmana', body: 'Aquesta setmana us proposem prioritzar el servei de videovigilància: condiciones especials per a nous clients.', created_at: '2026-09-08T12:00:00Z', read: false },
];

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((res) => {
        if (active) {
          setItems(res.data ?? FALLBACK);
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

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="page-inner">
      <h1 className="page-title">Notificacions</h1>
      <p className="page-sub">
        Avisos i campanyes de POLSER SEGURETAT.
        {unread > 0 && <span className="notif-unread-count">{unread} pendents</span>}
      </p>

      {loading ? (
        <p className="muted">Carregant…</p>
      ) : items.length === 0 ? (
        <p className="muted">No hi ha cap notificació.</p>
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li className={`notif-item${n.read ? '' : ' unread'}`} key={n.id}>
              <span className="notif-dot" aria-hidden="true" />
              <div className="notif-body">
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <span>{formatDate(n.created_at)}</span>
              </div>
              {!n.read && (
                <button type="button" className="btn-ghost notif-action" onClick={() => markRead(n.id)}>
                  Marcar llegida
                </button>
              )}
            </li>
          ))}
        </ul>
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
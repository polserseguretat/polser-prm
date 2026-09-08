import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createReferral, ApiError, type ReferralPayload } from '../lib/api';

const PRODUCTS = [
  'Alarma per a la llar',
  'Videovigilància',
  'Control d\'accessos',
];

export default function ReferralNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const suggested = (location.state as { product?: string } | null)?.product;

  const [form, setForm] = useState<ReferralPayload>({
    client_name: '',
    client_phone: '',
    client_email: '',
    product: suggested ?? '',
    comments: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ReferralPayload, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.client_name.trim()) {
      setError('Introduïu el nom del client.');
      return;
    }
    if (!form.product) {
      setError('Seleccioneu un producte o servei.');
      return;
    }

    setLoading(true);
    try {
      await createReferral(form);
      navigate('/referrals', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No s\'ha pogut crear el referit. Torneu-ho a provar.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-inner">
      <h1 className="page-title">Nou referit</h1>
      <p className="page-sub">Envieu una referència d\'un client potencial.</p>

      <form onSubmit={submit} className="form form-card">
        <label className="field">
          <span>Nom del client</span>
          <input
            value={form.client_name}
            onChange={(e) => set('client_name', e.target.value)}
            placeholder="Nom i cognoms"
          />
        </label>

        <label className="field">
          <span>Telèfon</span>
          <input
            type="tel"
            value={form.client_phone}
            onChange={(e) => set('client_phone', e.target.value)}
            placeholder="600 000 000"
          />
        </label>

        <label className="field">
          <span>Correu electrònic</span>
          <input
            type="email"
            value={form.client_email}
            onChange={(e) => set('client_email', e.target.value)}
            placeholder="client@exemple.cat"
          />
        </label>

        <label className="field">
          <span>Producte / servei</span>
          <select value={form.product} onChange={(e) => set('product', e.target.value)}>
            <option value="">Seleccioneu…</option>
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Comentaris (opcional)</span>
          <textarea
            rows={3}
            value={form.comments ?? ''}
            onChange={(e) => set('comments', e.target.value)}
            placeholder="Notes internes per al referit."
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Cancel·lar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enviant…' : 'Envia el referit'}
          </button>
        </div>
      </form>
    </div>
  );
}
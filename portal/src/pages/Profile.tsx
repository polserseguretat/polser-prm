import { useEffect, useState } from 'react';
import { getPartnerProfile, type PartnerProfile } from '../lib/api';

const FALLBACK: PartnerProfile = {
  id: 'p1',
  name: 'Polser Partners SL',
  profile: 'colaborador',
  type: 'administrador_fincas',
  nif: 'B12345678',
  email: 'partners@exemple.cat',
  phone: '+34 600 000 000',
  address: 'Carrer de Provença 300, 08037 Barcelona',
  status: 'actiu',
};

const PROFILE_LABEL: Record<string, string> = {
  afiliat: 'Afiliat',
  colaborador: 'Col·laborador',
};

const TYPE_LABEL: Record<string, string> = {
  inmobiliaria: 'Inmobiliària',
  administrador_fincas: 'Administrador de finques',
  operador_telecom: 'Operador de telecomunicacions',
  autonomo: 'Autònom',
  otro: 'Altres',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendent',
  actiu: 'Actiu',
  inactiu: 'Inactiu',
  bloquejat: 'Bloquejat',
};

export default function Profile() {
  const [profile, setProfile] = useState<PartnerProfile>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPartnerProfile()
      .then((res) => {
        if (active) {
          setProfile(res.data ?? FALLBACK);
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

  const rows: Array<[string, string | undefined]> = [
    ['Perfil', PROFILE_LABEL[profile.profile] ?? profile.profile],
    ['Tipus', TYPE_LABEL[profile.type] ?? profile.type],
    ['NIF / DNI', profile.nif],
    ['Correu electrònic', profile.email],
    ['Telèfon', profile.phone],
    ['Adreça', profile.address],
    ['Estat', profile.status ? STATUS_LABEL[profile.status] ?? profile.status : undefined],
  ];

  return (
    <div className="page-inner">
      <h1 className="page-title">El meu perfil</h1>
      <p className="page-sub">Dades de la vostra organització.</p>

      {loading ? (
        <p className="muted">Carregant…</p>
      ) : (
        <div className="profile-card">
          <div className="profile-head">
            <span className="brand-logo" aria-hidden="true">
              P
            </span>
            <div className="profile-head-text">
              <h2>{profile.name}</h2>
              <span className="profile-role">
                {PROFILE_LABEL[profile.profile] ?? profile.profile}
              </span>
            </div>
          </div>

          <dl className="profile-rows">
            {rows.map(
              ([label, value]) =>
                value && (
                  <div className="profile-row" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
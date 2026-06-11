// Login page — refactored to plain HTML/CSS for Android TV Browser compatibility

import { useState } from 'react';
import { login as apiLogin } from '../api/auth';
import { useAuthStore } from '../store/auth-store';
import { useNavigate } from 'react-router-dom';

const styles = `
  .login-container {
    min-height: 100vh;
    width: 100%;
    background-color: #F6F8FB;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
  }

  .login-wrapper {
    max-width: 960px;
    width: 100%;
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(300px, 0.92fr) minmax(340px, 1fr);
    min-height: 560px;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 18px 50px rgba(10, 25, 47, 0.12);
  }

  .login-brand {
    background-color: #1565C0;
    color: white;
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 100%;
  }

  .login-brand-logo {
    width: 100%;
    max-width: 260px;
    padding: 18px 20px;
    border-radius: 8px;
    background: rgba(10, 25, 47, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-brand-logo img {
    width: 100%;
    height: auto;
    object-fit: contain;
  }

  .login-brand-copy {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 56px;
  }

  .login-brand-title {
    font-size: 30px;
    line-height: 1.12;
    font-weight: 700;
    letter-spacing: 0;
  }

  .login-brand-text {
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.78);
    max-width: 330px;
  }

  .login-brand-meta {
    display: grid;
    gap: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
  }

  .login-panel {
    padding: 48px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .login-card {
    width: 100%;
  }

  .login-card-title {
    font-size: 26px;
    font-weight: 700;
    color: #0A192F;
    margin-bottom: 6px;
  }

  .login-card-subtitle {
    font-size: 14px;
    color: #64748B;
    margin-bottom: 28px;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .login-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .login-label {
    font-size: 13px;
    font-weight: 650;
    color: #334155;
  }

  .login-input {
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid #D8DEE7;
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    -webkit-appearance: none;
    appearance: none;
  }

  .login-input:focus {
    border-color: #1565C0;
    box-shadow: 0 0 0 3px rgba(21,101,192,0.10);
  }

  .login-error {
    background-color: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 8px;
    padding: 12px 16px;
  }

  .login-error-text {
    font-size: 14px;
    color: #991B1B;
    font-weight: 500;
  }

  .login-submit {
    background-color: #1565C0;
    color: white;
    padding: 13px 16px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    transition: background-color 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 8px 18px rgba(21, 101, 192, 0.22);
  }

  .login-submit:hover:not(:disabled) {
    background-color: #0F559F;
    transform: translateY(-1px);
  }

  .login-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 760px) {
    .login-container {
      padding: 12px;
      align-items: stretch;
    }

    .login-wrapper {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .login-brand {
      min-height: auto;
      padding: 24px;
      gap: 24px;
    }

    .login-brand-copy {
      margin-top: 20px;
    }

    .login-brand-title {
      font-size: 24px;
    }

    .login-panel {
      padding: 28px 22px;
    }
  }
`;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authStore = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Preencha todos os campos');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const storedStationId = localStorage.getItem('katondo_browser_station_id');
      const browserStationId = storedStationId ? parseInt(storedStationId) : null;

      const data = await apiLogin(username, password, browserStationId);
      authStore.login(data.user, data.token, data.refreshToken);

      if ((data.user as any).firstLogin) {
        authStore.setDefaultPassword(true);
      }

      // Route based on role
      switch (data.user.role) {
        case 'root': navigate('/root/admins'); break;
        case 'admin': navigate('/admin/dashboard'); break;
        case 'reception': navigate('/reception/queue'); break;
        case 'management': navigate('/management/dashboard'); break;
        case 'display': navigate('/display'); break;
        case 'dispenser': navigate('/dispenser'); break;
        default: navigate('/login');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao iniciar sessão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <style>{styles}</style>
      <div className="login-wrapper">
        <aside className="login-brand">
          <div>
            <div className="login-brand-logo">
              <img src="/logo-katondo.png" alt="Clínica Katondo" />
            </div>
            <div className="login-brand-copy">
              <div className="login-brand-title">Gestão de Filas</div>
              <div className="login-brand-text">
                Painel operacional para recepção, administração, displays e dispensadores.
              </div>
            </div>
          </div>
          <div className="login-brand-meta">
            <div>Clínica General Katondo</div>
            <div>Talatona, Luanda</div>
            <div>Atendimento 24h | +244 923 168 644</div>
          </div>
        </aside>

        <main className="login-panel">
          <div className="login-card">
            <div className="login-card-title">Iniciar Sessão</div>
            <div className="login-card-subtitle">Introduza as suas credenciais para aceder ao sistema.</div>

            <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="login-field">
                <label className="login-label" htmlFor="username">Utilizador</label>
                <input
                  id="username"
                  className="login-input"
                  type="text"
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  placeholder="nome.utilizador"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoComplete="username"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="password">Senha</label>
                <input
                  id="password"
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="login-error">
                  <div className="login-error-text">{error}</div>
                </div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >
                {loading ? 'A entrar...' : 'Entrar'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

// Login page — refactored to plain HTML/CSS for Android TV Browser compatibility

import { useState } from 'react';
import { login as apiLogin } from '../api/auth';
import { useAuthStore } from '../store/auth-store';
import { useNavigate } from 'react-router-dom';

const styles = `
  .login-container {
    min-height: 100vh;
    width: 100%;
    background-color: #FAFAF9;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    position: relative;
  }

  .login-bg-pattern {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.4;
    pointer-events: none;
    background-image: radial-gradient(circle at 20% 80%, rgba(21,101,192,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(5,150,105,0.06) 0%, transparent 50%);
  }

  .login-wrapper {
    max-width: 420px;
    width: 100%;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .login-logo {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }

  .login-logo-icon {
    width: 56px;
    height: 56px;
    background-color: #059669;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(5,150,105,0.30);
  }

  .login-logo-icon-text {
    font-size: 24px;
    font-weight: bold;
    color: white;
  }

  .login-logo-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 24px;
    font-weight: 400;
    color: #1565C0;
    line-height: 1.2;
    text-align: center;
  }

  .login-logo-subtitle {
    font-size: 11px;
    color: #78716C;
    letter-spacing: 0.12em;
    font-weight: 500;
    text-align: center;
  }

  .login-card {
    width: 100%;
    padding: 32px;
    border-radius: 20px;
    background-color: white;
    box-shadow: 0 1px 3px rgba(10,25,47,0.06), 0 8px 24px rgba(10,25,47,0.06);
    border: 1px solid rgba(0,0,0,0.05);
  }

  .login-card-title {
    font-size: 20px;
    font-weight: 600;
    color: #1C1917;
    margin-bottom: 4px;
  }

  .login-card-subtitle {
    font-size: 14px;
    color: #78716C;
    margin-bottom: 24px;
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
    font-size: 14px;
    font-weight: 500;
    color: #1C1917;
  }

  .login-input {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.05);
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
    border-radius: 10px;
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
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
  }

  .login-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .login-footer-text {
    font-size: 12px;
    color: #A8A29E;
    text-align: center;
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
      const data = await apiLogin(username, password);
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
      <div className="login-bg-pattern" />
      <style>{styles}</style>
      <div className="login-wrapper">
        {/* Logo */}
        <div className="login-logo">
          <img
            src="/logo-katondo.png"
            alt="Clínica Katondo Logo"
            style={{ height: '70px', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
            <div className="login-logo-subtitle" style={{ fontSize: '11px', marginTop: '4px' }}>GESTÃO DE FILAS</div>
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-card-title">Iniciar Sessão</div>
          <div className="login-card-subtitle">Introduza as suas credenciais para aceder ao sistema</div>

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

        {/* Footer */}
        <div className="login-footer">
          <div className="login-footer-text">Clínica General Katondo — Talatona, Luanda</div>
          <div className="login-footer-text">Atendimento 24h | +244 923 168 644</div>
        </div>
      </div>
    </div>
  );
}

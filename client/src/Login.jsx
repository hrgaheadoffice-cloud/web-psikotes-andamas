// client/src/Login.jsx
import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Swal from 'sweetalert2';

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // BERSIHKAN INPUT SPASI & CAPITAL DARI KEYBOARD HP
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      await login(cleanUsername, cleanPassword);
    } catch (err) {
      setError('Username atau kata sandi salah');
      Swal.fire('Gagal Masuk', 'Username atau kata sandi salah', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-700 to-[#d3c0aa] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-sm border border-neutral-200">
        {/* Logo / Title */}
        <div>
          <div className="flex justify-center mb-6">
            <img
              src="/Logo_Login_2.png"
              alt="Web Psikotes Logo"
              className="h-20 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900 font-display">
            Web Psikotes
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field appearance-none relative block w-full px-4 py-3 sm:text-sm"
                placeholder="Username"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Kata Sandi
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field appearance-none relative block w-full px-4 py-3 sm:text-sm"
                placeholder="Kata Sandi"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-error text-center bg-error-light p-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary group relative w-full flex justify-center py-3 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Masuk'
              )}
            </button>
          </div>

          <div className="text-center text-xs text-neutral-400 mt-4">
            © {new Date().getFullYear()} Web Psikotes. Hak cipta dilindungi.
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
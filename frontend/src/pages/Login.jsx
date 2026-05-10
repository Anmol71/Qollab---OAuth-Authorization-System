import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [clientName, setClientName] = useState('');
  const navigate = useNavigate();

  const appChoices = [
    {
      key: 'amazon',
      label: 'Amazon Shopping',
      description: 'Checkout, account sync, and profile import',
      color: 'bg-orange-500'
    },
    {
      key: 'flipkart',
      label: 'Flipkart Marketplace',
      description: 'Cart sync, order tracking, and contacts match',
      color: 'bg-blue-600'
    }
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('auth_url');
    const err = params.get('error');

    if (err) {
      setError('OAuth error: ' + err);
    }

    if (url) {
      setAuthUrl(url);
      try {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const clientId = urlParams.get('client_id');
        if (clientId) {
          setClientName(clientId);
        }
      } catch (e) {}
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!authUrl) {
        setError('No authorization URL. Please start from http://localhost:3003/login');
        setLoading(false);
        return;
      }

      await axios.get('http://localhost:3001/authorize?' + authUrl.split('?')[1], {
        withCredentials: true
      });

      const loginResponse = await axios.post(
        'http://localhost:3001/authorize/login',
        { email, password },
        { withCredentials: true }
      );

      const data = loginResponse.data;

      if (data.action === 'consent_required') {
        sessionStorage.setItem('consentData', JSON.stringify(data));
        navigate('/consent');
      } else if (data.action === 'redirect' && data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        setError('Unexpected response from server');
      }
    } catch (err) {
      const msg =
        err.response && err.response.data
          ? err.response.data.error_description || err.response.data.error
          : 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function normalizedClientDisplay() {
    if (!clientName) {
      return 'Third-party application';
    }
    if (clientName === 'amazon-client-001') {
      return 'Amazon Shopping';
    }
    if (clientName === 'flipkart-client-001') {
      return 'Flipkart Marketplace';
    }
    if (clientName === 'test-client-001') {
      return 'Test Client Application';
    }
    return clientName;
  }

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 lg:p-10">
          <div className="flex items-center gap-2 mb-8">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-slate-500 text-sm font-medium">Qollab Account</span>
          </div>

          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Sign in</h1>
          <p className="text-slate-600 mt-2">to continue to {normalizedClientDisplay()}</p>

          {authUrl && (
            <div className="mt-5 inline-flex items-center rounded-full px-3 py-1 bg-slate-100 text-xs text-slate-600">
              Requesting app: <span className="ml-1 font-semibold text-slate-800">{normalizedClientDisplay()}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-8">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email or phone</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="alice@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Enter your password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="password123"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {!authUrl && !error && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                Select an app from the right panel to begin OAuth authorization.
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={loading || !authUrl}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-full text-sm font-medium transition"
              >
                {loading ? 'Signing in...' : 'Next'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
            <p className="font-medium mb-1">Demo credentials</p>
            <p>alice@example.com / password123</p>
            <p>bob@example.com / password456</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-3xl shadow-sm p-8 lg:p-10 text-white">
          <h2 className="text-2xl font-semibold tracking-tight">Choose requesting client</h2>
          <p className="text-slate-200 mt-2 text-sm">Start OAuth as a shopping partner app, similar to third-party sign-in flows.</p>

          <div className="mt-6 space-y-3">
            {appChoices.map((app) => (
              <a
                key={app.key}
                href={`http://localhost:3003/login?app=${app.key}`}
                className="block rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 transition p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${app.color} flex items-center justify-center text-white font-bold`}>
                    {app.label[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{app.label}</p>
                    <p className="text-xs text-slate-200 mt-1">{app.description}</p>
                  </div>
                </div>
              </a>
            ))}
        </div>

          <div className="mt-6 p-4 rounded-2xl bg-white/10 border border-white/20 text-xs text-slate-100">
            <p className="font-semibold mb-2">What happens next?</p>
            <p>1. You sign in with your account</p>
            <p>2. You choose permissions (profile, email, contacts)</p>
            <p>3. Access token is issued only for selected scopes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

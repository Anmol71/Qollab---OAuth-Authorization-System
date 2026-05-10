import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Consent() {
  const [consentData, setConsentData] = useState(null);
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const raw = sessionStorage.getItem('consentData');
    if (!raw) {
      setError('No consent data found. Please start from the beginning.');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setConsentData(parsed);
      setSelectedScopes(parsed.requested_scopes || []);
    } catch (e) {
      setError('Invalid consent data.');
    }
  }, []);

  function toggleScope(scope) {
    setSelectedScopes(function (prev) {
      if (prev.includes(scope)) {
        return prev.filter(function (s) {
          return s !== scope;
        });
      }
      return prev.concat(scope);
    });
  }

  async function handleDecision(approved) {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        'http://localhost:3001/authorize/consent',
        { approved, selected_scopes: selectedScopes },
        { withCredentials: true }
      );

      const data = response.data;
      sessionStorage.removeItem('consentData');

      if (data.action === 'redirect' && data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        navigate('/login');
      }
    } catch (err) {
      const msg =
        err.response && err.response.data
          ? err.response.data.error_description || err.response.data.error
          : 'An error occurred.';
      setError(msg);
      setLoading(false);
    }
  }

  if (error && !consentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a
            href="http://localhost:3003/login"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            Start Over
          </a>
        </div>
      </div>
    );
  }

  if (!consentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200 p-8 lg:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
            {consentData.client_name ? consentData.client_name[0].toUpperCase() : 'A'}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {consentData.client_name || 'Application'} wants access to your account
            </h1>
            {consentData.user_name && <p className="text-sm text-slate-500 mt-1">Signed in as {consentData.user_name}</p>}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 p-4 rounded-2xl border border-slate-200 bg-slate-50">
          <p className="text-sm font-medium text-slate-700 mb-3">Select what you want to share</p>
          <div className="space-y-2">
            {(consentData.requested_scopes || []).map((scope) => {
              const checked = selectedScopes.includes(scope);
              return (
                <label
                  key={scope}
                  className={
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ' +
                    (checked
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-slate-200 hover:border-slate-300')
                  }
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-blue-600"
                    checked={checked}
                    onChange={() => toggleScope(scope)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900 capitalize">{scope}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {consentData.scope_descriptions && consentData.scope_descriptions[scope]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-6">
          Only selected scopes will be granted to this client in the issued access token.
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => handleDecision(false)}
            disabled={loading}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-full transition text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDecision(true)}
            disabled={loading || selectedScopes.length === 0}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition text-sm disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  );
}

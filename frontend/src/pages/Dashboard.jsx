import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:3003';

export default function Dashboard() {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [data, setData] = useState({});
  const [loadingTab, setLoadingTab] = useState('');
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('token');
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(API + '/dashboard', { withCredentials: true })
      .then((r) => setTokenInfo(r.data))
      .catch(() => navigate('/login'));
  }, [navigate]);

  useEffect(() => {
    if (!tokenInfo || !tokenInfo.tokens) {
      return;
    }

    const grantedScopes = new Set((tokenInfo.tokens.scope || '').split(' ').filter(Boolean));
    const visibleTabs = ['token'];
    if (grantedScopes.has('profile')) {
      visibleTabs.push('profile');
    }
    if (grantedScopes.has('wishlist')) {
      visibleTabs.push('wishlist');
    }
    if (grantedScopes.has('orders')) {
      visibleTabs.push('orders');
    }
    if (grantedScopes.has('account')) {
      visibleTabs.push('account');
    }
    if (grantedScopes.has('contacts')) {
      visibleTabs.push('contacts');
    }

    if (!visibleTabs.includes(activeTab)) {
      setActiveTab('token');
    }
  }, [tokenInfo]);

  async function fetchData(endpoint, key) {
    setLoadingTab(key);
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      const r = await axios.get(API + '/api-demo/' + endpoint, { withCredentials: true });
      setData((prev) => ({ ...prev, [key]: r.data }));
    } catch (err) {
      const msg =
        err.response && err.response.data
          ? err.response.data.error_description || err.response.data.error
          : 'Request failed';
      setErrors((prev) => ({ ...prev, [key]: msg }));
    } finally {
      setLoadingTab('');
    }
  }

  async function handleLogout() {
    try {
      await axios.get(API + '/logout', { withCredentials: true });
    } catch (e) {}
    navigate('/login');
  }

  function formatExpiry(expiresIn, receivedAt) {
    if (!expiresIn || !receivedAt) {
      return 'Unknown';
    }

    const expiresAt = new Date(receivedAt + expiresIn * 1000);
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

    if (remaining === 0) {
      return 'Expired';
    }
    if (remaining < 60) {
      return remaining + 's remaining';
    }

    return Math.floor(remaining / 60) + 'm ' + (remaining % 60) + 's remaining';
  }

  function decodeJWT(token) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return {
        sub: payload.sub,
        scope: payload.scope,
        exp: new Date(payload.exp * 1000).toLocaleString(),
        iat: new Date(payload.iat * 1000).toLocaleString(),
        jti: payload.jti,
        iss: payload.iss
      };
    } catch (e) {
      return null;
    }
  }

  const grantedScopes = new Set((tokenInfo && tokenInfo.tokens && tokenInfo.tokens.scope ? tokenInfo.tokens.scope : '').split(' ').filter(Boolean));
  const tabs = [{ id: 'token', label: 'Token Info' }];
  if (grantedScopes.has('profile')) {
    tabs.push({ id: 'profile', label: 'Profile' });
  }
  if (grantedScopes.has('wishlist')) {
    tabs.push({ id: 'wishlist', label: 'Wishlist' });
  }
  if (grantedScopes.has('orders')) {
    tabs.push({ id: 'orders', label: 'Orders' });
  }
  if (grantedScopes.has('account')) {
    tabs.push({ id: 'account', label: 'Account Settings' });
  }
  if (grantedScopes.has('contacts')) {
    tabs.push({ id: 'contacts', label: 'Contacts' });
  }

  if (!tokenInfo) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading dashboard...</div>;
  }

  const decoded = tokenInfo.tokens && tokenInfo.tokens.access_token ? decodeJWT(tokenInfo.tokens.access_token) : null;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-gray-900">OAuth 2.0 Dashboard</span>
            {tokenInfo.client && (
              <p className="text-xs text-gray-500">Connected client: {tokenInfo.client.label}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
        >
          Revoke & Logout
        </button>
      </div>

      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ' +
                (activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'token' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Access Token Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Token type</span>
                  <span className="font-mono text-indigo-600">{tokenInfo.tokens.token_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expiry</span>
                  <span className="text-orange-600">{formatExpiry(tokenInfo.tokens.expires_in, tokenInfo.received_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Has refresh token</span>
                  <span className={tokenInfo.tokens.has_refresh_token ? 'text-green-600' : 'text-red-600'}>
                    {tokenInfo.tokens.has_refresh_token ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Scopes granted</span>
                  <div className="flex flex-wrap gap-2">
                    {(tokenInfo.tokens.scope || '').split(' ').map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {decoded && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Decoded JWT Payload</h2>
                <div className="space-y-2 text-sm font-mono">
                  {Object.entries(decoded).map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <span className="text-gray-400 w-12 shrink-0">{k}</span>
                      <span className="text-gray-800 break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              User Profile <span className="text-xs font-normal text-gray-400 ml-2">requires: profile scope</span>
            </h2>
            {!data.profile && !errors.profile && (
              <button
                onClick={() => fetchData('profile', 'profile')}
                disabled={loadingTab === 'profile'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loadingTab === 'profile' ? 'Loading...' : 'Fetch Profile'}
              </button>
            )}
            {errors.profile && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{errors.profile}</div>}
            {data.profile && (
              <div className="flex items-start gap-4">
                <img src={data.profile.avatar} alt={data.profile.name} className="w-16 h-16 rounded-full" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-lg text-gray-900">{data.profile.name}</p>
                  <p className="text-gray-500">{data.profile.email}</p>
                  <p className="text-gray-600">{data.profile.bio}</p>
                  <p className="text-gray-400 text-xs">
                    Member since {new Date(data.profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Wishlist <span className="text-xs font-normal text-gray-400 ml-2">requires: wishlist scope</span>
            </h2>
            {!data.wishlist && !errors.wishlist && (
              <button
                onClick={() => fetchData('wishlist', 'wishlist')}
                disabled={loadingTab === 'wishlist'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loadingTab === 'wishlist' ? 'Loading...' : 'Fetch Wishlist'}
              </button>
            )}
            {errors.wishlist && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{errors.wishlist}</div>}
            {data.wishlist && (
              <div className="space-y-3">
                {data.wishlist.wishlist.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 flex gap-4">
                    <img src={item.image_url} alt={item.product_name} className="w-16 h-16 rounded bg-gray-100" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      <p className="text-sm text-indigo-600 font-bold">₹{item.price.toLocaleString()}</p>
                      <div className="flex gap-2 mt-2">
                        <span className={item.availability === 'In Stock' ? 'text-xs text-green-600' : 'text-xs text-red-600'}>
                          {item.availability}
                        </span>
                        <span className="text-xs text-gray-400">Added {item.added_at}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Orders <span className="text-xs font-normal text-gray-400 ml-2">requires: orders scope</span>
            </h2>
            {!data.orders && !errors.orders && (
              <button
                onClick={() => fetchData('orders', 'orders')}
                disabled={loadingTab === 'orders'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loadingTab === 'orders' ? 'Loading...' : 'Fetch Orders'}
              </button>
            )}
            {errors.orders && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{errors.orders}</div>}
            {data.orders && (
              <div className="space-y-3">
                {data.orders.orders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{order.order_number}</p>
                        <p className="text-sm text-gray-500">{order.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">₹{order.total.toLocaleString()}</p>
                        <p className={`text-xs font-medium mt-1 ${order.status === 'Delivered' ? 'text-green-600' : order.status === 'In Transit' ? 'text-blue-600' : 'text-orange-600'}`}>
                          {order.status}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{order.items_count} items • Tracking: {order.tracking_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Account Settings <span className="text-xs font-normal text-gray-400 ml-2">requires: account scope</span>
            </h2>
            {!data.account && !errors.account && (
              <button
                onClick={() => fetchData('account', 'account')}
                disabled={loadingTab === 'account'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loadingTab === 'account' ? 'Loading...' : 'Fetch Account Settings'}
              </button>
            )}
            {errors.account && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{errors.account}</div>}
            {data.account && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Primary Email</p>
                  <p className="font-semibold text-gray-900">{data.account.account.primary_email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Phone</p>
                  <p className="font-semibold text-gray-900">{data.account.account.phone}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Default Address</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{data.account.account.default_address.address_line_1}</p>
                    <p>{data.account.account.default_address.city}, {data.account.account.default_address.state} {data.account.account.default_address.zipcode}</p>
                    <p>{data.account.account.default_address.country}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Notification Preferences</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Updates</span>
                      <span className={data.account.account.notification_preferences.order_updates ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {data.account.account.notification_preferences.order_updates ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Promotional Emails</span>
                      <span className={data.account.account.notification_preferences.promotional_emails ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {data.account.account.notification_preferences.promotional_emails ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Wishlist Alerts</span>
                      <span className={data.account.account.notification_preferences.wishlist_alerts ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {data.account.account.notification_preferences.wishlist_alerts ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 text-xs text-gray-500">
                  <p>Account Tier: <span className="text-gray-900 font-semibold">{data.account.account.account_tier}</span></p>
                  <p>Member Since: {new Date(data.account.account.member_since).toLocaleDateString()}</p>
                  <p>Saved Payment Methods: {data.account.account.saved_payment_methods}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Contacts <span className="text-xs font-normal text-gray-400 ml-2">requires: contacts scope</span>
            </h2>
            {!data.contacts && !errors.contacts && (
              <button
                onClick={() => fetchData('contacts', 'contacts')}
                disabled={loadingTab === 'contacts'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loadingTab === 'contacts' ? 'Loading...' : 'Fetch Contacts'}
              </button>
            )}
            {errors.contacts && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{errors.contacts}</div>}
            {data.contacts && (
              <div className="space-y-2">
                {data.contacts.contacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 border rounded-lg p-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">
                      {c.name[0]}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-gray-500">
                        {c.email} - {c.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

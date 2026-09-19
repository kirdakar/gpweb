import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

// लॉगिन झालेल्या वापरकर्त्याचे स्क्रीन/बटण अधिकार (यूजर मास्टर > अधिकार
// स्क्रीनमध्ये प्रशासकाने ठरवलेले) - मेनू आयटम लपवणे/दाखवणे आणि बटणे
// निष्क्रिय करणे यासाठी संपूर्ण अ‍ॅपमध्ये वापरतो. admin ला नेहमी सर्व
// अधिकार (बॅकएंडवरून already true येतात - पहा users.routes.js).
const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setPermissions({}); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await client.get('/users/me/permissions');
      setPermissions(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const isAdmin = user?.role === 'admin';
  const can = useCallback(
    (screenCode, actionCode) => isAdmin || !!permissions[`${screenCode}:${actionCode}`],
    [isAdmin, permissions]
  );

  return (
    <PermissionsContext.Provider value={{ permissions, loading, isAdmin, can, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}

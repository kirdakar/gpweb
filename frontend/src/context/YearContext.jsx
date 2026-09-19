import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

const YearContext = createContext(null);

export function YearProvider({ children }) {
  const { user } = useAuth();
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(() => {
    const saved = localStorage.getItem('gpweb_year_id');
    return saved ? Number(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await client.get('/years');
      setYears(data);
      setYearId((current) => {
        if (current && data.some((y) => y.id === current)) return current;
        const active = data.find((y) => y.is_active) || data[data.length - 1];
        return active ? active.id : null;
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (yearId) localStorage.setItem('gpweb_year_id', String(yearId));
  }, [yearId]);

  const currentYear = years.find((y) => y.id === yearId) || null;

  return (
    <YearContext.Provider value={{ years, yearId, setYearId, currentYear, loading, refresh }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used within YearProvider');
  return ctx;
}

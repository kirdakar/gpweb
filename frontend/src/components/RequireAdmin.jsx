import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// यूजर मास्टर व अधिकार स्क्रीन फक्त प्रशासकालाच (role='admin') दिसावी -
// per-user अधिकार मॅट्रिक्समध्ये या स्क्रीनला परवानगी दिली तरी उपयोग नाही,
// कारण त्याच स्क्रीनवरून बाकीच्यांचे अधिकार बदलता येतात (बॅकएंडवरही
// requireAdmin नेच संरक्षित - पहा middleware/permissions.js).
export default function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

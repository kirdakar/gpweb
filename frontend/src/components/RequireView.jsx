import { Navigate, useParams } from 'react-router-dom';
import { usePermissions } from '../context/PermissionsContext';

// एखाद्या स्क्रीनला दिलेला अधिकार नसेल तर सरळ URL टाइप करूनही ती उघडता येऊ
// नये म्हणून राऊटवरच लावलेला गार्ड (मेनूतून लपवणे हे फक्त सोय आहे, सुरक्षा नाही).
// डीफॉल्ट action 'view' आहे. उदा. "/properties/:id" हाच राऊट "new" साठीही
// (id === 'new') वापरला जातो - PropertyDetail.jsx चा isNew शोध यावरच अवलंबून
// आहे, म्हणून वेगळा static "/properties/new" राऊट काढल्यास id पॅरामीटरच
// मिळत नाही आणि isNew कायम false ठरते. त्याऐवजी action ला फंक्शन देऊन
// राऊट पॅरामीटरनुसार आवश्यक अधिकार ठरवता येतो (उदा. id==='new' तर 'add',
// अन्यथा 'view') - फक्त "नवीन नोंद" अधिकार दिलेला वापरकर्ताही ती स्क्रीन
// उघडू शकतो, यादी/संपादन 'view' शिवाय उघडता येत नाही.
export default function RequireView({ screen, action = 'view', children }) {
  const { can, loading } = usePermissions();
  const params = useParams();
  const resolvedAction = typeof action === 'function' ? action(params) : action;
  if (loading) return null;
  if (!can(screen, resolvedAction)) return <Navigate to="/" replace />;
  return children;
}

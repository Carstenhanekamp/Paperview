import { useLocation } from 'react-router-dom';
import { useAuthContext } from '../AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { documentTitleForUi } from '../profileOnboarding';

/** Sets the Safari/browser tab title from the named library on /app. */
export default function DocumentTitle() {
  const { pathname } = useLocation();
  const auth = useAuthContext();
  useDocumentTitle(documentTitleForUi(auth?.profile, pathname));
  return null;
}

import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import LandingPage from './LandingPage';
import PaperviewApp from './PaperviewApp';
import DesktopGate from './DesktopGate';
import WelcomePage from './components/WelcomePage';
import { AuthProvider } from './AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/app" element={<DesktopGate><PaperviewApp /></DesktopGate>} />
        <Route path="/app/*" element={<DesktopGate><PaperviewApp /></DesktopGate>} />
      </Routes>
      <Analytics />
    </AuthProvider>
  );
}

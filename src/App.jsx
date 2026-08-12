import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import LandingPage from './LandingPage';
import PaperviewApp from './PaperviewApp';
import DesktopGate from './DesktopGate';
import WelcomePage from './components/WelcomePage';
import LoginPage from './components/LoginPage';
import { AuthProvider } from './AuthContext';
import { WalletProvider } from './WalletContext';
import DocumentTitle from './components/DocumentTitle';

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <DocumentTitle />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/app" element={<DesktopGate><PaperviewApp /></DesktopGate>} />
          <Route path="/app/*" element={<DesktopGate><PaperviewApp /></DesktopGate>} />
        </Routes>
        <Analytics />
      </WalletProvider>
    </AuthProvider>
  );
}

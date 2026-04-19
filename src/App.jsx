import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import LandingPage from './LandingPage';
import PaperviewApp from './PaperviewApp';
import DesktopGate from './DesktopGate';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<DesktopGate><PaperviewApp /></DesktopGate>} />
        <Route path="/app/*" element={<DesktopGate><PaperviewApp /></DesktopGate>} />
      </Routes>
      <Analytics />
    </>
  );
}

import { Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import PaperviewApp from './PaperviewApp';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<PaperviewApp />} />
      <Route path="/app/*" element={<PaperviewApp />} />
    </Routes>
  );
}

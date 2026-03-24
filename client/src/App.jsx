import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Judge from './pages/Judge';
import Organizer from './pages/Organizer';
import Speaker from './pages/Speaker';
import Screen from './pages/Screen';
import Landing from './pages/Landing';
import CoreoAdmin from './pages/CoreoAdmin';
import CoreoJudge from './pages/CoreoJudge';
import CoreoScreen from './pages/CoreoScreen';
import CoreoOrganizer from './pages/CoreoOrganizer';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="/judge" element={<Judge />} />
      <Route path="/organizer/*" element={<Organizer />} />
      <Route path="/speaker/*" element={<Speaker />} />
      <Route path="/screen/:tournamentId" element={<Screen />} />
      <Route path="/coreo-admin/:id" element={<CoreoAdmin />} />
      <Route path="/coreo-organizer" element={<CoreoOrganizer />} />
      <Route path="/coreo-judge" element={<CoreoJudge />} />
      <Route path="/coreo-screen/:id" element={<CoreoScreen />} />
    </Routes>
  );
}

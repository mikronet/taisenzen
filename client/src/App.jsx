import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Landing from './pages/Landing';

const Admin = lazy(() => import('./pages/Admin'));
const Judge = lazy(() => import('./pages/Judge'));
const Organizer = lazy(() => import('./pages/Organizer'));
const Speaker = lazy(() => import('./pages/Speaker'));
const Screen = lazy(() => import('./pages/Screen'));
const CoreoAdmin = lazy(() => import('./pages/CoreoAdmin'));
const CoreoJudge = lazy(() => import('./pages/CoreoJudge'));
const CoreoScreen = lazy(() => import('./pages/CoreoScreen'));
const CoreoOrganizer = lazy(() => import('./pages/CoreoOrganizer'));
const CoreoSpeaker = lazy(() => import('./pages/CoreoSpeaker'));

export default function App() {
  return (
    <Suspense fallback={null}>
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
        <Route path="/coreo-speaker" element={<CoreoSpeaker />} />
      </Routes>
    </Suspense>
  );
}

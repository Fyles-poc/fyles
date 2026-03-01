import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { DossiersList } from './pages/DossiersList';
import { DossierDetail } from './pages/DossierDetail';
import { WorkflowsList } from './pages/WorkflowsList';
import { WorkflowDetail } from './pages/WorkflowDetail';
import { Documents } from './pages/Documents';
import { AIEngine } from './pages/AIEngine';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dossiers" element={<DossiersList />} />
          <Route path="/dossiers/:reference" element={<DossierDetail />} />
          <Route path="/workflows" element={<WorkflowsList />} />
          <Route path="/workflows/:id" element={<WorkflowDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/moteur-ia" element={<AIEngine />} />
          <Route path="/parametres" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

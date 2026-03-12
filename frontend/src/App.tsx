import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { DossiersList } from './pages/DossiersList';
import { DossierDetail } from './pages/DossierDetail';
import { WorkflowsList } from './pages/WorkflowsList';
import { WorkflowDetail } from './pages/WorkflowDetail';
import { Documents } from './pages/Documents';
import { AIEngine } from './pages/AIEngine';
import { Settings } from './pages/Settings';
import { FormPreview } from './pages/FormPreview';
import { Login } from './pages/Login';
import { isAuthenticated } from './lib/auth';

function ProtectedLayout() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Page de connexion */}
        <Route path="/login" element={<Login />} />

        {/* Page publique standalone — hors navigation */}
        <Route path="/forms/:workflowId" element={<FormPreview />} />

        {/* Routes protégées */}
        <Route element={<ProtectedLayout />}>
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

import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@state/auth-context';
import { EditorPage } from '@ui/editor/EditorPage';
import { LandingPage } from '@ui/marketing/LandingPage';
import { AuthPage } from '@ui/auth/AuthPage';
import { DashboardPage } from '@ui/dashboard/DashboardPage';
import { PricingPage } from '@ui/pricing/PricingPage';
import { AdminPage } from '@ui/admin/AdminPage';
import { SharedProjectPage } from '@ui/shared/SharedProjectPage';
import { HelpPage } from '@ui/help/HelpPage';
import { SupportPage } from '@ui/support/SupportPage';
import { Seo } from '@ui/shared/Seo';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * In embed mode (loaded inside Banglai Cloud iframe), the root path renders the
 * editor directly instead of the marketing landing page.
 */
function RootRoute() {
  const { isEmbed, user, loading } = useAuth();
  if (loading) return null;
  if (isEmbed && user) return <><Seo title="Editor" noIndex /><EditorPage /></>;
  return <><Seo path="/" /><LandingPage /></>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/auth" element={<PublicRoute><Seo title="Sign In" description="Sign in to BornoOCR — the browser-based PDF editor with Bangla & English OCR." path="/auth" /><AuthPage /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Seo title="Dashboard" noIndex /><DashboardPage /></ProtectedRoute>} />
        <Route path="/pricing" element={<><Seo title="Pricing — Free & Pro Plans" description="BornoOCR pricing: free in-browser PDF editing with OCR, or upgrade for high-accuracy server-side OCR, document analysis, and form extraction." path="/pricing" /><PricingPage /></>} />
        <Route path="/editor" element={<ProtectedRoute><Seo title="Editor" noIndex /><EditorPage /></ProtectedRoute>} />
        <Route path="/editor/:projectId" element={<ProtectedRoute><Seo title="Editor" noIndex /><EditorPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Seo title="Admin" noIndex /><AdminPage /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Seo title="Support" noIndex /><SupportPage /></ProtectedRoute>} />
        <Route path="/help" element={<><Seo title="Help & Guides" description="Learn how to edit PDFs, use Bangla OCR, extract tables, and export documents with BornoOCR." path="/help" /><HelpPage /></>} />
        <Route path="/share/:shareToken" element={<><Seo title="Shared Document" noIndex /><SharedProjectPage /></>} />
      </Routes>
    </AuthProvider>
  );
}

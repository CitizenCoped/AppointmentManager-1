import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AppointmentList from "@/pages/appointments/index";
import NewAppointment from "@/pages/appointments/new";
import ConversationCreate from "@/pages/appointments/conversation-create";
import AppointmentDetail from "@/pages/appointments/[id]";
import ImportPage from "./pages/import";
import Resources from "./pages/resources";
import Settings from "./pages/settings";
import Analytics from "./pages/analytics";
import AuthPage from "./pages/auth";
import ConfirmDepositReturn from "./pages/confirm-deposit-return";
import OnboardPage from "./pages/onboard";
import AppLayout from "@/components/layout/AppLayout";
import Clients from "./pages/clients";
import ProvidersIndex from "./pages/providers/index";
import ProviderDetail from "./pages/providers/[id]";
import NewProvider from "./pages/providers/new";
import EditProvider from "./pages/providers/edit";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Wrapper components for protected routes
const ProtectedDashboard = () => (
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
);

const ProtectedAppointmentList = () => (
  <ProtectedRoute>
    <AppointmentList />
  </ProtectedRoute>
);

const ProtectedNewAppointment = () => (
  <ProtectedRoute>
    <NewAppointment />
  </ProtectedRoute>
);

const ProtectedConversationCreate = () => (
  <ProtectedRoute>
    <ConversationCreate />
  </ProtectedRoute>
);

const ProtectedAppointmentDetail = () => (
  <ProtectedRoute>
    <AppointmentDetail />
  </ProtectedRoute>
);

const ProtectedImport = () => (
  <ProtectedRoute>
    <ImportPage />
  </ProtectedRoute>
);

const ProtectedResources = () => (
  <ProtectedRoute>
    <Resources />
  </ProtectedRoute>
);

const ProtectedSettings = () => (
  <ProtectedRoute>
    <Settings />
  </ProtectedRoute>
);

const ProtectedAnalytics = () => (
  <ProtectedRoute>
    <Analytics />
  </ProtectedRoute>
);

const ProtectedClients = () => (
  <ProtectedRoute>
    <Clients />
  </ProtectedRoute>
);

const ProtectedProviders = () => (
  <ProtectedRoute>
    <ProvidersIndex />
  </ProtectedRoute>
);

const ProtectedProviderDetail = () => (
  <ProtectedRoute>
    <ProviderDetail />
  </ProtectedRoute>
);

const ProtectedNewProvider = () => (
  <ProtectedRoute>
    <NewProvider />
  </ProtectedRoute>
);

const ProtectedEditProvider = () => (
  <ProtectedRoute>
    <EditProvider />
  </ProtectedRoute>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProtectedDashboard} />
      <Route path="/appointments" component={ProtectedAppointmentList} />
      <Route path="/appointments/new/conversation" component={ProtectedConversationCreate} />
      <Route path="/appointments/new" component={ProtectedNewAppointment} />
      <Route path="/appointments/:id" component={ProtectedAppointmentDetail} />
      <Route path="/clients" component={ProtectedClients} />
      <Route path="/providers" component={ProtectedProviders} />
      <Route path="/providers/new" component={ProtectedNewProvider} />
      <Route path="/providers/:id/edit" component={ProtectedEditProvider} />
      <Route path="/providers/:id" component={ProtectedProviderDetail} />
      <Route path="/analytics" component={ProtectedAnalytics} />
      <Route path="/import" component={ProtectedImport} />
      <Route path="/resources" component={ProtectedResources} />
      <Route path="/settings" component={ProtectedSettings} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/onboard" component={OnboardPage} />
      <Route path="/confirm-deposit-return/:id" component={ConfirmDepositReturn} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <AppLayout>
            <Router />
          </AppLayout>
          <VercelAnalytics />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
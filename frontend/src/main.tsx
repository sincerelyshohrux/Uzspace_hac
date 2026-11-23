import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./styles/globals.css";
import { App } from "./app/App";
import { resolveMode } from "./app/mode";
import { AppStateProvider } from "./app/state";
import { ThemeProvider, useTheme } from "./app/theme";
import { TooltipProvider } from "./components/ui/tooltip";
import { I18nProvider } from "./i18n";

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

function Toasts() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: "Inter" } }} />;
}

resolveMode().then(({ mode, apiOnline }) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <QueryClientProvider client={qc}>
            <TooltipProvider>
              <AppStateProvider>
                <App mode={mode} apiOnline={apiOnline} />
                <Toasts />
              </AppStateProvider>
            </TooltipProvider>
          </QueryClientProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
});

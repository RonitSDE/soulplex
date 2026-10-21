import type React from "react";
import { useStore, StoreProvider } from "./store";
import { WorldCanvas } from "./world/WorldCanvas";
import { Landing } from "./pages/Landing";
import { Guest } from "./pages/Guest";
import { Shell } from "./pages/Shell";
import { Home } from "./pages/Home";
import { Agent } from "./pages/Agent";
import { Discover } from "./pages/Discover";
import { Dates } from "./pages/Dates";
import { Insights } from "./pages/Insights";
import { Settings, Operator } from "./pages/Settings";
import { Brand } from "./ui";

function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast glass " + t.tone}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Router() {
  const { user, loading, page, guest } = useStore();
  if (loading)
    return (
      <div className="boot">
        <Brand />
        <p>Waking up the island…</p>
      </div>
    );
  if (!user) return guest ? <Guest /> : <Landing />;
  const pages: Record<string, React.FC> = {
    home: Home,
    agent: Agent,
    discover: Discover,
    dates: Dates,
    insights: Insights,
    settings: Settings,
    operator: Operator,
  };
  const Page = pages[page] ?? Home;
  return (
    <Shell>
      <Page key={page} />
    </Shell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <WorldCanvas />
      <Router />
      <Toasts />
    </StoreProvider>
  );
}

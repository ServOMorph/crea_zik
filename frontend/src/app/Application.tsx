import { ReactNode, useCallback, useEffect, useState } from "react";

import { EditorLanding } from "../editor/EditorLanding";
import { Sidebar } from "./Sidebar";

type RouteName = "studio" | "editor";

type BrowserLocation = {
  pathname: string;
  search: string;
};

function readLocation(): BrowserLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

function routeFromPath(pathname: string): RouteName {
  return pathname.replace(/\/+$/, "") === "/editor" ? "editor" : "studio";
}

export function Application({ studioPage }: { studioPage: ReactNode }) {
  const [location, setLocation] = useState(readLocation);
  const [collapsed, setCollapsed] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastEditorPath, setLastEditorPath] = useState(() =>
    routeFromPath(window.location.pathname) === "editor"
      ? `${window.location.pathname}${window.location.search}`
      : "/editor",
  );
  const route = routeFromPath(location.pathname);

  useEffect(() => {
    const receiveLocation = () => setLocation(readLocation());
    window.addEventListener("popstate", receiveLocation);
    return () => window.removeEventListener("popstate", receiveLocation);
  }, []);

  useEffect(() => {
    if (route === "editor") {
      setLastEditorPath(`${location.pathname}${location.search}`);
    }
  }, [location, route]);

  const navigate = useCallback(
    (path: string) => {
      const nextPath = path === "/editor" ? lastEditorPath : path;
      if (nextPath === `${location.pathname}${location.search}`) return;
      if (
        hasUnsavedChanges &&
        !window.confirm("Des modifications locales non enregistrées seront perdues. Continuer ?")
      )
        return;
      window.history.pushState({}, "", nextPath);
      if (routeFromPath(nextPath) === "editor") setLastEditorPath(nextPath);
      setLocation(readLocation());
      setHasUnsavedChanges(false);
    },
    [hasUnsavedChanges, lastEditorPath, location],
  );

  return (
    <div className="application-shell">
      <Sidebar
        collapsed={collapsed}
        onNavigate={(target) => navigate(target === "editor" ? "/editor" : "/")}
        onToggle={() => setCollapsed((current) => !current)}
        route={route}
      />
      <div className="application-shell__content">
        <div hidden={route !== "studio"}>{studioPage}</div>
        {route === "editor" && (
          <EditorLanding onDirtyChange={setHasUnsavedChanges} onNavigate={navigate} search={location.search} />
        )}
      </div>
    </div>
  );
}

type RouteName = "studio" | "editor" | "plugins";

type SidebarProps = {
  route: RouteName;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (route: RouteName) => void;
};

export function Sidebar({ route, collapsed, onToggle, onNavigate }: SidebarProps) {
  return (
    <aside className={collapsed ? "sidebar sidebar--collapsed" : "sidebar"}>
      <div className="sidebar__brand">
        <span aria-hidden="true">CZ</span>
        {!collapsed && <strong>Crea Zik</strong>}
        <button
          aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
          className="sidebar__toggle"
          onClick={onToggle}
          type="button"
        >
          Menu
        </button>
      </div>
      <nav aria-label="Navigation principale">
        <a
          aria-current={route === "studio" ? "page" : undefined}
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("studio");
          }}
        >
          <span aria-hidden="true">S</span>
          <span className="sidebar__label">Studio</span>
        </a>
        <a
          aria-current={route === "editor" ? "page" : undefined}
          href="/editor"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("editor");
          }}
        >
          <span aria-hidden="true">E</span>
          <span className="sidebar__label">Éditeur musical</span>
        </a>
        <a
          aria-current={route === "plugins" ? "page" : undefined}
          href="/plugins"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("plugins");
          }}
        >
          <span aria-hidden="true">P</span>
          <span className="sidebar__label">Plugins</span>
        </a>
      </nav>
    </aside>
  );
}

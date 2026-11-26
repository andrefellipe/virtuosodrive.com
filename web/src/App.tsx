import logo from "./assets/af.png";
import { SiteStatus } from "./status/SiteStatus.tsx";

/** The thin slice's one page: the site's name and logo, and the status of its server. */
export function App() {
  return (
    <div className="page">
      <header className="page-header">
        <img src={logo} alt="" width="88" height="56" />
        <h1>Virtuoso Drive</h1>
      </header>
      <main>
        <SiteStatus />
      </main>
    </div>
  );
}

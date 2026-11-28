import logo from "./assets/af.png";
import { FolderScreen } from "./folder/FolderScreen.tsx";

/**
 * The page: the site's name and logo, and the folder the address names.
 * The thin slice's status view (status/SiteStatus.tsx) is no longer shown;
 * it stays in the code, with its tests, as the example of a part of the page.
 */
export function App() {
  return (
    <div className="page">
      <header className="page-header">
        <img src={logo} alt="" width="88" height="56" />
        <h1>Virtuoso Drive</h1>
      </header>
      <main>
        <FolderScreen />
      </main>
    </div>
  );
}

// The design's look, and nothing else from outside the vault (spec B1b-2a §1.2 item 1): stylesheets
// carry no code. Tokens and type first, then the design's screen classes, then this page's layout.
import '../../../web/src/styles/design-system.css';
import '../styles/design-ext.css';
import './unlock.css';
import {pageMode} from './mode';
import {startMode} from './modes';
import {browserPageDeps} from './browser';

// unlock.html?mode=…: one screen run per page (src/unlock/modes.ts), with the page's one busy gate
// (PageDeps.gate). The vault page renders only its own fixed strings (src/unlock/strings.ts and the static
// markup), the user's own words and, on #10, the re-validated challenge fields; it never touches the network
// and never writes storage.
startMode(pageMode(location.search), browserPageDeps());

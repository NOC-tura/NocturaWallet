import {startRelay, type PortLike} from './relay';

/** The isolated-world content script (spec §1.2): top frame only, at document_start (the manifest). */
interface RuntimeLike {
  runtime: {connect(o: {name: string}): PortLike};
}
const g = globalThis as unknown as {browser?: RuntimeLike; chrome?: RuntimeLike};
const api = (g.browser ?? g.chrome) as RuntimeLike;

startRelay({
  win: window,
  doc: document,
  connect: name => api.runtime.connect({name}),
  setTimeout: (f, ms) => window.setTimeout(f, ms),
  setInterval: (f, ms) => window.setInterval(f, ms),
  clearInterval: id => window.clearInterval(id as number),
});

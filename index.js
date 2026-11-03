/**
 * Host half of the codex history rail bundle.
 *
 * Empty on purpose: the rail reads the current Session's `turnOutline`
 * projection and retained chat window on the client, and keeps its favorites in
 * the browser's local storage. There is nothing to schedule or fetch host-side.
 */
export function apply() {}

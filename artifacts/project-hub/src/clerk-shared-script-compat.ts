// @clerk/react@5.54 requests UI-script helpers that its @clerk/shared@3
// dependency does not export. The app already has the compatible shared v4
// package for publishableKeyFromHost, so map only the renamed script helpers.
export {
  buildClerkJsScriptAttributes,
  clerkJsScriptUrl,
  loadClerkJsScript,
  setClerkJsLoadingErrorPackageName,
  buildClerkUIScriptAttributes as buildClerkUiScriptAttributes,
  clerkUIScriptUrl as clerkUiScriptUrl,
  loadClerkUIScript as loadClerkUiScript,
} from '../node_modules/@clerk/shared/dist/loadClerkJsScript.mjs';
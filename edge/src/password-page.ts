/**
 * The password page the access gate answers with (security design S1): one
 * small page with one field, and the two small files it refers to, its
 * script and its style. The gate answers all three itself; the page loads
 * nothing from elsewhere. On submit, the script stores what was typed in the
 * cookie "vd_access" and opens the same address again; a wrong password
 * therefore simply shows the page again.
 *
 * The page has no script or style written inside it. The edge's own header
 * rule replaces the gate's content security policy with the ordinary page's,
 * which allows scripts and styles only as files from the site itself; the
 * page must work under that policy and under the gate's own.
 *
 * What was typed must never leave the field except through the script:
 *   - the form's method is "post", so a plain submission (the script blocked,
 *     or JavaScript off) cannot write anything into the address;
 *   - the field has no "name", so a plain submission sends nothing of it.
 *
 * The whole edge function, this page and its two files included, must fit
 * the service's limit on a function's size, so they are kept to a couple of
 * kilobytes. Written in the plain subset of the language the edge runtime
 * accepts.
 */

export const ACCESS_COOKIE = "vd_access";

/** Thirty days, in seconds (rules BR2.3). */
export const REMEMBER_FOR_SECONDS = 2592000;

/**
 * Where the gate answers the page's two files. Neither can be a file of the
 * page's build (those are /index.html and under /r/<version>/) nor a path of
 * the server's (under /v1).
 */
export const PAGE_SCRIPT_PATH = "/access-password.js";
export const PAGE_STYLE_PATH = "/access-password.css";

export const PAGE_STYLE =
  "body{font-family:Helvetica,Arial,sans-serif;margin:0;color:#212529;background:#fff}" +
  "header{text-align:center;padding:1.5rem 1rem 1rem}" +
  "h1{font-size:1.5rem;margin:0}" +
  "main{max-width:22rem;margin:0 auto;padding:1.25rem 1rem;border-top:1px dashed #ccc}" +
  "label{display:block;margin-bottom:.5rem}" +
  "input{font:inherit;width:100%;box-sizing:border-box;padding:.4rem;border:1px solid #6c757d;border-radius:.25rem}" +
  "button{font:inherit;margin-top:.75rem;color:#fff;background:#0454a0;border:1px solid #0454a0;border-radius:.25rem;padding:.4rem .9rem;cursor:pointer}" +
  "input:focus-visible,button:focus-visible{outline:3px solid #f5a623;outline-offset:2px}" +
  "p{color:#555;font-size:.875rem}";

// Opening the address's own path again, in place of the current entry of the
// browser's history, drops any query the address carried.
export const PAGE_SCRIPT =
  'document.getElementById("access-form").addEventListener("submit",function(event){' +
  "event.preventDefault();" +
  'var typed=document.getElementById("access-password").value.trim();' +
  "if(/^[A-Za-z0-9]{1,128}$/.test(typed)){" +
  'document.cookie="' +
  ACCESS_COOKIE +
  '="+typed+"; Max-Age=' +
  REMEMBER_FOR_SECONDS +
  '; Path=/; Secure; SameSite=Strict";' +
  "}" +
  "location.replace(location.pathname);" +
  "});";

export function passwordPageHtml(): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    "<title>Virtuoso Drive: access password</title>" +
    '<link rel="stylesheet" href="' +
    PAGE_STYLE_PATH +
    '">' +
    '<script src="' +
    PAGE_SCRIPT_PATH +
    '" defer></script>' +
    "</head><body>" +
    "<header><h1>Virtuoso Drive</h1></header>" +
    '<main><form id="access-form" method="post">' +
    '<label for="access-password">Access password</label>' +
    '<input id="access-password" type="password" autocomplete="current-password" required autofocus data-testid="access-password-input">' +
    '<button type="submit" data-testid="access-password-submit">Continue</button>' +
    "</form>" +
    "<p>This site is private for now. The password is remembered on this device for 30 days.</p>" +
    "<noscript><p>This page needs JavaScript.</p></noscript>" +
    "</main></body></html>"
  );
}

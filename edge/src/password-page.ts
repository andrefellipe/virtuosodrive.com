/**
 * The password page the access gate answers with (security design S1): one
 * small self-contained page with one field and one script. It loads nothing
 * from elsewhere. On submit, the script stores what was typed in the cookie
 * "vd_access" and reloads; a wrong password therefore simply shows the page
 * again.
 *
 * The whole edge function, this page included, must fit the service's limit
 * on a function's size, so the page is kept to a couple of kilobytes.
 *
 * This file is also read by the build, which fingerprints the style and the
 * script for the page's content security policy. It is written in the plain
 * subset of the language that the edge runtime accepts.
 */

export const ACCESS_COOKIE = "vd_access";

/** Thirty days, in seconds (rules BR2.3). */
export const REMEMBER_FOR_SECONDS = 2592000;

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
  "location.reload();" +
  "});";

export function passwordPageHtml(): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    "<title>Virtuoso Drive: access password</title>" +
    "<style>" +
    PAGE_STYLE +
    "</style></head><body>" +
    "<header><h1>Virtuoso Drive</h1></header>" +
    '<main><form id="access-form">' +
    '<label for="access-password">Access password</label>' +
    '<input id="access-password" name="access-password" type="password" autocomplete="current-password" required autofocus data-testid="access-password-input">' +
    '<button type="submit" data-testid="access-password-submit">Continue</button>' +
    "</form>" +
    "<p>This site is private for now. The password is remembered on this device for 30 days.</p>" +
    "</main>" +
    "<script>" +
    PAGE_SCRIPT +
    "</script></body></html>"
  );
}

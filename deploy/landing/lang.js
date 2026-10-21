// umbracaelis.com giriş sayfası: TR / EN. Seçim uygulamayla ortak "lang" çerezinde tutulur
// (çerez yoksa tarayıcı dili: Türkçe değilse İngilizce). Türkçe metin HTML'in kendisidir,
// İngilizcesi data-en özniteliğindedir. CSP satır içi betiğe izin vermediği için ayrı dosyadır.
(function () {
  "use strict";
  function current() {
    var m = /(?:^|;\s*)lang=(tr|en)\b/.exec(document.cookie || "");
    if (m) return m[1];
    var n = ((navigator.languages && navigator.languages[0]) || navigator.language || "").toLowerCase();
    return !n || n.indexOf("tr") === 0 ? "tr" : "en";
  }
  function apply(lang) {
    document.documentElement.lang = lang;
    var els = document.querySelectorAll("[data-en]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute("data-tr") === null) el.setAttribute("data-tr", el.textContent);
      el.textContent = lang === "en" ? el.getAttribute("data-en") : el.getAttribute("data-tr");
    }
    var aria = document.querySelectorAll("[data-en-aria-label]");
    for (var j = 0; j < aria.length; j++) {
      var a = aria[j];
      if (a.getAttribute("data-tr-aria-label") === null) a.setAttribute("data-tr-aria-label", a.getAttribute("aria-label") || "");
      a.setAttribute("aria-label", lang === "en" ? a.getAttribute("data-en-aria-label") : a.getAttribute("data-tr-aria-label"));
    }
    var btns = document.querySelectorAll(".lang [data-lang]");
    for (var k = 0; k < btns.length; k++) btns[k].setAttribute("aria-pressed", String(btns[k].getAttribute("data-lang") === lang));
  }
  function init() {
    apply(current());
    var box = document.querySelector(".lang");
    if (!box) return;
    box.hidden = false;
    box.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-lang]") : null;
      if (!b) return;
      var lang = b.getAttribute("data-lang");
      document.cookie = "lang=" + lang + "; path=/; max-age=31536000; samesite=lax";
      apply(lang);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

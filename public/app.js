(function () {
  "use strict";

  var sourceRoot = "https://re0zero.top/mdbook/book/";

  function showChapterNotice(sourceUrl) {
    var notice = document.getElementById("chapter-notice");

    if (!notice) {
      notice = document.createElement("aside");
      notice.id = "chapter-notice";
      notice.className = "chapter-notice";
      notice.setAttribute("role", "status");

      var message = document.createElement("p");
      message.className = "chapter-notice__message";
      message.textContent = "本次交付复刻了网站外观与首页交互，未内置原站章节正文。";

      var externalLink = document.createElement("a");
      externalLink.className = "chapter-notice__link";
      externalLink.textContent = "前往原站章节";
      externalLink.target = "_blank";
      externalLink.rel = "noopener noreferrer";

      var closeButton = document.createElement("button");
      closeButton.className = "chapter-notice__close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "关闭提示");
      closeButton.textContent = "×";

      notice.append(message, externalLink, closeButton);
      document.body.appendChild(notice);

      closeButton.addEventListener("click", function () {
        notice.classList.remove("chapter-notice--visible");
      });
    }

    notice.querySelector(".chapter-notice__link").href = sourceUrl;
    notice.classList.add("chapter-notice--visible");
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link) {
      return;
    }

    var href = link.getAttribute("href");
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("http:") ||
      href.startsWith("https:") ||
      href.startsWith("mailto:") ||
      href === "index.html" ||
      link.target === "_blank"
    ) {
      return;
    }

    if (
      href.endsWith(".html") ||
      href.startsWith("markdown/") ||
      href.startsWith("external-links/")
    ) {
      event.preventDefault();
      showChapterNotice(new URL(href, sourceRoot).href);
    }
  });
})();

const hotcss = (() => {
  const versions = {};
  let timer = null;

  function getCssLinks() {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => {
        const href = link.getAttribute("href");
        if (!href) return null;

        // Must be /static/css/*.css
        if (!href.startsWith("/static/") || !href.endsWith(".css")) {
          return null;
        }

        return {
          link,
          path: href.replace("/static/", "").split("?")[0]
        };
      })
      .filter(Boolean);
  }

  async function fetchVersion(path) {
    const res = await fetch(
      `/api/css-version?path=${encodeURIComponent(path)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()).version;
  }

  async function checkUpdates() {
    const cssFiles = getCssLinks();

    for (const { link, path } of cssFiles) {
      const version = await fetchVersion(path);
      if (!version) continue;

      if (versions[path] && versions[path] !== version) {
        reload(link, version);
        console.log("♻ CSS reloaded:", path);
      }

      versions[path] = version;
    }
  }

  function reload(link, version) {
    const url = new URL(link.href, location.origin);
    url.searchParams.set("v", version);
    link.href = url.toString();
  }

  function start({ interval = 2000 } = {}) {
    if (timer) return;
    checkUpdates();
    timer = setInterval(checkUpdates, interval);
    console.log("🔥 HotCSS watching ALL CSS files");
  }

  return { start };
})();
hotcss.start({ interval: 3000 });
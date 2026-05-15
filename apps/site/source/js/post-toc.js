document.addEventListener("DOMContentLoaded", () => {
  const toc = document.querySelector("#post-toc-sidebar");
  const tocNav = toc?.querySelector(".post-toc-nav");

  if (!toc) {
    return;
  }

  const items = Array.from(
    toc.querySelectorAll('.post-toc-link[href^="#"]')
  ).map((link) => {
    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    const heading = document.getElementById(id);

    if (!heading) {
      return null;
    }

    return {
      heading,
      id,
      link,
    };
  }).filter(Boolean);

  if (!items.length) {
    return;
  }

  let activeId = "";
  let ticking = false;

  const keepActiveLinkInView = (link) => {
    if (!tocNav || !link) {
      return;
    }

    const navRect = tocNav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const padding = 12;

    if (linkRect.top < navRect.top + padding) {
      const delta = linkRect.top - navRect.top - padding;
      tocNav.scrollTop = Math.max(0, tocNav.scrollTop + delta);
      return;
    }

    if (linkRect.bottom > navRect.bottom - padding) {
      const delta = linkRect.bottom - navRect.bottom + padding;
      tocNav.scrollTop += delta;
    }
  };

  const updateActive = (id) => {
    if (!id || id === activeId) {
      return;
    }

    activeId = id;

    items.forEach(({ id: itemId, link }) => {
      link.classList.toggle("is-active", itemId === id);
    });

    const activeLink = items.find((item) => item.id === id)?.link;

    if (activeLink) {
      keepActiveLinkInView(activeLink);
    }
  };

  const syncActiveHeading = () => {
    ticking = false;

    const current = items.reduce((matched, item) => {
      if (item.heading.getBoundingClientRect().top <= 160) {
        return item;
      }

      return matched;
    }, items[0]);

    updateActive(current.id);
  };

  const requestSync = () => {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(syncActiveHeading);
  };

  window.addEventListener("scroll", requestSync, { passive: true });
  window.addEventListener("resize", requestSync);

  toc.addEventListener("click", (event) => {
    const link = event.target.closest('.post-toc-link[href^="#"]');

    if (!link) {
      return;
    }

    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    updateActive(id);
  });

  if (window.location.hash) {
    updateActive(decodeURIComponent(window.location.hash.slice(1)));
  }

  requestSync();
});

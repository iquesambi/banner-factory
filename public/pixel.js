/**
 * The banner tag.
 *
 * Drop two lines on any page and it fills a box with the right banner for a
 * product, records that the banner was seen, and records the click:
 *
 *   <div data-banner data-sku="907583" data-lang="da"></div>
 *   <script src="http://localhost:3000/pixel.js"></script>
 *
 * It is deliberately a single file of plain browser JavaScript with no
 * dependencies and no build step, because the whole point of a tag is that
 * somebody else can paste it into a site you do not control.
 *
 * WHAT IT SENDS: the id of the banner it was given, and the word
 * "impression" or "click". No cookie is set, no identifier is invented, no
 * page content is read, nothing about the visitor is collected. That is not
 * modesty — it is what keeps this out of consent-banner territory, and it is
 * all the measurement actually needs.
 *
 * WHICH BANNER: the server decides. When an A/B test is running on a product
 * the two sides are split there, so a site that installs this takes part in
 * the test without knowing it exists and without being able to bias it.
 */
(function () {
  'use strict';

  /**
   * Where this script came from IS where the API lives. Taking it from the
   * script's own src means the tag works unchanged on localhost, on a
   * staging host and on a real site, with nothing to configure.
   */
  var script = document.currentScript;
  var origin = '';
  try {
    origin = new URL(script.src, window.location.href).origin;
  } catch (e) {
    return;
  }

  var SELECTOR = '[data-banner]';

  function post(path, body) {
    var url = origin + path;
    var payload = JSON.stringify(body);
    /**
     * sendBeacon survives the page being navigated away from, which is
     * exactly what a click does. Without it the click request is cancelled
     * by the browser about half the time and the clicks quietly undercount.
     */
    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        return;
      } catch (e) {
        /* fall through to fetch */
      }
    }
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    } catch (e) {
      /* a measurement that fails must never break the page it is on */
    }
  }

  function render(box) {
    var sku = box.getAttribute('data-sku');
    if (!sku) return;
    var lang = box.getAttribute('data-lang') || 'da';

    var url = origin + '/api/serve?sku=' + encodeURIComponent(sku) + '&lang=' + encodeURIComponent(lang);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('no banner');
        return r.json();
      })
      .then(function (data) {
        /**
         * The impression is recorded by the serving endpoint as part of
         * answering, so it cannot be forgotten by whoever installs this.
         *
         * It counts the banner as seen when it is fetched rather than when
         * it scrolls into view. For a hero at the top of a page those are
         * the same moment; a tag used further down a long page would want
         * an IntersectionObserver here, and that is the one honest caveat
         * on these numbers.
         */
        var link = document.createElement('a');
        link.href = box.getAttribute('data-href') || ('produto.html?sku=' + encodeURIComponent(data.sku || sku));
        link.style.display = 'block';
        link.setAttribute('data-arm', data.arm);

        var img = document.createElement('img');
        img.src = origin + data.image;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.borderRadius = '10px';
        link.appendChild(img);

        link.addEventListener('click', function () {
          /**
           * The job id, not the product: during a test two banners share a
           * product and only the id says which of them was clicked.
           */
          post('/api/track', { jobId: data.jobId, event: 'click' });
        });

        box.innerHTML = '';
        box.appendChild(link);
      })
      .catch(function () {
        /** No banner for that product: leave the box empty rather than broken. */
        box.setAttribute('data-banner-empty', '1');
      });
  }

  function start() {
    var boxes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < boxes.length; i++) render(boxes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

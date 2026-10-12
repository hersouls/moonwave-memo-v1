/* Moonwave UX — the theme engine (kit 1.2). One file, the same in every service, loaded in <head> after the stylesheet:
     <script src="/theme-init.js" data-key="trip-theme"></script>
   It sets <html data-theme="light|dark"> before the first frame, so no screen flashes in the wrong theme, and keeps it
   right while the page stays open.

   Three choices, kept per device under the name in data-key:
     nothing saved   자동     light while the sun is up at home, dark from sunset to sunrise
     "light"         밝게
     "dark"          어둡게
   Home is 인천 서해구. Sunrise and sunset are worked out here from the date and that place: nothing is fetched, and the
   page changes offline too. (The Mac reads the same two times from a weather service every day, and the audit holds
   every service to them: monitor/weather.mjs.)

   window.mwTheme   mode() · set(mode) · cycle() · dark() · sun(date) · next() · on(fn) · home · key
   An external file on purpose: the CSP is script-src 'self', so a script written into the HTML would not run.
   Do not edit a copy of this file: it is the kit's (ux.moonwave.kr/kit/theme-init.js). */
(function () {
  var HOME = { name: '인천 서해구', lat: 37.5454, lon: 126.676 }
  var me = document.currentScript
  var KEY = (me && me.getAttribute('data-key')) || 'mw-theme'
  // the colour of the browser's bar and of an installed app's status bar, one for each theme (a service whose top bar
  // is another colour says so: data-light, data-dark)
  var BAR = { light: (me && me.getAttribute('data-light')) || '#ffffff', dark: (me && me.getAttribute('data-dark')) || '#232425' }
  var RAD = Math.PI / 180, DAY = 86400000, J1970 = 2440587.5, J2000 = 2451545

  /* Where the sun stands at a Julian date: the equation of time in minutes and the declination in radians
     (the series of the solar calculators, good to a few seconds for this century). */
  function solar(jd) {
    var T = (jd - J2000) / 36525
    var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 * RAD
    var M = (357.52911 + T * (35999.05029 - T * 0.0001537)) * RAD
    var e = 0.016708634 - T * (0.000042037 + T * 0.0000001267)
    var C = Math.sin(M) * (1.914602 - T * (0.004817 + T * 0.000014)) + Math.sin(2 * M) * (0.019993 - T * 0.000101) + Math.sin(3 * M) * 0.000289
    var node = (125.04 - 1934.136 * T) * RAD
    var lon = L0 + (C - 0.00569 - 0.00478 * Math.sin(node)) * RAD
    var tilt = (23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(node)) * RAD
    var y = Math.tan(tilt / 2); y *= y
    var eot = 4 / RAD * (y * Math.sin(2 * L0) - 2 * e * Math.sin(M) + 4 * e * y * Math.sin(M) * Math.cos(2 * L0) - 0.5 * y * y * Math.sin(4 * L0) - 1.25 * e * e * Math.sin(2 * M))
    return { eot: eot, dec: Math.asin(Math.sin(tilt) * Math.sin(lon)) }
  }
  /* Sunrise and sunset of the day whose noon at home is nearest to `t`, in milliseconds: the moment the sun's upper
     edge meets the horizon, with the air's bending of the light (0.833 degrees). Within a minute of an almanac. */
  function sun(t) {
    var lat = HOME.lat * RAD
    var mean = J2000 + Math.round(t / DAY + J1970 - J2000 + HOME.lon / 360) - HOME.lon / 360 // mean noon at home, as a Julian date
    function edge(side) {
      var jd = mean
      for (var i = 0; i < 2; i++) { // from noon first, then once more from the time that gave
        var s = solar(jd)
        var cos = Math.cos(90.833 * RAD) / (Math.cos(lat) * Math.cos(s.dec)) - Math.tan(lat) * Math.tan(s.dec)
        jd = mean - s.eot / 1440 + side * Math.acos(Math.max(-1, Math.min(1, cos))) / RAD / 360
      }
      return Math.round((jd - J1970) * DAY)
    }
    return { rise: edge(-1), set: edge(1) }
  }
  /* When 자동 changes next: this evening's sunset, or the coming sunrise. */
  function next(t) { var s = sun(t); return t < s.rise ? s.rise : t < s.set ? s.set : sun(t + DAY).rise }

  var held = null // the choice, when this browser lets nothing be saved
  function mode() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : held || 'auto' } catch (e) { return held || 'auto' }
  }
  function darkAt(m, t) { if (m !== 'auto') return m === 'dark'; var s = sun(t); return t < s.rise || t >= s.set }

  var listeners = [], timer = 0, last = ''
  function apply() {
    var m = mode(), now = Date.now(), dark = darkAt(m, now), name = dark ? 'dark' : 'light', root = document.documentElement
    if (root.getAttribute('data-theme') !== name) root.setAttribute('data-theme', name)
    var bars = document.querySelectorAll('meta[name="theme-color"]')
    for (var i = 0; i < bars.length; i++) bars[i].setAttribute('content', BAR[name])
    clearTimeout(timer)
    // 자동: look again when the sun next crosses the horizon (and at least once a day)
    if (m === 'auto') timer = setTimeout(apply, Math.min(Math.max(next(now) - now, 0) + 500, DAY))
    if (m + ':' + name !== last) {
      last = m + ':' + name
      for (var j = 0; j < listeners.length; j++) { try { listeners[j]({ mode: m, dark: dark }) } catch (e) { /* a listener's own trouble */ } }
    }
  }
  function set(m) {
    held = m === 'light' || m === 'dark' ? m : null
    try { if (held) localStorage.setItem(KEY, held); else localStorage.removeItem(KEY) } catch (e) { /* kept for this visit only */ }
    apply()
    return mode()
  }

  window.mwTheme = {
    home: HOME, key: KEY, mode: mode, set: set,
    /** 자동 → 밝게 → 어둡게 → 자동. Returns the new choice. */
    cycle: function () { var m = mode(); return set(m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto') },
    dark: function () { return darkAt(mode(), Date.now()) },
    /** Today's sunrise and sunset at home, as Dates (or those of the day around `date`). */
    sun: function (date) { var s = sun(+(date || new Date())); return { rise: new Date(s.rise), set: new Date(s.set) } },
    /** When 자동 changes next (null while 밝게 or 어둡게 is chosen). */
    next: function () { return mode() === 'auto' ? new Date(next(Date.now())) : null },
    /** Tells fn({ mode, dark }) whenever the choice or the theme changes. Returns the way to stop. */
    on: function (fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) } },
  }
  // a timer sleeps with its tab: look again when the page is shown, and when another tab changed the choice
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply() })
  window.addEventListener('pageshow', apply)
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) apply() })
  apply()
})()

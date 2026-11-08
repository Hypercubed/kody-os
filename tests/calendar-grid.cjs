'use strict';
// jsdom grid proofs for catalog/calendar/definition.json (spec task 2.1).
// Runs outside pkg/; jsdom lives in /tmp/jsdom-test (or JSDOM_PATH).
// The bundle script uses the window's Date, so each case installs a
// FakeDate in beforeParse: no-arg construction returns the mocked
// device date, constructed dates behave like the real Date.
var fs = require('fs');
var path = require('path');

var jsdomPath = process.env.JSDOM_PATH || '/tmp/jsdom-test/node_modules/jsdom';
var JSDOM = require(jsdomPath).JSDOM;

var bundle = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'pkg', 'catalog', 'calendar/definition.json'), 'utf8'));
var html = bundle.bundle.files['index.html'];

var failures = [];
function check(name, ok, detail) {
  if (ok) { console.log('PASS: ' + name); }
  else { failures.push(name); console.log('FAIL: ' + name + (detail ? ' — ' + detail : '')); }
}

function makeDom(fixedYear, fixedMonth, fixedDay) {
  var fetchCalls = [];
  return {
    fetchCalls: fetchCalls,
    dom: new JSDOM(html, {
      url: 'https://example.test/apps/calendar',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      beforeParse: function (window) {
        var RealDate = window.Date;
        function FakeDate() {
          if (arguments.length === 0) {
            return new RealDate(fixedYear, fixedMonth, fixedDay);
          }
          var args = Array.prototype.slice.call(arguments);
          return new (Function.prototype.bind.apply(RealDate, [null].concat(args)))();
        }
        FakeDate.prototype = Object.create(RealDate.prototype);
        FakeDate.UTC = RealDate.UTC;
        FakeDate.parse = RealDate.parse;
        FakeDate.now = function () {
          return new RealDate(fixedYear, fixedMonth, fixedDay).getTime();
        };
        window.Date = FakeDate;
        window.fetch = function () { fetchCalls.push(1); return Promise.resolve({}); };
      },
    }),
  };
}

function gridInfo(document) {
  var title = document.querySelector('.cal-title').textContent;
  var cells = Array.prototype.slice.call(document.querySelectorAll('.cal-grid .cal-cell'));
  var blanks = cells.filter(function (c) { return c.classList.contains('cal-blank'); }).length;
  var days = cells.filter(function (c) { return !c.classList.contains('cal-blank'); });
  var today = cells.filter(function (c) { return c.classList.contains('cal-today'); });
  return { title: title, blanks: blanks, dayCount: days.length, today: today.map(function (c) { return c.textContent; }) };
}

function click(document, selector) {
  var btn = document.querySelector(selector);
  btn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
}

// February 2026: 28 days, starts Sunday (padding 0), today 15 highlighted.
var feb = makeDom(2026, 1, 15);
var info = gridInfo(feb.dom.window.document);
check('Feb 2026 title', info.title === 'Feb 2026', info.title);
check('Feb 2026 28 days, Sunday start', info.dayCount === 28 && info.blanks === 0,
  'days=' + info.dayCount + ' blanks=' + info.blanks);
check('Feb 2026 today highlighted', info.today.length === 1 && info.today[0] === '15',
  JSON.stringify(info.today));

// October 2026: 31 days, starts Thursday (padding 4), today 15 highlighted.
var oct = makeDom(2026, 9, 15);
info = gridInfo(oct.dom.window.document);
check('Oct 2026 title', info.title === 'Oct 2026', info.title);
check('Oct 2026 31 days, Thursday start', info.dayCount === 31 && info.blanks === 4,
  'days=' + info.dayCount + ' blanks=' + info.blanks);
check('Oct 2026 today highlighted', info.today.length === 1 && info.today[0] === '15',
  JSON.stringify(info.today));

// February 2024 (leap year): 29 days, starts Thursday (padding 4).
var leap = makeDom(2024, 1, 15);
info = gridInfo(leap.dom.window.document);
check('Feb 2024 leap 29 days', info.dayCount === 29 && info.blanks === 4,
  'days=' + info.dayCount + ' blanks=' + info.blanks);

// Rollover: Dec 2026 -> next -> Jan 2027 (31 days, Friday start, padding 5)
// -> prev -> Dec 2026 again; prev from Dec lands on Nov 2026.
var dec = makeDom(2026, 11, 15);
var doc = dec.dom.window.document;
var hrefBefore = dec.dom.window.location.href;
click(doc, '.cal-next');
info = gridInfo(doc);
check('Dec 2026 next lands Jan 2027', info.title === 'Jan 2027', info.title);
check('Jan 2027 31 days, Friday start', info.dayCount === 31 && info.blanks === 5,
  'days=' + info.dayCount + ' blanks=' + info.blanks);
click(doc, '.cal-prev');
info = gridInfo(doc);
check('Jan 2027 prev lands back Dec 2026', info.title === 'Dec 2026', info.title);
click(doc, '.cal-prev');
info = gridInfo(doc);
check('Dec 2026 prev lands Nov 2026', info.title === 'Nov 2026', info.title);
check('Prev/next cause no navigation', dec.dom.window.location.href === hrefBefore,
  dec.dom.window.location.href);
check('Prev/next cause no fetch calls', dec.fetchCalls.length === 0,
  'calls=' + dec.fetchCalls.length);

if (failures.length > 0) {
  console.log('\n' + failures.length + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nALL CALENDAR GRID CHECKS PASSED');

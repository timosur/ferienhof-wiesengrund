/**
 * Availability Calendar Component
 * Reads data from /data/availability.json and renders a month-view calendar
 * with prev/next navigation showing 2 months at a time.
 */
(function () {
  'use strict';

  const MONTH_NAMES = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  let availabilityData = null;

  async function loadAvailability() {
    try {
      const resp = await fetch('/data/availability.json');
      if (resp.ok) {
        availabilityData = await resp.json();
      }
    } catch (e) {
      // Data not available, calendar will show all as available
    }
  }

  /**
   * Returns the booking status for a given date:
   *  'booked'   — fully booked (middle of a booking)
   *  'checkin'  — a booking starts on this day
   *  'checkout' — a booking ends on this day
   *  'turnover' — one booking ends AND another starts on this day
   *  null       — fully available
   */
  function getBookingStatus(accommodationId, dateStr) {
    if (!availabilityData || !availabilityData[accommodationId]) return null;
    const bookings = availabilityData[accommodationId];
    let isStart = false;
    let isEnd = false;
    let isMid = false;
    for (let i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      if (dateStr === b.start) isStart = true;
      if (dateStr === b.end) isEnd = true;
      if (dateStr > b.start && dateStr < b.end) isMid = true;
    }
    if (isMid) return 'booked';
    if (isEnd && isStart) return 'turnover';
    if (isStart) return 'checkin';
    if (isEnd) return 'checkout';
    return null;
  }

  /**
   * Returns the last month (as {year, month}) that has booking data for this accommodation.
   * Falls back to current month + 3 if no data.
   */
  function getLastDataMonth(accommodationId) {
    const now = new Date();
    const fallback = { year: now.getFullYear(), month: now.getMonth() + 3 };
    if (!availabilityData || !availabilityData[accommodationId]) return fallback;

    const bookings = availabilityData[accommodationId];
    let maxDate = null;
    for (let i = 0; i < bookings.length; i++) {
      var end = bookings[i].end;
      if (!maxDate || end > maxDate) maxDate = end;
    }
    if (!maxDate) return fallback;

    var parts = maxDate.split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1 };
  }

  function formatDate(year, month, day) {
    return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function renderMonth(year, month, accommodationId) {
    const today = new Date();
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday = 0, Sunday = 6
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    let html = '<div class="bg-white rounded-xl border border-stone-200 p-4">';
    html += '<div class="text-center font-heading font-semibold text-stone-800 mb-3">' + MONTH_NAMES[month] + ' ' + year + '</div>';
    html += '<div class="calendar-grid">';

    // Day headers
    for (let i = 0; i < 7; i++) {
      html += '<div class="text-xs font-medium text-stone-400 text-center py-1">' + DAY_NAMES[i] + '</div>';
    }

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
      html += '<div class="calendar-day"></div>';
    }

    // Days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = formatDate(year, month, d);
      const status = getBookingStatus(accommodationId, dateStr);
      const isToday = dateStr === todayStr;
      let cls = 'calendar-day';
      if (status === 'booked') cls += ' booked';
      else if (status === 'checkin') cls += ' checkin';
      else if (status === 'checkout') cls += ' checkout';
      else if (status === 'turnover') cls += ' turnover';
      else cls += ' available';
      if (isToday) cls += ' today';
      html += '<div class="' + cls + '">' + d + '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function renderCalendarView(container, accommodationId, offset, totalMonths) {
    // Show 2 months at a time (1 on small screens handled by CSS)
    var html = '';
    for (var i = 0; i < 2 && (offset + i) < totalMonths; i++) {
      var now = new Date();
      var d = new Date(now.getFullYear(), now.getMonth() + offset + i, 1);
      html += renderMonth(d.getFullYear(), d.getMonth(), accommodationId);
    }
    container.innerHTML = html;
  }

  function initCalendars() {
    var calendars = document.querySelectorAll('.availability-calendar');
    calendars.forEach(function (el) {
      var id = el.dataset.accommodationId;
      if (!id) return;

      var container = el.querySelector('[id^="calendar-"]');
      if (!container) return;

      var now = new Date();
      var lastData = getLastDataMonth(id);
      // Total months from now until the last data month (inclusive)
      var totalMonths = (lastData.year - now.getFullYear()) * 12 + (lastData.month - now.getMonth()) + 1;
      if (totalMonths < 2) totalMonths = 2;

      var offset = 0;

      // Navigation
      var nav = el.querySelector('.calendar-nav');
      var prevBtn = nav ? nav.querySelector('.cal-prev') : null;
      var nextBtn = nav ? nav.querySelector('.cal-next') : null;
      var label = nav ? nav.querySelector('.cal-label') : null;

      function updateLabel() {
        if (!label) return;
        var startD = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        var endIdx = Math.min(offset + 1, totalMonths - 1);
        var endD = new Date(now.getFullYear(), now.getMonth() + endIdx, 1);
        if (startD.getFullYear() === endD.getFullYear() && startD.getMonth() === endD.getMonth()) {
          label.textContent = MONTH_NAMES[startD.getMonth()] + ' ' + startD.getFullYear();
        } else {
          label.textContent = MONTH_NAMES[startD.getMonth()] + ' – ' + MONTH_NAMES[endD.getMonth()] + ' ' + endD.getFullYear();
        }
      }

      function updateButtons() {
        if (prevBtn) {
          prevBtn.disabled = offset <= 0;
          prevBtn.classList.toggle('opacity-30', offset <= 0);
          prevBtn.classList.toggle('cursor-not-allowed', offset <= 0);
        }
        if (nextBtn) {
          var atEnd = offset + 2 >= totalMonths;
          nextBtn.disabled = atEnd;
          nextBtn.classList.toggle('opacity-30', atEnd);
          nextBtn.classList.toggle('cursor-not-allowed', atEnd);
        }
      }

      function render() {
        renderCalendarView(container, id, offset, totalMonths);
        updateLabel();
        updateButtons();
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (offset > 0) {
            offset -= 2;
            if (offset < 0) offset = 0;
            render();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (offset + 2 < totalMonths) {
            offset += 2;
            render();
          }
        });
      }

      render();
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await loadAvailability();
    initCalendars();
  });
})();

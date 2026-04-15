/**
 * Availability Calendar Component
 * Reads data from /data/availability.json and renders a month-view calendar
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

  function isBooked(accommodationId, dateStr) {
    if (!availabilityData || !availabilityData[accommodationId]) return false;
    const bookings = availabilityData[accommodationId];
    return bookings.some(function (b) {
      return dateStr >= b.start && dateStr <= b.end;
    });
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
      const booked = isBooked(accommodationId, dateStr);
      const isToday = dateStr === todayStr;
      let cls = 'calendar-day';
      if (booked) cls += ' booked';
      else cls += ' available';
      if (isToday) cls += ' today';
      html += '<div class="' + cls + '">' + d + '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function initCalendars() {
    const calendars = document.querySelectorAll('.availability-calendar');
    calendars.forEach(function (el) {
      const id = el.dataset.accommodationId;
      if (!id) return;

      const container = el.querySelector('[id^="calendar-"]');
      if (!container) return;

      const now = new Date();
      let html = '';
      // Show current month + next 3 months
      for (let i = 0; i < 4; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        html += renderMonth(d.getFullYear(), d.getMonth(), id);
      }
      container.innerHTML = html;
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await loadAvailability();
    initCalendars();
  });
})();

const { HDate } = require('@hebcal/core');

const now = new Date();
let h = new HDate(now);
console.log("Current Hebrew date:", h.toString());
console.log("Current month:", h.getMonthName('he'));
console.log("Current day:", h.renderGematriya().split(' ')[0]);

const day15 = new HDate(15, h.getMonth(), h.getFullYear());
console.log("Day 15:", day15.toString());

const nextMonth = new HDate(day15.abs() + 30);
console.log("Next month:", nextMonth.getMonthName('he'));

const prevMonth = new HDate(day15.abs() - 30);
console.log("Prev month:", prevMonth.getMonthName('he'));

const firstDay = new HDate(1, h.getMonth(), h.getFullYear());
console.log("First day of month day of week:", firstDay.getDay());
console.log("Days in month:", h.daysInMonth());

import {
  addDays,
  getDay,
  lastDayOfMonth,
  subDays,
} from 'date-fns';

type Holiday = {
  name: string;
  date: Date;
};

// Finds the nth occurrence of a specific weekday in a given month and year.
// dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
function getNthDayOfMonth(n: number, dayOfWeek: number, month: number, year: number): Date {
  const date = new Date(year, month, 1);
  let count = 0;
  while (count < n) {
    if (getDay(date) === dayOfWeek) {
      count++;
    }
    if (count < n) {
      date.setDate(date.getDate() + 1);
    }
  }
  return date;
}

// Finds the last occurrence of a specific weekday in a given month and year.
function getLastDayOfMonth(dayOfWeek: number, month: number, year: number): Date {
    let date = lastDayOfMonth(new Date(year, month));
    while(getDay(date) !== dayOfWeek) {
        date = subDays(date, 1);
    }
    return date;
}


// Adjusts a holiday date if it falls on a weekend.
// If it's on a Saturday, it's observed on the preceding Friday.
// If it's on a Sunday, it's observed on the following Monday.
function getObservedDate(date: Date): Date {
  const day = getDay(date);
  if (day === 6) { // Saturday
    return subDays(date, 1);
  }
  if (day === 0) { // Sunday
    return addDays(date, 1);
  }
  return date;
}

export function getUSHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];

  // New Year's Day
  holidays.push({ name: "Año Nuevo", date: getObservedDate(new Date(year, 0, 1)) });

  // Martin Luther King, Jr. Day (3rd Monday in January)
  holidays.push({ name: "Día de Martin Luther King, Jr.", date: getNthDayOfMonth(3, 1, 0, year) });

  // Presidents' Day (3rd Monday in February)
  holidays.push({ name: "Día de los Presidentes", date: getNthDayOfMonth(3, 1, 1, year) });

  // Memorial Day (Last Monday in May)
  holidays.push({ name: "Día de los Caídos (Memorial Day)", date: getLastDayOfMonth(1, 4, year) });

  // Juneteenth National Independence Day
  holidays.push({ name: "Juneteenth", date: getObservedDate(new Date(year, 5, 19)) });

  // Independence Day
  holidays.push({ name: "Día de la Independencia", date: getObservedDate(new Date(year, 6, 4)) });

  // Labor Day (1st Monday in September)
  holidays.push({ name: "Día del Trabajo (Labor Day)", date: getNthDayOfMonth(1, 1, 8, year) });

  // Thanksgiving Day (4th Thursday in November)
  holidays.push({ name: "Día de Acción de Gracias", date: getNthDayOfMonth(4, 4, 10, year) });

  // Christmas Day
  holidays.push({ name: "Navidad", date: getObservedDate(new Date(year, 11, 25)) });

  return holidays;
}

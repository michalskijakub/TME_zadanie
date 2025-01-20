const fs = require("fs");
const parse = require("csv-parse/sync");
const readline = require("readline");

const loadCsvFromFile = (filePath) => {
  const fileContent = fs.readFileSync(filePath, "utf8");
  return parse
    .parse(fileContent, {
      columns: ["id", "date", "value", "currency"],
      skip_empty_lines: true,
      delimiter: ",",
      trim: true,
    })
    .map((row) => ({
      id: parseInt(row.id, 10),
      date: row.date,
      value: parseFloat(row.value.replace(",", ".")),
      currency: row.currency,
    }));
};

const filterDataByDateRange = (data, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return data.filter((row) => {
    const rowDate = new Date(row.date);
    return rowDate >= start && rowDate <= end;
  });
};

// 1: The biggest daily drop in value

const findMaxDailyDrop = (date) => {
  let drop = 0;
  let startDate = null;
  let endDate = null;

  for (let i = 1; i < date.length; i++) {
    const dailyDrop = date[i - 1].value - date[i].value;
    if (dailyDrop > drop) {
      drop = dailyDrop;
      startDate = date[i - 1].date;
      endDate = date[i].date;
    }
  }

  return { drop, startDate, endDate };
};

// 2: Count of periods of price declines

const findCountDropPeriods = (date) => {
  let periods = 0;
  let end = false;

  for (let i = 1; i < date.length; i++) {
    if (date[i].value < date[i - 1].value) {
      if (!end) {
        periods++;
        end = true;
      }
    } else if (date[i].value > date[i - 1].value) {
      end = false;
    }
  }

  if (end) {
    periods--;
  }

  return periods;
};

// 3: The period of biggest decline

const findMaxDropPeriod = (date) => {
  let max = 0;
  let current = 0;
  let currentDate = null;
  let startDate = null;
  let endDate = null;

  for (let i = 1; i < date.length; i++) {
    if (date[i].value < date[i - 1].value) {
      if (currentDate === null) currentDate = date[i - 1].date;
      current += date[i - 1].value - date[i].value;
    } else {
      if (current > max) {
        max = current;
        startDate = currentDate;
        endDate = date[i - 1].date;
      }
      currentDate = null;
      current = 0;
    }
  }

  if (current > max) {
    max = current;
    startDate = currentDate;
    endDate = date[date.length - 1].date;
  }

  let days = 0;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    days = (end - start) / (1000 * 60 * 60 * 24) + 1;
  }

  return { max, startDate, endDate, days };
};

// 4: The longest period of unchanged price

const findLongestStablePeriod = (date) => {
  let longest = 0;
  let current = 1;
  let value = null;
  let startDate = null;
  let endDate = null;
  let currentDate = null;

  for (let i = 1; i < date.length; i++) {
    if (date[i].value === date[i - 1].value) {
      current++;
      if (current === 2) currentDate = date[i - 1].date;
    } else {
      if (current >= longest) {
        longest = current;
        value = date[i - 1].value;
        startDate = currentDate || date[i - 1].date;
        endDate = date[i - 1].date;
      }
      current = 1;
      currentDate = null;
    }
  }

  if (current > longest) {
    longest = current;
    value = date[date.length - 1].value;
    startDate = currentDate || date[date.length - 1].date;
    endDate = date[date.length - 1].date;
  }

  return { longest, value, startDate, endDate };
};

const analyzeDate = (date) => {
  const maxDailyDrop = findMaxDailyDrop(date);
  if (maxDailyDrop.drop === 0) {
    console.log("1. Brak spadku ceny w tym okresie");
  } else {
    console.log(
      "1. Największy dzienny spadek wynosi -",
      Math.round(maxDailyDrop.drop * 100) / 100,
      "i miał miejsce z dnia",
      maxDailyDrop.startDate,
      "na",
      maxDailyDrop.endDate
    );
  }

  const countDropPeriods = findCountDropPeriods(date);
  console.log("2. Liczba okresów spadków cen wynosi -", countDropPeriods);

  const maxDropPeriod = findMaxDropPeriod(date);
  if (maxDropPeriod.max === 0) {
    console.log("3. W tym okresie nie było żadnych okresów spadków cen");
  } else {
    console.log(
      "3. Okres największego spadku trwał od",
      maxDropPeriod.startDate,
      "do",
      maxDropPeriod.endDate,
      ". Wyniósł on",
      Math.round(maxDropPeriod.max * 100) / 100,
      "i trwał",
      maxDropPeriod.days,
      "dni."
    );
  }

  const longestStablePeriod = findLongestStablePeriod(date);
  if (longestStablePeriod.startDate === longestStablePeriod.endDate) {
    console.log(
      "4. Nie występują żadne okresy stabilnej ceny w podanym zakresie dat. Najdłuższy okres jaki występuje jest to okres 1 dnia. Podaję cenę z pierwszego dnia z tego zakresu",
      longestStablePeriod.value
    );
  } else {
    console.log(
      "4. Najdłuższy okres stabilnej ceny trwał od",
      longestStablePeriod.startDate,
      "do",
      longestStablePeriod.endDate,
      ". Trwał on",
      longestStablePeriod.longest,
      "dni, a wartość akcji wynosiła",
      longestStablePeriod.value
    );
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Podaj datę początkową (YYYY-MM-DD): ", (startDate) => {
  rl.question("Podaj datę końcową (YYYY-MM-DD): ", (endDate) => {
    const filePath = "./ceny_akcji.csv";
    const data = loadCsvFromFile(filePath);
    const filteredData = filterDataByDateRange(data, startDate, endDate);

    if (filteredData.length === 0) {
      console.log(
        "W tym zakresie dat nie występują żadne dane, badź podano błędnie dane"
      );
    } else {
      analyzeDate(filteredData);
    }

    rl.close();
  });
});

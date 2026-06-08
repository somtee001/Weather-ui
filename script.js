let isCelsius = true;        // tracks which unit we're showing
let weatherData = null;      // stores the last fetched data so 

function toF(c) {
    return Math.round((c * 9/5) + 32);
}

function formatTemp(c) {
    if (isCelsius) {
        return Math.round(c) + "°C";
    } else {
        return toF(c) + "°F";
    }
}

function getCondition(code) {
if (code === 0)                   return { emoji: "☀️",  label: "Clear Sky" };
if (code === 1)                   return { emoji: "🌤️", label: "Mainly Clear" };
if (code === 2)                   return { emoji: "⛅",  label: "Partly Cloudy" };
if (code === 3)                   return { emoji: "☁️",  label: "Overcast" };
if (code >= 45 && code <= 48)     return { emoji: "🌫️", label: "Foggy" };
if (code >= 51 && code <= 55)     return { emoji: "🌦️", label: "Drizzle" };
if (code >= 61 && code <= 65)     return { emoji: "🌧️", label: "Rain" };
if (code >= 71 && code <= 75)     return { emoji: "❄️",  label: "Snow" };
if (code >= 80 && code <= 82)     return { emoji: "🌧️", label: "Rain Showers" };
if (code >= 95 && code <= 99)     return { emoji: "⛈️", label: "Thunderstorm" };
return { emoji: "🌡️", label: "Unknown" };
}

function formatDate(dateStr) {
// dateStr comes in as "2025-08-05"
const date = new Date(dateStr + "T12:00:00"); // noon avoids timezone shift
return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric"
});
}

// ─────────────────────────────────────────────
// HELPER: Short day name like "Tue", "Wed"
// ─────────────────────────────────────────────
function shortDay(dateStr) {
const date = new Date(dateStr + "T12:00:00");
return date.toLocaleDateString("en-US", { weekday: "short" });
}

// ─────────────────────────────────────────────
// STEP 1: Search for a city using Open-Meteo Geocoding API
// This turns a city name into latitude & longitude
async function geocodeCity(cityName) {
const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
const response = await fetch(url);
const data = await response.json();

// If nothing found, return null
if (!data.results || data.results.length === 0) {
    return null;
}

// Return the first result
return data.results[0];
}

// STEP 2: Fetch weather using latitude & longitude
async function fetchWeather(lat, lon, timezone) {
const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=${encodeURIComponent(timezone)}` +
    `&forecast_days=7`;

const response = await fetch(url);
const data = await response.json();
return data;
}

// STEP 3: Update the page with the fetched data
function renderWeather(location, weather) {
const current = weather.current;
const daily   = weather.daily;
const hourly  = weather.hourly;

// Store data globally so units toggle can re-render
weatherData = { location, weather };

// --- Current weather card ---
const condition = getCondition(current.weather_code);

document.getElementById("city-name").textContent =
    location.name + ", " + (location.country || "");

document.getElementById("current-date").textContent =
    formatDate(current.time.split("T")[0]);

// Local time from the current.time string e.g. "2025-08-05T14:45"
const timePart = current.time.split("T")[1];
const [hourStr, minStr] = timePart.split(":");
let hour = parseInt(hourStr);
const minutes = minStr;
const ampm = hour >= 12 ? "PM" : "AM";
if (hour > 12) hour -= 12;
if (hour === 0) hour = 12;
document.getElementById("local-time").textContent =
    `🕒 Local time: ${hour}:${minutes} ${ampm}`;

document.getElementById("temperature").textContent =
    formatTemp(current.temperature_2m);

document.getElementById("condition-text").textContent = condition.label;
document.getElementById("condition-badge").textContent =
    condition.emoji + " " + condition.label;
document.getElementById("weather-icon").textContent = condition.emoji;

document.getElementById("temp-high").textContent =
    formatTemp(daily.temperature_2m_max[0]);
document.getElementById("temp-low").textContent =
    formatTemp(daily.temperature_2m_min[0]);

// --- Stat cards ---
document.getElementById("feels-like").textContent =
    formatTemp(current.apparent_temperature);
document.getElementById("humidity").textContent =
    current.relative_humidity_2m + "%";
document.getElementById("wind-speed").textContent =
    current.wind_speed_10m + " km/h";
document.getElementById("precipitation").textContent =
    current.precipitation + " mm";

// --- Daily forecast (7 days) ---
const dailyContainer = document.getElementById("daily-forecast");
dailyContainer.innerHTML = ""; // clear old cards

for (let i = 0; i < 7; i++) {
    const dayCondition = getCondition(daily.weather_code[i]);
    const card = document.createElement("div");
    card.className = "bg-[#131829] rounded-2xl p-3 flex flex-col items-center gap-2 text-sm";
    card.innerHTML = `
    <p class="text-gray-300">${shortDay(daily.time[i])}</p>
    <span class="text-2xl">${dayCondition.emoji}</span>
    <p class="font-semibold">${formatTemp(daily.temperature_2m_max[i])}</p>
    <p class="text-gray-400">${formatTemp(daily.temperature_2m_min[i])}</p>
    `;
    dailyContainer.appendChild(card);
}

// --- Hourly forecast (next 8 hours from current hour) ---
const hourlyContainer = document.getElementById("hourly-forecast");
hourlyContainer.innerHTML = ""; // clear old rows

// Find which index in the hourly array matches the current time
const currentTimeStr = current.time; // e.g. "2025-08-05T14:00"
let startIndex = 0;
for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] === currentTimeStr) {
    startIndex = i;
    break;
    }
}

// Show 8 hours starting from now
for (let i = startIndex; i < startIndex + 8 && i < hourly.time.length; i++) {
    const hourlyCondition = getCondition(hourly.weather_code[i]);

    // Format the hour label
    const hTime = hourly.time[i].split("T")[1]; // "14:00"
    const [hh] = hTime.split(":");
    let h = parseInt(hh);
    const ap = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    const timeLabel = `${h} ${ap}`;

    const isLast = (i === startIndex + 7);
    const borderClass = isLast ? "" : "border-b border-white/10";

    const row = document.createElement("div");
    row.className = `flex items-center justify-between py-2 ${borderClass}`;
    row.innerHTML = `
    <span class="text-gray-300 text-sm w-16">${timeLabel}</span>
    <span class="text-xl">${hourlyCondition.emoji}</span>
    <span class="font-semibold text-sm">${formatTemp(hourly.temperature_2m[i])}</span>
    `;
    hourlyContainer.appendChild(row);
}
}

// ─────────────────────────────────────────────
// MAIN SEARCH FUNCTION
// Ties everything together: geocode → fetch → render
// ─────────────────────────────────────────────
async function searchCity(cityName) {
// Show loading state on the button
const btn = document.getElementById("search-btn");
btn.innerHTML = '<span class="spinner"></span>';
btn.disabled = true;

// Hide any previous error
document.getElementById("error-msg").classList.add("hidden");

try {
    // Step 1: get lat/lon for the city
    const location = await geocodeCity(cityName);

    if (!location) {
    // City not found — show error
    document.getElementById("error-msg").classList.remove("hidden");
    return;
    }

    // Step 2: get weather for that location
    const weather = await fetchWeather(location.latitude, location.longitude, location.timezone);

    // Step 3: put the data on the page
    renderWeather(location, weather);

} catch (error) {
    // Something went wrong (network issue, etc.)
    document.getElementById("error-msg").textContent = "⚠️ Something went wrong. Check your connection.";
    document.getElementById("error-msg").classList.remove("hidden");
    console.error(error);

} finally {
    // Always restore the button no matter what happened
    btn.innerHTML = "Search";
    btn.disabled = false;
}
}

// UNITS TOGGLE
// Switches between °C and °F and re-renders
document.getElementById("units-btn").addEventListener("click", function () {
isCelsius = !isCelsius; // flip the flag

// Update button label
this.textContent = isCelsius ? "⚙️ °C / °F ▾" : "⚙️ °F / °C ▾";

// Re-render the page with the same data but new unit
if (weatherData) {
    renderWeather(weatherData.location, weatherData.weather);
}
});

// SEARCH BUTTON click
document.getElementById("search-btn").addEventListener("click", function () {
const cityName = document.getElementById("search-input").value.trim();
if (cityName !== "") {
    searchCity(cityName);
}
});

// ENTER KEY in the search input
document.getElementById("search-input").addEventListener("keydown", function (event) {
if (event.key === "Enter") {
    const cityName = this.value.trim();
    if (cityName !== "") {
    searchCity(cityName);
    }
}
});

// ON PAGE LOAD: fetch weather for Lagos by default
searchCity("Lagos");
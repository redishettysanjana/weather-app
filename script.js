
const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const message = document.getElementById("message");
const weatherResult = document.getElementById("weather-result");
const suggestions = document.getElementById("city-suggestions");

let selectedCity = null;
let debounceTimer;

// Weather condition descriptions
const conditions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Heavy rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail"
};

// Choose an icon for each weather condition
function getWeatherIcon(code) {
    if (code === 0) return "☀️";
    if ([1, 2].includes(code)) return "🌤️";
    if ([3, 45, 48].includes(code)) return "☁️";

    if (
        [51, 53, 55, 56, 57, 61, 63, 65,
         66, 67, 80, 81, 82].includes(code)
    ) {
        return "🌧️";
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return "❄️";
    }

    if ([95, 96, 99].includes(code)) {
        return "⛈️";
    }

    return "🌡️";
}

// CITY AUTOCOMPLETE
cityInput.addEventListener("input", function () {
    const query = cityInput.value.trim();

    selectedCity = null;
    suggestions.replaceChildren();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
        return;
    }

    debounceTimer = setTimeout(async function () {
        try {
            const url =
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=7&language=en&format=json`;

            const response = await fetch(url);

            if (!response.ok) return;

            const data = await response.json();

            // Ignore results for an older search
            if (cityInput.value.trim() !== query) return;

            if (!data.results) return;

            data.results.forEach(function (city) {
                const option = document.createElement("button");

                option.type = "button";
                option.className = "city-option";

                const details = [
                    city.name,
                    city.admin1,
                    city.country
                ].filter(Boolean);

                option.textContent = [...new Set(details)].join(", ");

                option.addEventListener("click", function () {
                    selectedCity = city;
                    cityInput.value = city.name;
                    suggestions.replaceChildren();
                });

                suggestions.appendChild(option);
            });
        } catch (error) {
            console.error("City suggestions failed:", error);
        }
    }, 300);
});

// SEARCH WEATHER
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const query = cityInput.value.trim();

    if (!query) {
        message.textContent = "Please enter a city name.";
        return;
    }

    suggestions.replaceChildren();
    message.textContent = "Loading weather...";
    weatherResult.replaceChildren();

    try {
        let location = selectedCity;

        // Find the city if the user didn't select a suggestion
        if (!location) {
            const geoUrl =
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;

            const geoResponse = await fetch(geoUrl);

            if (!geoResponse.ok) {
                throw new Error("Unable to search for the city.");
            }

            const geoData = await geoResponse.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error("City not found. Try another city.");
            }

            location = geoData.results[0];
        }

        // Fetch current weather and five-day forecast
        const weatherUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
            `&forecast_days=5&timezone=auto`;

        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            throw new Error("Unable to fetch weather data.");
        }

        const weatherData = await weatherResponse.json();
        const current = weatherData.current;
        const daily = weatherData.daily;

        const condition =
            conditions[current.weather_code] || "Unknown condition";

        // CREATE FIVE-DAY FORECAST CARDS
        const forecastCards = daily.time.map(function (date, index) {
            const code = daily.weather_code[index];

            const icon = getWeatherIcon(code);
            const forecastCondition = conditions[code] || "Unknown";

            const day = new Date(date + "T12:00:00").toLocaleDateString(
                "en-US",
                {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                }
            );

            const maxTemp = daily.temperature_2m_max[index];
            const minTemp = daily.temperature_2m_min[index];
            const rainChance =
                daily.precipitation_probability_max[index];

            return `
                <div class="forecast-card">
                    <p class="forecast-day">${day}</p>

                    <div class="forecast-icon">${icon}</div>

                    <p class="forecast-condition">
                        ${forecastCondition}
                    </p>

                    <p class="forecast-temp">
                        <strong>${maxTemp}°</strong>
                        <span>${minTemp}°</span>
                    </p>

                    <p class="forecast-rain">
                        💧 ${rainChance ?? "—"}% chance
                    </p>
                </div>
            `;
        }).join("");

        // DISPLAY CURRENT WEATHER AND FORECAST
        message.textContent = "";

        const cityHeading = document.createElement("h2");
        cityHeading.textContent =
            [location.name, location.country].filter(Boolean).join(", ");

        const currentWeather = document.createElement("div");
        currentWeather.className = "current-weather";

        const currentIcon = document.createElement("div");
        currentIcon.className = "forecast-icon";
        currentIcon.textContent = getWeatherIcon(current.weather_code);

        const temperature = document.createElement("h3");
        temperature.textContent = `${current.temperature_2m} °C`;

        const conditionText = document.createElement("p");
        conditionText.textContent = condition;

        const feelsLike = document.createElement("p");
        feelsLike.textContent =
            `Feels like: ${current.apparent_temperature} °C`;

        const humidity = document.createElement("p");
        humidity.textContent =
            `Humidity: ${current.relative_humidity_2m}%`;

        const wind = document.createElement("p");
        wind.textContent =
            `Wind speed: ${current.wind_speed_10m} km/h`;

        const precipitation = document.createElement("p");
        precipitation.textContent =
            `Precipitation: ${current.precipitation} mm`;

        const updated = document.createElement("p");
        updated.textContent =
            `Updated: ${current.time.replace("T", " ")}`;

        currentWeather.append(
            currentIcon,
            temperature,
            conditionText,
            feelsLike,
            humidity,
            wind,
            precipitation,
            updated
        );

        const forecastHeading = document.createElement("h3");
        forecastHeading.className = "forecast-heading";
        forecastHeading.textContent = "5-Day Forecast";

        const forecastContainer = document.createElement("div");
        forecastContainer.className = "forecast-container";
        forecastContainer.innerHTML = forecastCards;

        weatherResult.replaceChildren(
            cityHeading,
            currentWeather,
            forecastHeading,
            forecastContainer
        );

    } catch (error) {
        message.textContent =
            error.message === "Failed to fetch"
                ? "Network error. Check your internet connection."
                : error.message;

        console.error("Weather search failed:", error);
    }
});

// CLOSE SUGGESTIONS WHEN CLICKING OUTSIDE
document.addEventListener("click", function (event) {
    if (!event.target.closest(".city-search-wrapper")) {
        suggestions.replaceChildren();
    }
});

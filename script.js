
const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const message = document.getElementById("message");
const weatherResult = document.getElementById("weather-result");
const suggestions = document.getElementById("city-suggestions");

let selectedCity = null;
let debounceTimer;

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

        const weatherUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;

        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            throw new Error("Unable to fetch weather data.");
        }

        const weatherData = await weatherResponse.json();
        const current = weatherData.current;

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
            61: "Slight rain",
            63: "Moderate rain",
            65: "Heavy rain",
            71: "Slight snow",
            73: "Moderate snow",
            75: "Heavy snow",
            80: "Rain showers",
            81: "Moderate rain showers",
            82: "Heavy rain showers",
            95: "Thunderstorm"
        };

        const condition =
            conditions[current.weather_code] || "Unknown condition";

        message.textContent = "";

        weatherResult.innerHTML = `
            <h2>${location.name}, ${location.country}</h2>
            <h3>${current.temperature_2m} °C</h3>
            <p>${condition}</p>
            <p>Feels like: ${current.apparent_temperature} °C</p>
            <p>Humidity: ${current.relative_humidity_2m}%</p>
            <p>Wind speed: ${current.wind_speed_10m} km/h</p>
            <p>Precipitation: ${current.precipitation} mm</p>
            <p>Updated: ${current.time.replace("T", " ")}</p>
        `;
    } catch (error) {
        message.textContent =
            error.message === "Failed to fetch"
                ? "Network error. Check your internet connection."
                : error.message;
    }
});

document.addEventListener("click", function (event) {
    if (!event.target.closest(".city-search-wrapper")) {
        suggestions.replaceChildren();
    }
});

const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const message = document.getElementById("message");
const weatherResult = document.getElementById("weather-result");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const city = cityInput.value.trim();

    if (city === "") {
        message.textContent = "Please enter a city name.";
        weatherResult.innerHTML = "";
        return;
    }

    message.textContent = "Loading weather...";
    weatherResult.innerHTML = "";

    try {
        // Step-1: Find the city's coordinates
        const geoUrl =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

        const geoResponse = await fetch(geoUrl);

        if (!geoResponse.ok) {
            throw new Error("Unable to search for the city.");
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found. Please try another city.");
        }

        const location = geoData.results[0];
        const latitude = location.latitude;
        const longitude = location.longitude;

        // Step-2: Get the weather using coordinates
        const weatherUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;

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
            48: "Depositing rime fog",
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
            82: "Violent rain showers",
            95: "Thunderstorm"
        };

        const condition =
            conditions[current.weather_code] || "Weather condition unavailable";

        // Display the weather
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
        message.textContent = error.message.includes("Failed to fetch")
            ? "Network error. Please check your internet connection."
            : error.message;

        weatherResult.innerHTML = "";
    }
});

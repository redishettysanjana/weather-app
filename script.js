const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const message = document.getElementById("message");
const weatherResult = document.getElementById("weather-result");
const suggestions = document.getElementById("city-suggestions");

let selectedCity = null;
let debounceTimer;
let temperatureUnit = "celsius";
let countriesCache = null;

// WEATHER CONDITIONS
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

const continentNames = [
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "South America",
    "Oceania",
    "Antarctica"
];

const antarcticaStations = [
    {
        name: "McMurdo Station",
        country: "Antarctica",
        latitude: -77.8419,
        longitude: 166.6863
    },
    {
        name: "Amundsen-Scott South Pole Station",
        country: "Antarctica",
        latitude: -90,
        longitude: 0
    },
    {
        name: "Palmer Station",
        country: "Antarctica",
        latitude: -64.7742,
        longitude: -64.0530
    },
    {
        name: "Rothera Research Station",
        country: "Antarctica",
        latitude: -67.5683,
        longitude: -68.1250
    },
    {
        name: "Vostok Station",
        country: "Antarctica",
        latitude: -78.4644,
        longitude: 106.8370
    },
    {
        name: "Concordia Station",
        country: "Antarctica",
        latitude: -75.1000,
        longitude: 123.3500
    }
];

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

function getWeatherTheme(code) {
    if ([0, 1].includes(code)) return "sunny";
    if ([2, 3, 45, 48].includes(code)) return "cloudy";

    if (
        [51, 53, 55, 56, 57, 61, 63, 65,
            66, 67, 80, 81, 82].includes(code)
    ) {
        return "rainy";
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return "snowy";
    }

    if ([95, 96, 99].includes(code)) {
        return "stormy";
    }

    return "cloudy";
}

function applyWeatherTheme(code) {
    const theme = getWeatherTheme(code);

    document.body.classList.remove(
        "weather-sunny",
        "weather-cloudy",
        "weather-rainy",
        "weather-snowy",
        "weather-stormy"
    );

    document.body.classList.add(`weather-${theme}`);
}

async function fetchWeatherWithRetry(url) {
    let response;

    for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(url);

        if (response.ok) return response;

        if (
            response.status !== 503 &&
            response.status !== 429
        ) {
            break;
        }

        if (attempt === 3) break;

        const retryAfter = Number(
            response.headers.get("Retry-After")
        );

        const delay =
            Number.isFinite(retryAfter) && retryAfter > 0
                ? Math.min(retryAfter * 1000, 10000)
                : attempt * 3000;

        message.textContent =
            `Weather service is busy. Retrying (${attempt}/2)...`;

        await new Promise(resolve => setTimeout(resolve, delay));
    }

    let errorMessage = "";

    try {
        const errorData = await response.json();
        errorMessage = errorData.reason || errorData.message || "";
    } catch (error) {
        console.log("Could not read API error details.");
    }

    if (response.status === 503) {
        throw new Error(
            errorMessage ||
            "Weather service is temporarily unavailable. Please try again later."
        );
    }

    if (response.status === 429) {
        throw new Error(
            errorMessage ||
            "Too many requests. Please wait before trying again."
        );
    }

    throw new Error(
        errorMessage ||
        `Unable to fetch weather data. Error ${response.status}.`
    );
}

async function getAllCountries() {
    if (countriesCache) return countriesCache;

    const response = await fetch(
        "https://restcountries.com/v3.1/all?fields=name,capital,cca2,region,subregion"
    );

    if (!response.ok) {
        throw new Error("Could not load the country list.");
    }

    countriesCache = await response.json();

    return countriesCache;
}

function addLocationSuggestion(label, onClick) {
    const option = document.createElement("button");

    option.type = "button";
    option.className = "city-option";
    option.textContent = label;

    option.addEventListener("click", onClick);

    suggestions.appendChild(option);
}

async function showCountries(continent) {
    message.textContent = `Loading locations in ${continent}...`;

    if (continent === "Antarctica") {
        suggestions.replaceChildren();

        antarcticaStations.forEach(station => {
            addLocationSuggestion(
                `${station.name} — research station`,
                () => {
                    selectedCity = {
                        name: station.name,
                        country: "Antarctica",
                        latitude: station.latitude,
                        longitude: station.longitude
                    };

                    cityInput.value = station.name;
                    suggestions.replaceChildren();

                    message.textContent =
                        "Station selected. Press Search.";
                }
            );
        });

        message.textContent =
            "Choose an Antarctic research station.";

        return;
    }

    const countries = await getAllCountries();

    const matches = countries.filter(country => {

        if (continent === "North America") {
            return (
                country.region === "Americas" &&
                [
                    "Northern America",
                    "Central America",
                    "Caribbean"
                ].includes(country.subregion)
            );
        }

        if (continent === "South America") {
            return (
                country.region === "Americas" &&
                country.subregion === "South America"
            );
        }

        return country.region === continent;

    }).sort((a, b) =>
        a.name.common.localeCompare(b.name.common)
    );

    suggestions.replaceChildren();

    matches.forEach(country => {
        addLocationSuggestion(country.name.common, () => {
            cityInput.value = country.name.common;
            showCities(country);
        });
    });

    message.textContent =
        `Choose a country in ${continent}.`;
}

async function showCities(country) {
    suggestions.replaceChildren();

    message.textContent =
        `Loading places in ${country.name.common}...`;

    if (country.name.common.toLowerCase() === "antarctica") {

        antarcticaStations.forEach(station => {
            addLocationSuggestion(
                `${station.name} — research station`,
                () => {
                    selectedCity = {
                        name: station.name,
                        country: "Antarctica",
                        latitude: station.latitude,
                        longitude: station.longitude
                    };

                    cityInput.value = station.name;
                    suggestions.replaceChildren();

                    message.textContent =
                        "Station selected. Press Search.";
                }
            );
        });

        message.textContent =
            "Choose an Antarctic research station.";

        return;
    }

    try {
        const response = await fetch(
            "https://countriesnow.space/api/v0.1/countries/cities",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    country: country.name.common
                })
            }
        );

        if (!response.ok) {
            throw new Error("City list unavailable.");
        }

        const result = await response.json();

        const cities = Array.isArray(result.data)
            ? result.data
            : [];

        if (!cities.length) {
            throw new Error("No city list returned.");
        }

        cities.sort((a, b) => a.localeCompare(b));

        cities.slice(0, 60).forEach(cityName => {

            addLocationSuggestion(cityName, async () => {

                message.textContent = `Finding ${cityName}...`;

                suggestions.replaceChildren();

                try {
                    const url =
                        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`;

                    const geoResponse = await fetch(url);

                    if (!geoResponse.ok) {
                        throw new Error(
                            "Could not find that city."
                        );
                    }

                    const geoData = await geoResponse.json();

                    const match = (geoData.results || []).find(
                        place =>
                            place.country_code === country.cca2
                    );

                    if (!match) {
                        throw new Error(
                            "Weather coordinates not found for this city."
                        );
                    }

                    selectedCity = match;

                    cityInput.value =
                        `${match.name}, ${country.name.common}`;

                    message.textContent =
                        "Location selected. Press Search.";

                } catch (error) {
                    message.textContent = error.message;
                }
            });
        });

        message.textContent =
            `Choose a city in ${country.name.common} (up to 60 shown).`;

    } catch (error) {

        const capital = Array.isArray(country.capital)
            ? country.capital[0]
            : null;

        if (capital) {

            addLocationSuggestion(
                `${capital} (capital)`,
                () => {
                    cityInput.value = capital;
                    selectedCity = null;
                    suggestions.replaceChildren();

                    message.textContent =
                        "Press Search to find the capital's weather.";
                }
            );

            message.textContent =
                "Could not load the full city list; try the capital.";

        } else {
            message.textContent =
                "Could not load cities. Try searching for a place by name.";
        }
    }
}

cityInput.addEventListener("input", function () {

    const query = cityInput.value.trim();

    selectedCity = null;
    suggestions.replaceChildren();

    clearTimeout(debounceTimer);

    if (query.length < 2) return;

    debounceTimer = setTimeout(async function () {

        try {

            // Check if the search is a continent
            const continent = continentNames.find(
                name =>
                    name.toLowerCase() === query.toLowerCase()
            );

            if (continent) {
                await showCountries(continent);
                return;
            }

            const countries = await getAllCountries();

            if (cityInput.value.trim() !== query) return;

            const country = countries.find(item =>
                item.name.common.toLowerCase() === query.toLowerCase() ||
                item.name.official?.toLowerCase() === query.toLowerCase()
            );

            if (country) {
                await showCities(country);
                return;
            }

            const url =
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=7&language=en&format=json`;

            const response = await fetch(url);

            if (!response.ok) return;

            const data = await response.json();

            if (cityInput.value.trim() !== query) return;

            (data.results || []).forEach(place => {

                const label = [
                    place.name,
                    place.admin1,
                    place.country
                ].filter(Boolean).join(", ");

                addLocationSuggestion(label, () => {

                    selectedCity = place;
                    cityInput.value = place.name;

                    suggestions.replaceChildren();

                    message.textContent =
                        "Location selected. Press Search.";
                });
            });

            if (!data.results?.length) {
                message.textContent =
                    "No matching places found. Try a city, country, or continent.";
            }

        } catch (error) {

            console.error(
                "Location suggestions failed:",
                error
            );

            message.textContent =
                "Could not load suggestions. Please try again.";
        }

    }, 350);
});

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    const query = cityInput.value.trim();

    if (!query) {
        message.textContent =
            "Please enter a location.";

        return;
    }

    suggestions.replaceChildren();

    message.textContent = "Loading weather...";
    weatherResult.replaceChildren();

    try {

        let location = selectedCity;

        if (!location) {

            const continent = continentNames.find(
                name =>
                    name.toLowerCase() === query.toLowerCase()
            );

            if (continent) {
                await showCountries(continent);

                message.textContent =
                    `Choose a country in ${continent} from the suggestions.`;

                return;
            }

            const countries = await getAllCountries();

            const country = countries.find(item =>
                item.name.common.toLowerCase() === query.toLowerCase() ||
                item.name.official?.toLowerCase() === query.toLowerCase()
            );

            if (country) {
                await showCities(country);

                message.textContent =
                    `Choose a city in ${country.name.common} from the suggestions.`;

                return;
            }

            const geoUrl =
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;

            const geoResponse = await fetch(geoUrl);

            if (!geoResponse.ok) {
                throw new Error(
                    "Unable to search for this location."
                );
            }

            const geoData = await geoResponse.json();

            if (
                !geoData.results ||
                geoData.results.length === 0
            ) {
                throw new Error(
                    "Location not found. Try a city, country, or continent."
                );
            }

            location = geoData.results[0];
        }

        const weatherUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
            `&forecast_days=5&timezone=auto&temperature_unit=${temperatureUnit}`;

        const weatherResponse =
            await fetchWeatherWithRetry(weatherUrl);

        const weatherData = await weatherResponse.json();

        const current = weatherData.current;
        const daily = weatherData.daily;

        if (!current || !daily || !daily.time) {
            throw new Error(
                "Weather data is incomplete. Please try again."
            );
        }

        applyWeatherTheme(current.weather_code);

        const unitSymbol =
            temperatureUnit === "celsius"
                ? "°C"
                : "°F";

        const condition =
            conditions[current.weather_code] ||
            "Unknown condition";

        const forecastCards = daily.time.map(
            function (date, index) {

                const code = daily.weather_code[index];

                const icon = getWeatherIcon(code);

                const forecastCondition =
                    conditions[code] || "Unknown";

                const day = new Date(date + "T12:00:00")
                    .toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric"
                    });

                const maxTemp =
                    daily.temperature_2m_max[index];

                const minTemp =
                    daily.temperature_2m_min[index];

                const rainChance =
                    daily.precipitation_probability_max[index];

                return `
                    <div class="forecast-card">

                        <p class="forecast-day">
                            ${day}
                        </p>

                        <div class="forecast-icon">
                            ${icon}
                        </div>

                        <p class="forecast-condition">
                            ${forecastCondition}
                        </p>

                        <p class="forecast-temp">
                            <strong>
                                ${maxTemp}${unitSymbol}
                            </strong>

                            <span>
                                ${minTemp}${unitSymbol}
                            </span>
                        </p>

                        <p class="forecast-rain">
                            💧 ${rainChance ?? "—"}% chance
                        </p>

                    </div>
                `;
            }
        ).join("");

        message.textContent = "";

        const cityHeading =
            document.createElement("h2");

        cityHeading.textContent =
            [location.name, location.country]
                .filter(Boolean)
                .join(", ");

        const currentWeather =
            document.createElement("div");

        currentWeather.className = "current-weather";

        const currentIcon =
            document.createElement("div");

        currentIcon.className = "forecast-icon";

        currentIcon.textContent =
            getWeatherIcon(current.weather_code);

        const temperature =
            document.createElement("h3");

        temperature.textContent =
            `${current.temperature_2m} ${unitSymbol}`;

        const conditionText =
            document.createElement("p");

        conditionText.textContent = condition;

        const feelsLike =
            document.createElement("p");

        feelsLike.textContent =
            `Feels like: ${current.apparent_temperature} ${unitSymbol}`;

        const humidity =
            document.createElement("p");

        humidity.textContent =
            `Humidity: ${current.relative_humidity_2m}%`;

        const wind =
            document.createElement("p");

        wind.textContent =
            `Wind speed: ${current.wind_speed_10m} km/h`;

        const precipitation =
            document.createElement("p");

        precipitation.textContent =
            `Precipitation: ${current.precipitation} mm`;

        const updated =
            document.createElement("p");

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

        const unitToggle =
            document.createElement("button");

        unitToggle.type = "button";
        unitToggle.className = "unit-toggle";

        unitToggle.textContent =
            temperatureUnit === "celsius"
                ? "Switch to °F"
                : "Switch to °C";

        unitToggle.addEventListener("click", function () {

            temperatureUnit =
                temperatureUnit === "celsius"
                    ? "fahrenheit"
                    : "celsius";

            form.requestSubmit();
        });

        const forecastHeading =
            document.createElement("h3");

        forecastHeading.className =
            "forecast-heading";

        forecastHeading.textContent =
            "5-Day Forecast";

        const forecastContainer =
            document.createElement("div");

        forecastContainer.className =
            "forecast-container";

        forecastContainer.innerHTML =
            forecastCards;

        weatherResult.replaceChildren(
            cityHeading,
            unitToggle,
            currentWeather,
            forecastHeading,
            forecastContainer
        );

    } catch (error) {

        console.error(
            "Weather search failed:",
            error
        );

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
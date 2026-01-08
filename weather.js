// Open-Meteo API
const API_URL = 'https://api.open-meteo.com/v1';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1';

// State
let currentLocation = null;
let recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  getUserLocation();
  displayRecentSearches();
  
  // Add Enter key support for search
  const searchInput = document.getElementById('searchInput');
  if(searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if(e.key === 'Enter') {
        searchLocation();
      }
    });
  }
});

// Get User Location
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      () => fetchWeatherByCity('New York')
    );
  } else {
    fetchWeatherByCity('New York');
  }
}

// Fetch Weather by Coordinates
async function fetchWeatherByCoords(lat, lon) {
  try {
    const response = await fetch(`${API_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=temperature_2m,precipitation,uv_index&timezone=auto`);
    const data = await response.json();
    
    const geoRes = await fetch(`${GEOCODING_URL}/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    const locName = geoData.results?.[0]?.name || 'Unknown';
    const country = geoData.results?.[0]?.country || '';

    updateWeatherDisplay(data, locName, country);
    addToRecentSearches(data, locName, country);
    updateCharts(data);
    updateFeatureBoxes(data);
    updateBackgroundByWeather(data);
    updateWeatherRecommendations(data);
  } catch (err) {
    console.error(err);
    showError('Failed to fetch weather data.');
  }
}

// Fetch Weather by City
async function fetchWeatherByCity(city) {
  try {
    const geoRes = await fetch(`${GEOCODING_URL}/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return showError('City not found.');

    const { latitude, longitude, name, country } = geoData.results[0];
    const response = await fetch(`${API_URL}/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=temperature_2m,precipitation,uv_index&timezone=auto`);
    const data = await response.json();

    updateWeatherDisplay(data, name, country);
    addToRecentSearches(data, name, country);
    updateCharts(data);
    updateFeatureBoxes(data);
    updateBackgroundByWeather(data);
    updateWeatherRecommendations(data);
  } catch (err) {
    console.error(err);
    showError('Failed to fetch weather data.');
  }
}

// Map weather code
function getWeatherFromCode(code, isDay) {
  const weatherCodes = {
    0: {condition:'Clear sky', title:isDay?'Sunny':'Clear Night', emoji:isDay?'☀️':'🌙', bg:'weather-clear-day'},
    1: {condition:'Mainly clear', title:isDay?'Sunny':'Clear', emoji:isDay?'☀️':'🌙', bg:'weather-clear-day'},
    2: {condition:'Partly cloudy', title:'Partly Cloudy', emoji:'⛅', bg:'weather-partly-cloudy'},
    3: {condition:'Overcast', title:'Cloudy', emoji:'☁️', bg:'weather-cloudy'},
    45: {condition:'Foggy', title:'Foggy', emoji:'🌫️', bg:'weather-foggy'},
    48: {condition:'Depositing rime fog', title:'Foggy', emoji:'🌫️', bg:'weather-foggy'},
    51: {condition:'Light drizzle', title:'Light Rain', emoji:'🌦️', bg:'weather-light-rain'},
    53: {condition:'Moderate drizzle', title:'Light Rain', emoji:'🌦️', bg:'weather-light-rain'},
    55: {condition:'Dense drizzle', title:'Rainy', emoji:'🌧️', bg:'weather-rainy'},
    61: {condition:'Slight rain', title:'Light Rain', emoji:'🌦️', bg:'weather-light-rain'},
    63: {condition:'Moderate rain', title:'Rainy', emoji:'🌧️', bg:'weather-rainy'},
    65: {condition:'Heavy rain', title:'Rainy', emoji:'🌧️', bg:'weather-rainy'},
    71: {condition:'Slight snow', title:'Snowy', emoji:'❄️', bg:'weather-snowy'},
    73: {condition:'Moderate snow', title:'Snowy', emoji:'❄️', bg:'weather-snowy'},
    75: {condition:'Heavy snow', title:'Snowy', emoji:'❄️', bg:'weather-snowy'},
    77: {condition:'Snow grains', title:'Snowy', emoji:'❄️', bg:'weather-snowy'},
    80: {condition:'Slight rain showers', title:'Light Rain', emoji:'🌦️', bg:'weather-light-rain'},
    81: {condition:'Moderate rain showers', title:'Rainy', emoji:'🌧️', bg:'weather-rainy'},
    82: {condition:'Violent rain showers', title:'Rainy', emoji:'🌧️', bg:'weather-rainy'},
    85: {condition:'Slight snow showers', title:'Snowy', emoji:'❄️', bg:'weather-snowy'},
    86: {condition:'Heavy snow showers', title:'Snowy', emoji:'❄️', bg:'weather-snowy'},
    95: {condition:'Thunderstorm', title:'Stormy', emoji:'⛈️', bg:'weather-stormy'},
    96: {condition:'Thunderstorm with slight hail', title:'Stormy', emoji:'⛈️', bg:'weather-stormy'},
    99: {condition:'Thunderstorm with heavy hail', title:'Stormy', emoji:'⛈️', bg:'weather-stormy'}
  };
  return weatherCodes[code] || {condition:'Unknown', title:'Unknown', emoji:'🌤️', bg:'weather-default'};
}

// Update weather recommendations
function updateWeatherRecommendations(data) {
  const current = data.current_weather || data.current;
  if(!current) return;

  const temp = current.temperature_2m;
  const windSpeed = current.wind_speed_10m;
  const precipitation = current.precipitation;
  const weatherCode = current.weather_code;
  const humidity = current.relative_humidity_2m;

  let recommendations = [];
  let safetyLevel = 'safe'; // safe, caution, danger

  // Thunderstorm / Severe weather
  if (weatherCode >= 95) {
    safetyLevel = 'danger';
    recommendations = [
      '🚨 SEVERE WEATHER ALERT - Stay Indoors!',
      '⛈️ Lightning strikes possible - very dangerous',
      '🏠 Close all windows and doors immediately',
      '🚗 DO NOT drive unless absolutely necessary',
      '🔌 Unplug all electronics and appliances',
      '📱 Keep phone charged for emergency updates',
      '🌳 Stay away from trees and tall structures',
      '⚡ Avoid taking showers or baths',
      '👨‍👩‍👧‍👦 Keep family members indoors together',
      '🚪 Stay in interior rooms away from windows',
      '📻 Monitor weather radio for updates',
      '⏰ Storm may last 30-60 minutes'
    ];
  }
  // Heavy rain
  else if (weatherCode >= 63 && weatherCode <= 65) {
    safetyLevel = 'caution';
    recommendations = [
      '🌧️ Heavy rainfall expected in your area',
      '☂️ Large waterproof umbrella essential',
      '🚗 Reduce speed by 30%, visibility is poor',
      '👟 Waterproof footwear mandatory',
      '💡 Turn on headlights even during day',
      '🏠 Stay indoors if work permits',
      '📱 Check local flood warnings and alerts',
      '🚫 Avoid low-lying areas and underpasses',
      '🌊 Don\'t attempt to cross flowing water',
      '🔦 Keep flashlight ready for power outages',
      '📞 Keep emergency numbers handy',
      '⏰ Plan extra 20-30 min for any travel'
    ];
  }
  // Snow
  else if (weatherCode >= 71 && weatherCode <= 77) {
    safetyLevel = 'caution';
    recommendations = [
      '❄️ Snowy conditions - winter precautions needed',
      '🧥 Wear multiple layers - base, mid, outer',
      '🧤 Gloves, scarves, and warm hat essential',
      '🚗 Drive at reduced speed, brake gently',
      '👢 Wear insulated non-slip boots',
      '⛄ Check tire chains for vehicles if heavy',
      '🔥 Ensure home heating is working properly',
      '🏔️ Perfect conditions for skiing/snowboarding!',
      '☕ Hot chocolate and warm drinks recommended',
      '📱 Keep phone charged - batteries drain faster',
      '🧊 Watch for black ice on roads and sidewalks',
      '⏰ Snow may affect public transportation'
    ];
  }
  // Light rain
  else if (weatherCode >= 51 && weatherCode <= 61) {
    safetyLevel = 'safe';
    recommendations = [
      '🌦️ Light rain - safe to go outdoors',
      '☂️ Compact umbrella sufficient for protection',
      '🚶 Walking and jogging are perfectly safe',
      '🚗 All vehicles safe, normal driving conditions',
      '🌿 Great weather for indoor hobbies',
      '☕ Perfect for visiting cozy cafes',
      '📚 Ideal for reading by the window',
      '🎬 Good day for cinema or museums',
      '🛍️ Shopping malls and indoor activities',
      '🎨 Try indoor rock climbing or arcade',
      '💆 Spa day would be relaxing',
      '🍜 Hot soup weather - try local restaurants'
    ];
  }
  // Foggy
  else if (weatherCode >= 45 && weatherCode <= 48) {
    safetyLevel = 'caution';
    recommendations = [
      '🌫️ Dense fog - visibility severely reduced',
      '🚗 Use low beam headlights, not high beams',
      '🐌 Reduce speed significantly - drive slow',
      '👀 Increase following distance to 5+ seconds',
      '🚶 Pedestrians: wear reflective/bright clothing',
      '⚠️ Use fog lights if your vehicle has them',
      '✈️ Check flight status before heading to airport',
      '🚢 Ferry services may be delayed or cancelled',
      '⏰ Allow 50% extra time for all journeys',
      '📻 Stay tuned to traffic radio updates',
      '🛑 Pull over safely if visibility is too poor',
      '☕ Fog usually clears by late morning'
    ];
  }
  // Clear/Sunny
  else if (weatherCode <= 1) {
    safetyLevel = 'safe';
    if (temp > 30) {
      recommendations = [
        '☀️ Beautiful sunny day - very hot!',
        '🌡️ Temperature above 30°C - heat alert',
        '💧 Drink 8-10 glasses of water today',
        '🧴 Apply SPF 50+ sunscreen every 2 hours',
        '👒 Wide-brimmed hat and UV sunglasses essential',
        '🏊 Swimming/water activities highly recommended',
        '🕐 Avoid outdoor activities 12pm-4pm (peak heat)',
        '🧃 Carry water bottle at all times',
        '👶 Keep children and pets hydrated',
        '🌳 Seek shade frequently, don\'t overexert',
        '🚗 Park in shade, check car temperature first',
        '💪 Light cotton clothing, avoid dark colors'
      ];
    } else if (temp > 20) {
      recommendations = [
        '☀️ Perfect weather - ideal outdoor conditions!',
        '🌡️ Comfortable temperature (20-30°C)',
        '🚶 Excellent for hiking and nature walks',
        '🚴 Perfect day for cycling adventures',
        '🏞️ Ideal for picnics in the park',
        '⚽ Great for outdoor sports and activities',
        '📸 Amazing lighting for photography',
        '🏖️ Beach and lake visits recommended',
        '🎣 Good conditions for fishing',
        '🦅 Perfect for bird watching',
        '🎪 Check for outdoor events and festivals',
        '🧴 Still apply sunscreen SPF 30+'
      ];
    } else if (temp > 10) {
      recommendations = [
        '🌤️ Pleasant mild weather today',
        '🌡️ Temperature 10-20°C - comfortable',
        '🧥 Light jacket or sweater recommended',
        '🚶 Perfect for leisurely walks',
        '☕ Outdoor cafes are very pleasant',
        '🎨 Great for sightseeing and tourism',
        '📷 Beautiful day for photography',
        '🌸 Visit botanical gardens',
        '🏛️ Explore historical sites',
        '🚗 All transportation modes are safe',
        '🎭 Good day for outdoor concerts',
        '🥾 Comfortable for long distance walking'
      ];
    } else {
      recommendations = [
        '🌤️ Cold but clear skies - bundle up!',
        '🌡️ Temperature below 10°C - quite cold',
        '🧥 Heavy jacket or winter coat needed',
        '🧤 Gloves and warm accessories essential',
        '🧣 Scarf recommended for neck protection',
        '🚶 Short outdoor walks are okay',
        '☕ Perfect for hot chocolate and warm drinks',
        '🏠 Great day for cozy indoor activities',
        '📚 Reading, gaming, or movie marathon',
        '🍲 Cook warm comfort foods',
        '🔥 Fireplace or heater makes it cozy',
        '🚗 Ensure car heater works properly'
      ];
    }
  }
  // Cloudy
  else if (weatherCode <= 3) {
    safetyLevel = 'safe';
    recommendations = [
      '☁️ Cloudy but safe and comfortable',
      '🌡️ Mild temperature - no extreme weather',
      '🚶 Perfect for outdoor walks and runs',
      '🚗 Excellent driving conditions',
      '📸 Great diffused lighting for photography',
      '🏃 Ideal for jogging - not too hot/bright',
      '🚴 Excellent for cycling routes',
      '🌳 Visit parks, gardens, and nature trails',
      '🎾 Good for tennis and outdoor sports',
      '⛳ Perfect golfing weather',
      '🛹 Skateboarding and skating conditions good',
      '🎪 Check for outdoor markets and events'
    ];
  }

  // Wind check
  if (windSpeed > 40) {
    safetyLevel = 'danger';
    recommendations.unshift('⚠️ WIND WARNING: Very strong winds detected!');
    recommendations.push('💨 Wind gusts may reach dangerous levels');
    recommendations.push('🌳 Stay away from trees and loose objects');
    recommendations.push('🚗 High-sided vehicles at risk of tipping');
    recommendations.push('🏠 Secure outdoor furniture and items');
  } else if (windSpeed > 25) {
    if (safetyLevel === 'safe') safetyLevel = 'caution';
    recommendations.push('💨 Windy conditions - hold onto belongings');
    recommendations.push('🚴 Cycling may be difficult');
    recommendations.push('☂️ Umbrellas may invert or break');
  }

  // Add humidity warnings
  if (humidity > 85) {
    recommendations.push('💧 Very high humidity - may feel uncomfortable');
    recommendations.push('😓 Expect sticky and muggy conditions');
  } else if (humidity < 30) {
    recommendations.push('🏜️ Low humidity - air is very dry');
    recommendations.push('💧 Use moisturizer, drink extra water');
  }

  // Add UV index warnings
  const currentHour = new Date().getHours();
  const uvIndex = data.hourly?.uv_index?.[currentHour] || 0;
  if (uvIndex > 7) {
    recommendations.push('☀️ UV Index HIGH - Skin damage risk');
    recommendations.push('🧴 Reapply sunscreen every 90 minutes');
  } else if (uvIndex > 5) {
    recommendations.push('☀️ Moderate UV - Sun protection advised');
  }

  // Display recommendations
  displayRecommendations(recommendations, safetyLevel);
}

function displayRecommendations(recommendations, safetyLevel) {
  let container = document.getElementById('weatherRecommendations');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'weatherRecommendations';
    container.className = 'weather-recommendations';
    
    // Insert after the location selector
    const locationSelector = document.querySelector('.location-selector');
    if (locationSelector) {
      locationSelector.parentNode.insertBefore(container, locationSelector.nextSibling);
    } else {
      // Fallback: append to sidebar
      document.querySelector('.sidebar').appendChild(container);
    }
  }

  const safetyColors = {
    safe: '#4ade80',
    caution: '#fbbf24',
    danger: '#ef4444'
  };

  const safetyIcons = {
    safe: '✅',
    caution: '⚠️',
    danger: '🚨'
  };

  const safetyTexts = {
    safe: 'Safe Conditions',
    caution: 'Use Caution',
    danger: 'Stay Alert!'
  };

  container.innerHTML = `
    <div class="recommendation-header" style="background: linear-gradient(135deg, ${safetyColors[safetyLevel]}22, ${safetyColors[safetyLevel]}44); border-left: 4px solid ${safetyColors[safetyLevel]}; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
      <div style="font-size: 24px; margin-bottom: 5px;">${safetyIcons[safetyLevel]}</div>
      <div style="font-size: 14px; font-weight: 600; color: ${safetyColors[safetyLevel]};">${safetyTexts[safetyLevel]}</div>
    </div>
    <h3 style="font-size: 16px; margin-bottom: 12px; color: rgba(255, 255, 255, 0.9);">Weather Recommendations</h3>
    <div class="recommendation-list">
      ${recommendations.map(rec => `
        <div class="recommendation-item">
          <span>${rec}</span>
        </div>
      `).join('')}
    </div>
    <div class="recommendation-info" style="margin-top: 20px; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px; border-left: 3px solid #667eea;">
      <p style="font-size: 12px; line-height: 1.6; color: rgba(255, 255, 255, 0.8); margin: 0;">
        <strong style="color: #a78bfa;">💡 Smart Weather Advisory:</strong><br>
       Our intelligent system continuously analyzes real-time weather conditions—including temperature, wind speed, precipitation, humidity levels, UV index, and sudden atmospheric changes—to deliver highly personalized and reliable safety recommendations. Whether you are planning outdoor activities, commuting, exercising, or traveling, you receive alerts and practical suggestions tailored to your specific location and weather risks.In addition to immediate safety advice, the system provides strong winds, heavy rainfall, poor visibility, or excessive UV exposure. These suggestions are automatically updated based on current conditions to help you plan your day safely and make informed decisions about outdoor activities.The system empowers you to make informed decisions. Stay safe and enjoy your day!
      </p>
    </div>
  `;
}

// Update background based on weather
function updateBackgroundByWeather(data) {
  const current = data.current_weather || data.current;
  if(!current) return;
  
  const weather = getWeatherFromCode(current.weather_code, current.is_day);
  
  // Remove all weather classes
  document.body.className = '';
  // Add the appropriate weather class
  document.body.classList.add(weather.bg);
}

// Update main display
function updateWeatherDisplay(data, city, country){
  const current = data.current_weather || data.current;
  if(!current) return;

  document.getElementById('headerLocation').textContent = `${city}, ${country}`;
  document.getElementById('sidebarLocation').textContent = `${city}, ${country}`;
  document.getElementById('mainTemp').textContent = `${Math.round(current.temperature_2m || 0)}°`;
  document.getElementById('highTemp').textContent = `${Math.round(data.daily?.temperature_2m_max[0] || 0)}°`;
  document.getElementById('lowTemp').textContent = `${Math.round(data.daily?.temperature_2m_min[0] || 0)}°`;

  const weather = getWeatherFromCode(current.weather_code, current.is_day);
  document.getElementById('weatherCondition').textContent = weather.title;
  document.getElementById('weatherDetail').textContent = weather.condition;
  
  // Set weather icon/emoji
  const weatherImg = document.getElementById('weatherImg');
  weatherImg.style.display = 'none'; // Hide img tag
  
  // Create emoji display if it doesn't exist
  let emojiDisplay = document.querySelector('.weather-emoji-display');
  if (!emojiDisplay) {
    emojiDisplay = document.createElement('div');
    emojiDisplay.className = 'weather-emoji-display';
    emojiDisplay.style.fontSize = '120px';
    emojiDisplay.style.textAlign = 'center';
    emojiDisplay.style.filter = 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))';
    document.querySelector('.weather-image').appendChild(emojiDisplay);
  }
  emojiDisplay.textContent = weather.emoji;
  
  // Update status percentage with current temp
  document.getElementById('statusPercent').textContent = `${Math.round(current.temperature_2m || 0)}°`;
}

// Update feature boxes
function updateFeatureBoxes(data){
  const current = data.current_weather || data.current;
  if(!current) return;

  document.getElementById('humidity').textContent = `${current.relative_humidity_2m || '--'}%`;
  document.getElementById('windSpeed').textContent = `${Math.round(current.wind_speed_10m || 0)} km/h`;
  document.getElementById('feelsLike').textContent = `${Math.round(current.apparent_temperature || 0)}°`;
  
  // Visibility - if not available, use cloud cover as proxy
  const visibility = current.visibility ? Math.round(current.visibility / 1000) : (100 - (current.cloud_cover || 0)) / 10;
  document.getElementById('visibility').textContent = `${Math.round(visibility)} km`;
  
  // UV Index from hourly data
  const currentHour = new Date().getHours();
  const uvIndex = data.hourly?.uv_index?.[currentHour] || 0;
  document.getElementById('uvIndex').textContent = Math.round(uvIndex);
  
  document.getElementById('pressure').textContent = `${Math.round(current.pressure_msl || 0)} hPa`;
  document.getElementById('precipitation').textContent = `${current.precipitation || 0} mm`;
}

// Charts initialization
let forecastChart, hourlyChart, miniChart;
function initCharts(){
  const forecastCtx = document.getElementById('forecastChart').getContext('2d');
  forecastChart = new Chart(forecastCtx, {
    type: 'line',
    data: { 
      labels: [], 
      datasets: [{ 
        label: 'Temp °C', 
        data: [], 
        borderColor: 'rgba(255, 255, 255, 0.9)', 
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: 'white',
        tension: 0.4
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      scales: { 
        y: { 
          beginAtZero: false,
          ticks: { color: 'white', font: { size: 12 } },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }, 
        x: { 
          ticks: { color: 'white', font: { size: 12 } },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        } 
      }, 
      plugins: { 
        legend: { 
          labels: { color: 'white', font: { size: 14 } }
        }
      }
    }
  });

  const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
  hourlyChart = new Chart(hourlyCtx, {
    type: 'line',
    data: { 
      labels: [], 
      datasets: [{ 
        label: 'Hourly Temp °C', 
        data: [], 
        borderColor: 'rgba(251, 191, 36, 0.9)', 
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: 'rgba(251, 191, 36, 1)',
        tension: 0.4
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      scales: { 
        y: { 
          beginAtZero: false,
          ticks: { color: 'white', font: { size: 12 } },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }, 
        x: { 
          ticks: { color: 'white', font: { size: 11 }, maxRotation: 45, minRotation: 45 },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        } 
      }, 
      plugins: { 
        legend: { 
          labels: { color: 'white', font: { size: 14 } }
        }
      }
    }
  });

  const miniCtx = document.getElementById('miniChart').getContext('2d');
  miniChart = new Chart(miniCtx, {
    type: 'bar',
    data: { 
      labels: [], 
      datasets: [{ 
        label: 'Trend', 
        data: [], 
        backgroundColor: 'rgba(74, 222, 128, 0.7)',
        borderColor: 'rgba(74, 222, 128, 1)',
        borderWidth: 1
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false }
      }, 
      scales: { 
        y: { 
          beginAtZero: false,
          ticks: { color: 'white', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }, 
        x: { 
          ticks: { color: 'white', font: { size: 9 } },
          grid: { display: false }
        } 
      }
    }
  });
}

// Update charts with data
function updateCharts(data){
  if(data.daily){
    const labels = data.daily.time.slice(0, 7).map(d => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    forecastChart.data.labels = labels;
    forecastChart.data.datasets[0].data = data.daily.temperature_2m_max.slice(0, 7).map(t => Math.round(t));
    forecastChart.update();
  }

  if(data.hourly){
    const labels = data.hourly.time.slice(0,24).map(t => {
      const date = new Date(t);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    hourlyChart.data.labels = labels;
    hourlyChart.data.datasets[0].data = data.hourly.temperature_2m.slice(0,24).map(t => Math.round(t));
    hourlyChart.update();
  }

  if(data.daily){
    const miniLabels = data.daily.time.slice(0, 7).map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    miniChart.data.labels = miniLabels;
    miniChart.data.datasets[0].data = data.daily.temperature_2m_max.slice(0, 7).map(t => Math.round(t));
    miniChart.update();
  }
}

// Search toggle
function toggleSearch(){
  document.getElementById('searchContainer').classList.toggle('active');
  if(document.getElementById('searchContainer').classList.contains('active')) {
    document.getElementById('searchInput').focus();
  }
}

// Search function
function searchLocation(){
  const city = document.getElementById('searchInput').value.trim();
  if(city) {
    fetchWeatherByCity(city);
    document.getElementById('searchContainer').classList.remove('active');
  }
}

// Show error
function showError(msg){ 
  alert(msg); 
}

// Recent searches
function displayRecentSearches(){
  const container = document.getElementById('recentCards');
  if(!container) return;
  
  container.innerHTML = '';
  recentSearches.forEach(s => {
    const card = document.createElement('div');
    card.className = 'recent-card';
    card.innerHTML = `
      <div class="location">${s.city}, ${s.country}</div>
      <div class="temp">${Math.round(s.temp)}°</div>
      <div class="condition">${s.condition}</div>
    `;
    card.onclick = () => fetchWeatherByCity(s.city);
    container.appendChild(card);
  });
}

function addToRecentSearches(data, city, country){
  const current = data.current_weather || data.current;
  if(!current) return;
  
  const weather = getWeatherFromCode(current.weather_code, current.is_day);
  const newSearch = { 
    city, 
    country, 
    temp: current.temperature_2m, 
    condition: weather.condition 
  };
  
  recentSearches = [newSearch, ...recentSearches.filter(s=>s.city!==city)].slice(0,5);
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  displayRecentSearches();
}

function clearRecent() {
  recentSearches = [];
  localStorage.removeItem('recentSearches');
  displayRecentSearches();
}
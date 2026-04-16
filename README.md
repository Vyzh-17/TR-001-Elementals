# Autonomous Drone Mission Planning AI

This project implements an Autonomous Drone Mission Planner using advanced simulated LLM or Google Gemini APIs based on the parameters provided. It is designed to take a natural language mission description and map it into an optimized JSON flight plan focusing on anti-gravity hovering capabilities.

## Features
- **Stunning UI**: A sleek, dark-themed dashboard to input mission commands.
- **Flight Path Visualizer**: Renders the generated trajectory on an HTML5 Canvas.
- **AI Integration**: Backend integration with Google Gemini Pro API to process natural language into structured flight plans.
- **Mock Mode**: Fully testable mock system when no API key is provided, returning simulated flight data.

## Project Structure
- `app.py`: Flask Web Server and API backend defining the system schema and parsing user inputs.
- `static/index.html`: The user interface structure.
- `static/styles.css`: Glassmorphism and cyberpunk aesthetic styling.
- `static/script.js`: Handles API requests, JSON formatting, and 2D map visualization.

## Getting Started

1. **Install Dependencies**
   Run the following command to install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up Environment Variables (Optional but Recommended)**
   For real generative AI processing, you need a Google Generative AI API Key.
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```
   If not provided, the app will gracefully fall back to a `MOCK` generative mode that serves an example response.

3. **Run the Server**
   Start the Flask application:
   ```bash
   python app.py
   ```

4. **Access the Application**
   Open your browser and navigate to:
   [http://localhost:5000](http://localhost:5000)

## Mission Prompts
Try inserting a detailed prompt, such as:
> "Conduct an aerial survey of the downtown commercial block to identify structural anomalies. Start at coordinates (34.05, -118.24) and scan at 100 meters altitude. Ensure we do not deplete the battery below 30%."

## Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript, CSS3
- **Backend**: Python, Flask, Google Generative AI SDK
